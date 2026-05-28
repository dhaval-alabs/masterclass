import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  findRegistrationByEmailOrPhone,
  getWebinarConfig,
  addUnverifiedRegistration,
  getAutoSendCampaign,
  scheduleEmailForRecipient,
} from '@/lib/db';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function lsqCaptureUrl(): string {
  return `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.Capture?accessKey=${requireEnv('LSQ_ACCESS')}&secretKey=${requireEnv('LSQ_SECRET')}`;
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
      { Attribute: 'mx_GCLID',     Value: body.gclid || '' },
      { Attribute: 'mx_OTP_Status', Value: 'Unverified' },
      { Attribute: notesFieldName, Value: notesLines.join('\n') },
    ];

    // 3. Fire LSQ + Sheets in parallel (non-blocking to the user)
    await Promise.allSettled([
      fetch(lsqCaptureUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lsqPayload),
      }).then(res => {
        if (!res.ok) console.error('[LSQ] Capture failed:', res.status);
      }),
      pushToGoogleSheets(body, phone),
    ]);

    return NextResponse.json({ success: true, registrationId, leadEventId });

  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
