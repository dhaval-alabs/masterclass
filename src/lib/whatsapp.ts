// Centralized WhatsApp sender — OTP + bulk template campaigns.
// IMPORTANT: A 200 OK from the Graph API only means Meta accepted the message
// into its queue — it does NOT guarantee delivery to the user's phone. Delivery
// is reported via the messages.statuses webhook, which we don't subscribe to.
// The returned `status` here therefore reflects send-API outcome, not delivery.

import {
  getWhatsAppOptoutPhones,
  getWhatsAppDailySentCount,
  bulkCreateWhatsAppSendLog,
  type WaSendLogEntry,
} from '@/lib/db';

// Graph API version. v17 was EOL'd in mid-2025; v22 is the current LTS.
// Centralize so we can bump everywhere with one edit.
const GRAPH_API_VERSION = 'v22.0';

export type WhatsAppSendResult = {
  status: 'sent' | 'api_failed' | 'skipped';
  error: string | null;
};

/**
 * Credentials for OUTBOUND BROADCAST / marketing sends (campaigns, template
 * list, admin test message). Uses a dedicated broadcast number when its env
 * vars are set, otherwise falls back to the OTP number's credentials so
 * existing behaviour is unchanged.
 *
 * OTP (sendWhatsAppOtp) deliberately stays on META_WA_* and does NOT use this,
 * so marketing volume / quality-rating issues can never affect OTP delivery.
 */
export function getBroadcastCreds(): {
  waAccessToken: string | undefined;
  waPhoneId: string | undefined;
  wabaId: string | undefined;
} {
  return {
    waAccessToken: process.env.META_WA_BROADCAST_ACCESS_TOKEN || process.env.META_WA_ACCESS_TOKEN,
    waPhoneId:     process.env.META_WA_BROADCAST_PHONE_NUMBER_ID || process.env.META_WA_PHONE_NUMBER_ID,
    wabaId:        process.env.META_WA_BROADCAST_WABA_ID || process.env.META_WABA_ID,
  };
}

export async function sendWhatsAppOtp(
  phone: string,
  otp: string,
  templateName: string,
): Promise<WhatsAppSendResult> {
  const waAccessToken = process.env.META_WA_ACCESS_TOKEN;
  const waPhoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!waAccessToken || !waPhoneId) {
    return { status: 'skipped', error: 'Meta WA env vars not configured' };
  }

  try {
    const waRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `91${phone}`,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }],
        },
      }),
    });

    if (waRes.ok) {
      return { status: 'sent', error: null };
    }

    // Capture Meta's specific error message + code for telemetry.
    let detail = `HTTP ${waRes.status}`;
    try {
      const body = await waRes.json();
      const err = body?.error;
      if (err) {
        const code = err.code ?? '?';
        const msg = err.message ?? 'unknown';
        const subCode = err.error_subcode ? ` (subcode ${err.error_subcode})` : '';
        detail = `code=${code}${subCode}: ${msg}`;
      }
    } catch {
      // Body wasn't JSON — keep the HTTP status.
    }
    console.error('[WhatsApp] Send failed:', detail);
    return { status: 'api_failed', error: detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown network error';
    console.error('[WhatsApp] Network error:', err);
    return { status: 'api_failed', error: detail };
  }
}

// ── Template campaign sender ───────────────────────────────────────────────────

export interface WaCampaignResult {
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
}

// Rate-limit constants — tuned to keep the number safe on all Meta tiers.
// Tier 1 accounts (default): 1,000 business-initiated conversations / 24 h.
// Cloud API throughput cap: 80 msg/s, but hammering that risks quality downgrades.
// Strategy: 10 msg/s within each batch, 3 s pause between batches of 30.
// This keeps us at ~10 msg/s sustained — safe on any tier, avoids spam signals.
const MSG_DELAY_MS  = 100;   // 100 ms between messages → 10 msg/s
const BATCH_SIZE    = 30;    // pause after every 30 messages
const BATCH_PAUSE_MS = 3_000; // 3 s between batches

