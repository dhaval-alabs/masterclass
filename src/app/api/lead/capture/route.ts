import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  findRegistrationByEmailOrPhone,
  getWebinarConfig,
  addUnverifiedRegistration,
  getAutoSendCampaign,
  scheduleEmailForRecipient,
  scheduleWhatsAppForRecipient,
} from '@/lib/db';
import { lsqPostWithRetry } from '@/lib/lsqClient';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function lsqCaptureUrl(): string {
  return `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.Capture?accessKey=${requireEnv('LSQ_ACCESS')}&secretKey=${requireEnv('LSQ_SECRET')}`;
}

// LSQ Lead.Capture with retry + delivery confirmation. LSQ is the CRM
// system-of-record for the lead; this write used to be fire-and-forget (single
// attempt), so a transient LSQ outage silently dropped the CRM record even
// though the lead was safely stored in our own DB. Retry logic now lives in the
// shared lsqPostWithRetry helper so every LSQ write (capture, verify, …) uses
// the same policy. Keeps the "[LSQ] capture delivered/FAILED" log lines.
function captureLeadInLsqWithRetry(payload: unknown, registrationId: string | null) {
  return lsqPostWithRetry(lsqCaptureUrl(), payload, 'capture', `reg=${registrationId ?? 'n/a'}`);
}

