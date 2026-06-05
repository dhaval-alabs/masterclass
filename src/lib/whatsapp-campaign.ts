import {
  getEmailRecipients,
  getActiveWebinarSession,
  getWhatsAppCampaignById,
  updateWhatsAppCampaign,
  enqueueWhatsAppRecipients,
  claimPendingWhatsAppQueue,
  countPendingWhatsAppQueue,
  markWhatsAppQueueProcessed,
  getWhatsAppCampaignLogCounts,
  getWhatsAppDailySentCount,
  type WhatsAppCampaign,
} from './db';
import { sendWhatsAppCampaign, getBroadcastCreds } from './whatsapp';

// How many recipients we attempt per chunk. Default 80 fits Vercel Hobby's 60s
// function limit (~0.4s/recipient + batch pauses ≈ 45s); raise WA_SEND_CHUNK on
// Pro (300s) to e.g. 250 for faster drains. Sends larger than this spill to the
// queue and drain over subsequent cron ticks.
const CHUNK = Math.max(1, parseInt(process.env.WA_SEND_CHUNK ?? '80', 10));
const INLINE_CHUNK = CHUNK; // attempted within the request that triggered the send
const CRON_CHUNK   = CHUNK; // attempted per campaign per cron tick

export interface DrainResult {
  processedNow: number;
  sentNow: number;
  failedNow: number;
  queuedRemaining: number;
  sentTotal: number;
  failedTotal: number;
  status: WhatsAppCampaign['status'];
}

export interface StartResult {
  enqueued: number;
  sentNow: number;
  queuedRemaining: number;
  status: WhatsAppCampaign['status'];
  message: string;
}

/**
 * Sends one chunk of a campaign's pending queue (respecting the daily cap), then
 * recomputes the campaign's counters from the send log. Leaves the rest pending
 * for the next cron tick. Used both inline (at send time) and by the cron.
 *
 * Counters come from the deduped log (always accurate); totalRecipients is left
 * untouched (it's set at enqueue time to the full audience size).
 */
export async function drainWhatsAppCampaignQueue(
  campaignId: string,
  opts: { maxToSend?: number; headerImageUrl?: string | null } = {},
): Promise<DrainResult> {
  const maxToSend = opts.maxToSend ?? CRON_CHUNK;
  const campaign = await getWhatsAppCampaignById(campaignId);
  if (!campaign) {
    return { processedNow: 0, sentNow: 0, failedNow: 0, queuedRemaining: 0, sentTotal: 0, failedTotal: 0, status: 'failed' };
  }
  const headerImageUrl = opts.headerImageUrl ?? campaign.headerImageUrl;

  // Only claim up to the remaining daily headroom — overflow stays pending and
  // auto-resumes on a later tick once the daily count resets.
  const dailyLimit = parseInt(process.env.WA_DAILY_LIMIT ?? '900', 10);
  const sentToday  = await getWhatsAppDailySentCount();
  const headroom   = Math.max(0, dailyLimit - sentToday);
  const claimCount = Math.min(maxToSend, headroom);

  let sentNow = 0;
  let failedNow = 0;
  let processedNow = 0;
  let lastErrors: string[] = [];

  if (claimCount > 0) {
    const chunk = await claimPendingWhatsAppQueue(campaignId, claimCount);
    if (chunk.length > 0) {
      const result = await sendWhatsAppCampaign({
        campaignId,
        templateName: campaign.templateName,
        languageCode: campaign.languageCode,
        variables: campaign.variables,
        recipients: chunk.map(c => ({ phone: c.phone, fullName: c.fullName })),
        headerImageUrl,
      });
      await markWhatsAppQueueProcessed(chunk.map(c => c.id), 'sent');
      sentNow = result.sentCount;
      failedNow = result.failedCount;
      processedNow = chunk.length;
      lastErrors = result.errors;
    }
  }

  // Recompute counters from the log (deduped), keep totalRecipients fixed.
  const counts = await getWhatsAppCampaignLogCounts(campaignId);
  const queuedRemaining = await countPendingWhatsAppQueue(campaignId);

  const status: WhatsAppCampaign['status'] =
    queuedRemaining > 0      ? 'sending' :
    counts.sent > 0          ? (counts.failed === 0 ? 'sent' : 'partial') :
    counts.failed > 0        ? 'failed' : 'sent';

  // errorSummary: while still draining show progress; when done show real failures.
  let errorSummary: string | null | undefined;
  if (queuedRemaining > 0) {
    errorSummary = headroom <= 0
      ? `Daily limit (${dailyLimit}) reached — ${queuedRemaining} queued, resuming automatically after it resets.`
      : `${queuedRemaining} queued — sending in the background.`;
  } else {
    errorSummary = counts.failed > 0
      ? (lastErrors.length ? lastErrors.slice(0, 3).join(' | ') : `${counts.failed} recipient(s) failed`)
      : null;
  }

  await updateWhatsAppCampaign(campaignId, {
    status,
    sentCount: counts.sent,
    failedCount: counts.failed,
    sentAt: campaign.sentAt ?? new Date().toISOString(),
    errorSummary,
  });

  return { processedNow, sentNow, failedNow, queuedRemaining, sentTotal: counts.sent, failedTotal: counts.failed, status };
}

