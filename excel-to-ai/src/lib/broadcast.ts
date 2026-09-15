// Programmatic broadcasting core — shared by the API route (/api/broadcast).
//
// Exposes one entry point, runBroadcast(), that can drive BOTH channels
// (WhatsApp + Email) in THREE modes:
//   • campaign   — trigger an existing campaign by id (recomputes its audience)
//   • audience   — build + send a fresh campaign to an audience filter
//   • recipients — send to an explicit recipient list (transactional-style)
//
// It deliberately reuses the exact same building blocks the admin UI uses, so
// sends inherit the queue, daily cap, opt-outs, per-recipient log, and Meta
// dedup with zero divergence:
//   WhatsApp → createWhatsAppCampaign + startCampaignSend / fireWhatsAppCampaign
//   Email    → createEmailCampaign + sendCampaignEmails  (immediate, like admin)

import {
  getActiveWebinarSession,
  getEmailRecipients,
  createWhatsAppCampaign,
  getWhatsAppCampaignById,
  createEmailCampaign,
  getEmailCampaignById,
  updateEmailCampaign,
  type WhatsAppCampaign,
  type EmailCampaign,
} from './db';
import { startCampaignSend, fireWhatsAppCampaign } from './whatsapp-campaign';
import { sendCampaignEmails } from './email';

export type BroadcastChannel = 'whatsapp' | 'email';
export type BroadcastMode = 'campaign' | 'audience' | 'recipients';
export type Audience = 'verified' | 'unverified' | 'all';

export interface BroadcastInput {
  channel: BroadcastChannel;
  mode: BroadcastMode;

  // mode = 'campaign'
  campaignId?: string;

  // mode = 'audience'
  audience?: Audience;

  // mode = 'recipients'
  recipients?: Array<{ phone?: string; email?: string; name?: string }>;

  // WhatsApp content (audience | recipients modes)
  templateName?: string;
  languageCode?: string;
  variables?: string[];
  headerImageUrl?: string | null;

  // Email content (audience | recipients modes)
  subject?: string;
  bodyText?: string;
  bodyHtml?: string | null;
  bannerUrl?: string | null;

  // WhatsApp only — defer to the scheduled-send cron instead of sending now.
  scheduledFor?: string | null;
}

export interface BroadcastResult {
  success: boolean;
  channel: BroadcastChannel;
  mode: BroadcastMode;
  campaignId?: string;
  status?: WhatsAppCampaign['status'] | EmailCampaign['status'] | 'scheduled';
  totalRecipients?: number;
  sent?: number;
  failed?: number;
  queuedRemaining?: number;
  message: string;
}

export class BroadcastError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const VALID_AUDIENCES: Audience[] = ['verified', 'unverified', 'all'];

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new BroadcastError(message);
}

// ───────────────────────────── WhatsApp ─────────────────────────────