let sheetsTokenCache: { token: string; expiresAt: number } | null = null;
async function getGoogleSheetsToken(clientEmail: string, privateKey: string): Promise<string> {
  if (sheetsTokenCache && Date.now() < sheetsTokenCache.expiresAt) return sheetsTokenCache.token;
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${b64Header}.${b64Payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  let formattedKey = privateKey.replace(/\\n/g, '\n');
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) formattedKey = formattedKey.slice(1, -1);
  const signature = sign.sign(formattedKey, 'base64url');
  const jwt = `${signatureInput}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Failed Google Sheets Auth');
  sheetsTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return sheetsTokenCache.token;
}

async function pushToGoogleSheets(body: any, cleanPhone: string) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;
    if (!sheetId || !email || !key) return;
    const token = await getGoogleSheetsToken(email, key);
    const row = [
      new Date().toISOString(),
      body.fullName || '',
      body.email || '',
      cleanPhone,
      body.city || '',
      body.sourceName || 'ExcelToAI_Masterclass',
      body.typeFilter || 'PPC-SM',
      body.utm_source || '',
      body.utm_medium || '',
      body.utm_campaign || '',
      body.utm_term || '',
      body.gclid || '',
      body.behaviour?.time_on_page_seconds || '',
      body.behaviour?.max_scroll_pct || '',
      body.behaviour?.form_completion_seconds || '',
      body.referrer || '',
      'Unverified',   // Column Q — OTP status at capture time
      '',             // Column R — Zoom join URL (filled after OTP verify)
      '',             // Column S — Zoom sync status
      body.referralSource || '',
    ];
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/NextJS!A:T:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      },
    );
  } catch (err) {
    console.error('[Sheets] Error:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, phone, city, typeFilter } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const config = await getWebinarConfig().catch(() => null);

    if (!config?.activeSessionId) {
      return NextResponse.json(
        { success: false, error: 'Registration is not currently open. Please check back when the next webinar is announced.' },
        { status: 503 },
      );
    }

    // Block only VERIFIED duplicates — unverified users can re-enter the flow
    const existing = await findRegistrationByEmailOrPhone(email, phone, config.activeSessionId);
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          error: 'This email or phone is already registered for this webinar. Check your inbox for the Zoom join link.',
        },
        { status: 409 },
      );
    }

    const nameParts = (fullName || '').split(' ').filter(Boolean);
    const firstName = nameParts[0] || fullName || '';
    const lastName = nameParts.slice(1).join(' ');

    // 1. Insert unverified row — captures the lead even before OTP is sent
    let registrationId: string | null = null;
    try {
      const created = await addUnverifiedRegistration({
        fullName,
        email,
        phone,
        city,
        whatsappStatus: 'pending',
        whatsappError: null,
        sessionId: config.activeSessionId,
        // Meta click identifiers — persisted so the server-side WebinarAttended
        // CAPI event can reuse them and so we can forward mx_FBCLID to LSQ.
        fbc: typeof body.fbc === 'string' ? body.fbc : null,
        fbp: typeof body.fbp === 'string' ? body.fbp : null,
        fbclid: typeof body.fbclid === 'string' ? body.fbclid : null,
      });
      registrationId = created.id;

      getAutoSendCampaign('unverified').then(async campaign => {
        if (!campaign) return;
        await scheduleEmailForRecipient({
          campaignId:     campaign.id,
          recipientEmail: email,
          recipientName:  fullName,
          delayValue:     campaign.delayValue,
          delayUnit:      campaign.delayUnit,
        });
      }).catch(err => console.error('[auto-send] unverified queue failed:', err));

      // WhatsApp auto-send: nudge people who don't complete OTP (fired later by
      // the cron; cancelled automatically if they verify in the meantime).
      scheduleWhatsAppForRecipient({
        trigger: 'unverified',
        registrationId: registrationId,
        phone: phone,
        recipientName: fullName,
      }).catch((err: unknown) => console.error('[wa auto-send] unverified queue failed:', err));
    } catch (regErr) {
      console.error('[Capture] Failed to insert unverified row:', regErr);
    }

    const leadEventId: string = (body.eventId && typeof body.eventId === 'string')
      ? body.eventId
      : crypto.randomUUID();

    // 2. LSQ lead capture
    const notesLines: string[] = [
      body.referralSource ? `Referral Source: ${body.referralSource}` : null,
      `Registered: ${new Date().toISOString()}`,
    ].filter((line): line is string => line !== null);
    const notesFieldName = process.env.LSQ_NOTES_FIELD_NAME || 'mx_Notes';

    const lsqPayload = [
      { Attribute: 'FirstName',    Value: firstName },
      { Attribute: 'LastName',     Value: lastName },
      { Attribute: 'EmailAddress', Value: email },
      { Attribute: 'Phone',        Value: phone },
      { Attribute: 'mx_City_name', Value: city },
      { Attribute: 'Source',       Value: typeFilter || config?.lsqSourceName?.trim() || 'PPC-SM' },
      { Attribute: 'mx_OTP_Status', Value: 'Unverified' },
      { Attribute: notesFieldName, Value: notesLines.join('\n') },
    ];

    // Click IDs (mx_GCLID / mx_FBCLID) are effectively WRITE-ONCE from the LP's
    // side. Lead.Capture UPSERTS by email/phone, so sending an empty value on a
    // re-registration OVERWRITES a previously-captured click ID with blank —
    // this is why repeat/qualified leads (who register for multiple webinars,
    // often organically the 2nd time) end up with a null mx_FBCLID, silently
    // degrading Meta CAPI match quality for every counselor-grade event.
    // Fix: only send these attributes when we actually have a value; otherwise
    // omit them entirely so LSQ keeps whatever it already has.
    // Meta click id: prefer the formatted _fbc cookie (what CAPI expects), fall
    // back to the raw fbclid param. Field name is env-configurable because LSQ
    // derives the schema name from the display name on save (usually mx_FBCLID).
    const gclidValue  = body.gclid || '';
    const fbclidValue = body.fbc || body.fbclid || '';
    // GCLID schema name is `mx_gclid` (verified against LSQ metadata) — the old
    // `mx_GCLID` did not match a real schema name and was silently dropped.
    if (gclidValue)  lsqPayload.push({ Attribute: process.env.LSQ_GCLID_FIELD || 'mx_gclid', Value: gclidValue });
    if (fbclidValue) lsqPayload.push({ Attribute: process.env.LSQ_FBCLID_FIELD || 'mx_FBCLID', Value: fbclidValue });

    // Campaign / TOPIC attribution → LSQ SourceCampaign.
    // Which masterclass topic a lead came in on (Excel to AI vs College to AI vs
    // Career Compass) was never written to the CRM: the LP is a SINGLE URL whose
    // active session is swapped server-side, `sourceName` is hardcoded to
    // 'ExcelToAI_Masterclass', and utm_campaign was forwarded only to Sheets — so
    // LSQ had no reliable per-topic key to segment on (this is why topic-specific
    // Customer Lists / lookalikes couldn't be built). Populate SourceCampaign so
    // segmentation is reliable GOING FORWARD (not retroactive — old leads stay
    // unlabeled).
    //   Primary : utm_campaign — the exact paid campaign the click came from,
    //             which encodes the topic (e.g. B2_CollegeToAI_Masterclass_Jun21).
    //   Fallback: the active session identifier, so organic/direct leads (no utm)
    //             are still tagged with whichever topic was live at registration.
    // Most-recent-wins on re-registration (Lead.Capture upserts) — this reflects
    // the lead's current topic interest. Field name is env-configurable because
    // the CRM's schema name may differ (mirrors LSQ_FBCLID_FIELD).
    const utmCampaign = (typeof body.utm_campaign === 'string' ? body.utm_campaign.trim() : '');
    const campaignValue = utmCampaign
      || config?.activeSessionCode
      || config?.activeSessionMetaEventSuffix
      || '';
    if (campaignValue) {
      lsqPayload.push({ Attribute: process.env.LSQ_CAMPAIGN_FIELD || 'SourceCampaign', Value: campaignValue });
    }

    // Full UTM set → LSQ, so every registration is traceable back to the exact
    // ad source/medium/campaign/content/term that drove it (the "CRM tagging at
    // intake" gap: a new campaign's leads couldn't be traced via SourceCampaign
    // or UTM once it launched). Written to BOTH the standard Source* fields and
    // the dedicated UTM custom fields, each ONLY when the value is present — the
    // UTM fields are the literal params and must stay empty when there was none.
    //
    // IMPORTANT — the custom UTM fields' real SchemaName is DOUBLE-prefixed
    // (mx_mx_UTM_*), NOT mx_UTM_*: LSQ prepends another "mx_" when a field's
    // display name already starts with "mx_". Writing to mx_UTM_* silently
    // no-ops (this was a real bug). All names below verified against LSQ
    // LeadsMetaData; each is env-overridable.
    const utmMedium  = (typeof body.utm_medium  === 'string' ? body.utm_medium.trim()  : '');
    const utmContent = (typeof body.utm_content === 'string' ? body.utm_content.trim() : '');
    const utmTerm    = (typeof body.utm_term    === 'string' ? body.utm_term.trim()    : '');
    // The form defaults utm_source to "direct" when there's no param — treat that
    // as absent so we don't stamp every organic lead's UTM source as "direct".
    const rawUtmSource = (typeof body.utm_source === 'string' ? body.utm_source.trim() : '');
    const utmSource = rawUtmSource && rawUtmSource.toLowerCase() !== 'direct' ? rawUtmSource : '';

    const utmWrites: Array<[string, string]> = [
      [process.env.LSQ_UTM_SOURCE_FIELD   || 'mx_mx_UTM_Source',   utmSource],
      [process.env.LSQ_UTM_MEDIUM_FIELD   || 'mx_mx_UTM_Medium',   utmMedium],
      [process.env.LSQ_UTM_CAMPAIGN_FIELD || 'mx_mx_UTM_Campaign', utmCampaign],
      [process.env.LSQ_UTM_CONTENT_FIELD  || 'mx_mx_UTM_Content',  utmContent],
      [process.env.LSQ_UTM_TERM_FIELD     || 'mx_mx_UTM_Term',     utmTerm],
      // Standard LSQ source fields (SourceCampaign handled above with fallback).
      ['SourceMedium',  utmMedium],
      ['SourceContent', utmContent],
    ];
    for (const [attr, val] of utmWrites) {
      if (val) lsqPayload.push({ Attribute: attr, Value: val });
    }

    // 3. Fire LSQ (with retry + delivery confirmation) + Sheets in parallel.
    // The lead is already persisted in our own DB above, so the response never
    // depends on LSQ; but we DO await the retrying capture so the attempts
    // actually complete on serverless (a non-awaited background fetch can be
    // killed after the response returns) and so we can report delivery.
    const [lsqResult] = await Promise.all([
      captureLeadInLsqWithRetry(lsqPayload, registrationId),
      pushToGoogleSheets(body, phone),
    ]);

    return NextResponse.json({ success: true, registrationId, leadEventId, lsqDelivered: lsqResult.ok });

  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