/**
 * Enqueues recipients for a campaign and drains the first chunk inline so small
 * sends finish in the request; the remainder is drained by the cron. `totalMode`
 * controls how totalRecipients is adjusted: 'set' (fresh send), 'add' (top-up /
 * send-to-new), or 'keep' (retry — re-sending existing recipients).
 */
export async function startCampaignSend(
  campaign: WhatsAppCampaign,
  recipients: { phone: string; fullName: string }[],
  opts: { headerImageUrl?: string | null; totalMode?: 'set' | 'add' | 'keep' } = {},
): Promise<StartResult> {
  const creds = getBroadcastCreds();
  if (!creds.waAccessToken || !creds.waPhoneId) {
    return { enqueued: 0, sentNow: 0, queuedRemaining: 0, status: campaign.status, message: 'WhatsApp broadcast credentials not configured.' };
  }

  const enqueued = await enqueueWhatsAppRecipients(campaign.id, recipients);
  if (enqueued === 0) {
    return { enqueued: 0, sentNow: 0, queuedRemaining: await countPendingWhatsAppQueue(campaign.id), status: campaign.status, message: 'No valid recipients to send.' };
  }

  const totalMode = opts.totalMode ?? 'set';
  const newTotal =
    totalMode === 'set' ? recipients.length :
    totalMode === 'add' ? campaign.totalRecipients + enqueued :
    campaign.totalRecipients;

  await updateWhatsAppCampaign(campaign.id, {
    status: 'sending',
    totalRecipients: newTotal,
    ...(opts.headerImageUrl ? { headerImageUrl: opts.headerImageUrl } : {}),
  });

  const drain = await drainWhatsAppCampaignQueue(campaign.id, { maxToSend: INLINE_CHUNK, headerImageUrl: opts.headerImageUrl });

  // Report THIS action's numbers (how many we just targeted), not the campaign
  // cumulative — otherwise "Send to new" of 6 people would read "Sent to 274".
  const s = enqueued === 1 ? '' : 's';
  return {
    enqueued,
    sentNow: drain.sentNow,
    queuedRemaining: drain.queuedRemaining,
    status: drain.status,
    message: drain.queuedRemaining > 0
      ? `Queued ${enqueued} recipient${s} — ${drain.sentNow} sent now, ${drain.queuedRemaining} finishing in the background.`
      : `Sent to ${drain.sentNow} recipient${drain.sentNow !== 1 ? 's' : ''}${drain.failedNow ? `, ${drain.failedNow} failed` : ''}.`,
  };
}

export interface FireResult {
  status: WhatsAppCampaign['status'];
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
  message: string;
}

// Fires a scheduled campaign: recomputes the audience fresh (so late registrants
// are included), then enqueues + drains via the queue. Shared by the cron and
// the manual "Send now" action.
export async function fireWhatsAppCampaign(campaign: WhatsAppCampaign): Promise<FireResult> {
  const creds = getBroadcastCreds();
  if (!creds.waAccessToken || !creds.waPhoneId) {
    await updateWhatsAppCampaign(campaign.id, { status: 'draft', errorSummary: 'WhatsApp broadcast credentials not configured at fire time.' });
    return { status: 'draft', sentCount: 0, failedCount: 0, totalRecipients: 0, message: 'Broadcast credentials not configured — reverted to draft.' };
  }

  const session = await getActiveWebinarSession();
  const all = await getEmailRecipients(campaign.audience, session?.id ?? null);
  const recipients = all.filter(r => r.phone?.trim());

  // Clear the schedule so the cron's scheduled-pass doesn't re-fire it.
  await updateWhatsAppCampaign(campaign.id, { scheduledFor: null });

  if (recipients.length === 0) {
    await updateWhatsAppCampaign(campaign.id, { status: 'sent', totalRecipients: 0, sentAt: new Date().toISOString(), errorSummary: 'No recipients with phone numbers at fire time.' });
    return { status: 'sent', sentCount: 0, failedCount: 0, totalRecipients: 0, message: 'No recipients with phone numbers.' };
  }

  const r = await startCampaignSend(campaign, recipients, { totalMode: 'set' });
  return {
    status: r.status,
    sentCount: r.sentNow,
    failedCount: 0,
    totalRecipients: recipients.length,
    message: r.message,
  };
}