// Max consecutive API errors before aborting — prevents hammering Meta when
// something is fundamentally wrong (bad token, template rejected, etc.).
const MAX_CONSECUTIVE_FAILURES = 5;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Returns { ok, metaMessageId, status, detail, isRateLimit } for one message. */
async function sendOneMessage(params: {
  waAccessToken: string;
  waPhoneId: string;
  phone: string;
  templateName: string;
  languageCode: string;
  components: unknown[];
}): Promise<{ ok: boolean; metaMessageId: string | null; status: number; detail: string; isRateLimit: boolean }> {
  const { waAccessToken, waPhoneId, phone, templateName, languageCode, components } = params;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${waAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${phone}`,
          type: 'template',
          template: { name: templateName, language: { code: languageCode }, components },
        }),
      },
    );

    if (res.ok) {
      let metaMessageId: string | null = null;
      try {
        const data = await res.json() as { messages?: { id: string }[] };
        metaMessageId = data?.messages?.[0]?.id ?? null;
      } catch { /* ignore parse error */ }
      return { ok: true, metaMessageId, status: res.status, detail: '', isRateLimit: false };
    }

    let detail = `HTTP ${res.status}`;
    let isRateLimit = res.status === 429;
    try {
      const body = await res.json() as { error?: { code?: number; message?: string; error_subcode?: number } };
      const err = body?.error;
      if (err) {
        detail = `code=${err.code ?? '?'}: ${err.message ?? 'unknown'}`;
        // Meta rate-limit error codes: 4 (app-level), 130429 (rate limit hit)
        if (err.code === 4 || err.code === 130429 || err.error_subcode === 2494055) {
          isRateLimit = true;
        }
      }
    } catch { /* non-JSON body */ }

    return { ok: false, metaMessageId: null, status: res.status, detail, isRateLimit };
  } catch (err) {
    return { ok: false, metaMessageId: null, status: 0, detail: err instanceof Error ? err.message : String(err), isRateLimit: false };
  }
}

// Valid Indian mobile phone: 10 digits, starting with 6, 7, 8, or 9.
function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

// Send a WhatsApp template to a list of recipients.
// variables: array of values for {{1}}, {{2}}, … placeholders.
// {name} in any variable value is replaced with the recipient's first name.
export async function sendWhatsAppCampaign(params: {
  campaignId: string;
  templateName: string;
  languageCode: string;
  variables: string[];
  recipients: { phone: string; fullName: string }[];
  // For templates with an IMAGE header — public URL of the header image.
  headerImageUrl?: string | null;
}): Promise<WaCampaignResult> {
  const { campaignId, templateName, languageCode, variables, recipients, headerImageUrl } = params;

  // Broadcast sends go from the dedicated broadcast number (falls back to OTP creds).
  const { waAccessToken, waPhoneId } = getBroadcastCreds();
  if (!waAccessToken || !waPhoneId) {
    return { sentCount: 0, failedCount: recipients.length, skippedCount: 0, errors: ['WhatsApp broadcast credentials not configured (META_WA_BROADCAST_* or META_WA_*)'] };
  }

  // 1. Validate phone numbers — must be 10 digits starting with 6-9.
  const validRecipients: { phone: string; fullName: string }[] = [];
  const logEntries: WaSendLogEntry[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  // Persist the log buffer incrementally so a function timeout mid-send never
  // loses records — messages already went out to real users, so we MUST capture
  // them even if the request is killed before the loop finishes.
  const flushLog = async () => {
    if (logEntries.length === 0) return;
    const batch = logEntries.splice(0, logEntries.length);
    try {
      await bulkCreateWhatsAppSendLog(batch);
    } catch (logErr) {
      console.error('[WhatsApp] Failed to persist send-log batch:', logErr);
    }
  };

  for (const r of recipients) {
    if (!isValidIndianPhone(r.phone)) {
      skippedCount++;
      if (errors.length < 10) errors.push(`${r.phone}: invalid phone number`);
      logEntries.push({
        campaignId,
        phone: r.phone,
        recipientName: r.fullName,
        status: 'skipped',
        errorDetail: 'invalid phone number',
      });
    } else {
      validRecipients.push(r);
    }
  }

  // 2. Check opt-outs.
  const optoutPhones = await getWhatsAppOptoutPhones();
  const activeRecipients: { phone: string; fullName: string }[] = [];
  for (const r of validRecipients) {
    if (optoutPhones.has(r.phone)) {
      skippedCount++;
      if (errors.length < 10) errors.push(`${r.phone}: opted out`);
      logEntries.push({
        campaignId,
        phone: r.phone,
        recipientName: r.fullName,
        status: 'skipped',
        errorDetail: 'opted out',
      });
    } else {
      activeRecipients.push(r);
    }
  }

  // 3. Daily-limit guard — stays safely within the number's WhatsApp messaging
  //    tier (default 900, a ~10% margin under the 1,000/24h Tier-1 cap). We cap
  //    THIS send to the remaining headroom so we never overshoot the tier; the
  //    overflow is recorded as 'skipped' (not failed) and is reachable the next
  //    day via "Send to new" once the daily count resets.
  const dailyLimit = parseInt(process.env.WA_DAILY_LIMIT ?? '900', 10);
  const dailySentSoFar = await getWhatsAppDailySentCount();
  const headroom = Math.max(0, dailyLimit - dailySentSoFar);

  // Already at/over the cap → nothing can go out now. Defer everyone.
  if (headroom <= 0) {
    const limitError = `Daily send limit reached (${dailySentSoFar}/${dailyLimit}) — deferred; use "Send to new" after the daily count resets.`;
    errors.push(limitError);
    for (const r of activeRecipients) {
      logEntries.push({ campaignId, phone: r.phone, recipientName: r.fullName, status: 'skipped', errorDetail: limitError });
    }
    await bulkCreateWhatsAppSendLog(logEntries);
    return { sentCount: 0, failedCount: 0, skippedCount: skippedCount + activeRecipients.length, errors };
  }

  // Under the cap but too many recipients → send up to the headroom, defer the rest.
  let recipientsToSend = activeRecipients;
  if (activeRecipients.length > headroom) {
    recipientsToSend = activeRecipients.slice(0, headroom);
    const deferred = activeRecipients.slice(headroom);
    const deferMsg = `Daily limit ${dailyLimit} (${dailySentSoFar} already sent today): sending ${headroom} now, ${deferred.length} deferred — reach them with "Send to new" after the daily count resets.`;
    errors.push(deferMsg);
    for (const r of deferred) {
      logEntries.push({ campaignId, phone: r.phone, recipientName: r.fullName, status: 'skipped', errorDetail: `Daily limit (${dailyLimit}) — deferred, reachable via "Send to new" tomorrow` });
      skippedCount++;
    }
  }

  // 4. Send loop.
  let sentCount          = 0;
  let failedCount        = 0;
  let consecutiveFails   = 0;

  for (let i = 0; i < recipientsToSend.length; i++) {
    const r = recipientsToSend[i];
    const firstName    = r.fullName.split(' ')[0] || r.fullName;
    const resolvedVars = variables.map(v => v.replace(/\{name\}/gi, firstName));
    const components: unknown[] = [];
    // Image header (if the template has one) must be supplied at send time.
    if (headerImageUrl) {
      components.push({ type: 'header', parameters: [{ type: 'image', image: { link: headerImageUrl } }] });
    }
    if (resolvedVars.length > 0) {
      components.push({ type: 'body', parameters: resolvedVars.map(text => ({ type: 'text', text })) });
    }

    const result = await sendOneMessage({
      waAccessToken, waPhoneId,
      phone: r.phone, templateName, languageCode, components,
    });

    if (result.ok) {
      sentCount++;
      consecutiveFails = 0;
      logEntries.push({
        campaignId,
        phone: r.phone,
        recipientName: r.fullName,
        status: 'sent',
        metaMessageId: result.metaMessageId ?? undefined,
      });
    } else {
      failedCount++;
      consecutiveFails++;
      if (errors.length < 10) errors.push(`${r.phone}: ${result.detail}`);
      logEntries.push({
        campaignId,
        phone: r.phone,
        recipientName: r.fullName,
        status: 'failed',
        errorDetail: result.detail,
      });

      // Rate-limited — back off 15 s before continuing.
      if (result.isRateLimit) {
        console.warn('[WhatsApp] Rate limit hit — backing off 15 s');
        await sleep(15_000);
        consecutiveFails = 0; // reset — backoff may have cleared it
      }

      // Too many consecutive failures → something is fundamentally broken (bad token /
      // template rejected / account action required). Stop now to avoid wasting quota.
      if (consecutiveFails >= MAX_CONSECUTIVE_FAILURES) {
        const abortMsg = `Aborted after ${MAX_CONSECUTIVE_FAILURES} consecutive failures — check template status and token.`;
        errors.push(abortMsg);
        // Count remaining as failed.
        for (let j = i + 1; j < recipientsToSend.length; j++) {
          const rem = recipientsToSend[j];
          failedCount++;
          logEntries.push({
            campaignId,
            phone: rem.phone,
            recipientName: rem.fullName,
            status: 'failed',
            errorDetail: abortMsg,
          });
        }
        break;
      }
    }

    // Inter-message delay — 100 ms → 10 msg/s.
    await sleep(MSG_DELAY_MS);

    // Batch boundary every BATCH_SIZE messages: persist what we have so far
    // (survives a timeout), then pause (unless it's the last message).
    const isEndOfBatch = (i + 1) % BATCH_SIZE === 0;
    const isLastMsg    = i === recipientsToSend.length - 1;
    if (isEndOfBatch) {
      await flushLog();
      if (!isLastMsg) {
        console.log(`[WhatsApp] Batch pause after ${i + 1} messages — resuming in ${BATCH_PAUSE_MS / 1000} s`);
        await sleep(BATCH_PAUSE_MS);
      }
    }
  }

  // 5. Persist any remaining log entries.
  await flushLog();

  return { sentCount, failedCount, skippedCount, errors };
}