async function runWhatsApp(input: BroadcastInput): Promise<BroadcastResult> {
  const session = await getActiveWebinarSession();
  const sessionId = session?.id ?? null;

  // ── Trigger an existing campaign (recomputes audience, like the cron) ──
  if (input.mode === 'campaign') {
    assert(input.campaignId, 'campaignId is required for mode "campaign".');
    const campaign = await getWhatsAppCampaignById(input.campaignId!);
    assert(campaign, `WhatsApp campaign ${input.campaignId} not found.`);
    const r = await fireWhatsAppCampaign(campaign!);
    return {
      success: true, channel: 'whatsapp', mode: 'campaign', campaignId: campaign!.id,
      status: r.status, totalRecipients: r.totalRecipients, sent: r.sentCount, failed: r.failedCount,
      message: r.message,
    };
  }

  // Content is required for the build-and-send modes.
  assert(input.templateName?.trim(), 'templateName is required.');
  const languageCode = input.languageCode?.trim() || 'en_US';
  const variables = Array.isArray(input.variables) ? input.variables : [];

  // ── Resolve recipients ──
  let recipients: { phone: string; fullName: string }[];
  let audience: Audience;

  if (input.mode === 'audience') {
    assert(input.audience && VALID_AUDIENCES.includes(input.audience), `audience must be one of ${VALID_AUDIENCES.join(', ')}.`);
    audience = input.audience!;
    const all = await getEmailRecipients(audience, sessionId);
    recipients = all.filter(r => r.phone?.trim()).map(r => ({ phone: r.phone, fullName: r.fullName }));
  } else {
    // mode = 'recipients'
    assert(Array.isArray(input.recipients) && input.recipients.length > 0, 'recipients must be a non-empty array.');
    assert(!input.scheduledFor, 'scheduledFor is not supported with mode "recipients" (the scheduler recomputes from an audience). Use mode "audience" to schedule.');
    audience = 'all';
    recipients = input.recipients!
      .filter(r => r.phone?.trim())
      .map(r => ({ phone: r.phone!.trim(), fullName: (r.name ?? '').trim() }));
    assert(recipients.length > 0, 'No recipients with a valid phone number.');
  }

  if (recipients.length === 0) {
    throw new BroadcastError('No recipients with phone numbers matched.');
  }

  // ── Scheduled (audience mode only): persist as 'scheduled', cron fires it ──
  if (input.scheduledFor) {
    const when = new Date(input.scheduledFor);
    assert(!isNaN(when.getTime()) && when.getTime() > Date.now(), 'scheduledFor must be a valid future ISO timestamp.');
    const campaign = await createWhatsAppCampaign({
      sessionId, templateName: input.templateName!.trim(), languageCode, audience, variables,
      headerImageUrl: input.headerImageUrl ?? null, totalRecipients: recipients.length,
      status: 'scheduled', scheduledFor: when.toISOString(),
    });
    return {
      success: true, channel: 'whatsapp', mode: input.mode, campaignId: campaign.id,
      status: 'scheduled', totalRecipients: recipients.length,
      message: `Scheduled ${recipients.length} recipient(s) for ${when.toISOString()}.`,
    };
  }

  // ── Send now ──
  const campaign = await createWhatsAppCampaign({
    sessionId, templateName: input.templateName!.trim(), languageCode, audience, variables,
    headerImageUrl: input.headerImageUrl ?? null, totalRecipients: recipients.length, status: 'sending',
  });
  const r = await startCampaignSend(campaign, recipients, { totalMode: 'set', headerImageUrl: input.headerImageUrl ?? null });
  return {
    success: true, channel: 'whatsapp', mode: input.mode, campaignId: campaign.id,
    status: r.status, totalRecipients: recipients.length, sent: r.sentNow, queuedRemaining: r.queuedRemaining,
    message: r.message,
  };
}

// ────────────────────────────── Email ───────────────────────────────

async function runEmail(input: BroadcastInput): Promise<BroadcastResult> {
  assert(!input.scheduledFor, 'Scheduling is not supported for email broadcasts (no email queue). Send now or schedule via WhatsApp.');
  const session = await getActiveWebinarSession();
  const sessionId = session?.id ?? null;

  // ── Trigger an existing (e.g. draft) campaign ──
  if (input.mode === 'campaign') {
    assert(input.campaignId, 'campaignId is required for mode "campaign".');
    const campaign = await getEmailCampaignById(input.campaignId!);
    assert(campaign, `Email campaign ${input.campaignId} not found.`);
    const all = await getEmailRecipients(campaign!.audience, sessionId);
    const recipients = all.filter(r => r.email?.trim()).map(r => ({ email: r.email, fullName: r.fullName }));
    return sendEmailAndFinalize(campaign!, recipients);
  }

  // Content required for build-and-send modes.
  assert(input.subject?.trim(), 'subject is required.');
  assert(input.bodyText?.trim(), 'bodyText is required.');

  // ── Resolve recipients ──
  let recipients: { email: string; fullName: string }[];
  let audience: Audience;

  if (input.mode === 'audience') {
    assert(input.audience && VALID_AUDIENCES.includes(input.audience), `audience must be one of ${VALID_AUDIENCES.join(', ')}.`);
    audience = input.audience!;
    const all = await getEmailRecipients(audience, sessionId);
    recipients = all.filter(r => r.email?.trim()).map(r => ({ email: r.email, fullName: r.fullName }));
  } else {
    assert(Array.isArray(input.recipients) && input.recipients.length > 0, 'recipients must be a non-empty array.');
    audience = 'all';
    recipients = input.recipients!
      .filter(r => r.email?.trim())
      .map(r => ({ email: r.email!.trim(), fullName: (r.name ?? '').trim() }));
    assert(recipients.length > 0, 'No recipients with a valid email address.');
  }

  if (recipients.length === 0) {
    throw new BroadcastError('No recipients with email addresses matched.');
  }

  const campaign = await createEmailCampaign({
    sessionId, subject: input.subject!.trim(), bodyText: input.bodyText!.trim(),
    bodyHtml: input.bodyHtml ?? null, bannerUrl: input.bannerUrl ?? null,
    audience, totalRecipients: recipients.length, status: 'sending',
  });
  return sendEmailAndFinalize(campaign, recipients, input);
}

// Shared: send the email batch, then write back counters/status (mirrors the
// admin email route's immediate-send finalisation).
async function sendEmailAndFinalize(
  campaign: EmailCampaign,
  recipients: { email: string; fullName: string }[],
  contentOverride?: BroadcastInput,
): Promise<BroadcastResult> {
  if (recipients.length === 0) {
    await updateEmailCampaign(campaign.id, { status: 'sent', sentCount: 0, failedCount: 0, totalRecipients: 0, sentAt: new Date().toISOString(), errorSummary: 'No recipients matched at send time.' });
    return { success: true, channel: 'email', mode: 'campaign', campaignId: campaign.id, status: 'sent', totalRecipients: 0, sent: 0, failed: 0, message: 'No recipients matched.' };
  }

  const result = await sendCampaignEmails({
    campaignId: campaign.id,
    subject:    contentOverride?.subject?.trim() ?? campaign.subject,
    bodyText:   contentOverride?.bodyText?.trim() ?? campaign.bodyText,
    bodyHtml:   contentOverride?.bodyHtml ?? campaign.bodyHtml,
    bannerUrl:  contentOverride?.bannerUrl ?? campaign.bannerUrl,
    recipients,
  });

  const status: EmailCampaign['status'] =
    result.sentCount > 0 ? (result.failedCount === 0 ? 'sent' : 'partial') :
    result.failedCount > 0 ? 'failed' : 'sent';

  await updateEmailCampaign(campaign.id, {
    status,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
    totalRecipients: recipients.length,
    sentAt: new Date().toISOString(),
    errorSummary: result.failedCount > 0 ? (result.errors.slice(0, 3).join(' | ') || `${result.failedCount} failed`) : null,
  });

  return {
    success: true, channel: 'email', mode: 'campaign', campaignId: campaign.id, status,
    totalRecipients: recipients.length, sent: result.sentCount, failed: result.failedCount,
    message: `Sent to ${result.sentCount} recipient(s)${result.failedCount ? `, ${result.failedCount} failed` : ''}.`,
  };
}

// ──────────────────────────── Entry point ───────────────────────────

export async function runBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  assert(input && typeof input === 'object', 'Request body must be a JSON object.');
  assert(input.channel === 'whatsapp' || input.channel === 'email', 'channel must be "whatsapp" or "email".');
  assert(['campaign', 'audience', 'recipients'].includes(input.mode), 'mode must be "campaign", "audience", or "recipients".');

  const result = input.channel === 'whatsapp' ? await runWhatsApp(input) : await runEmail(input);
  return { ...result, mode: input.mode };
}
