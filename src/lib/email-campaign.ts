// Fire an email campaign — shared by "send now" and the scheduled-broadcast cron.
//
// Mirrors fireWhatsAppCampaign in whatsapp-campaign.ts. Lives in its own module
// (not lib/email.ts) because it depends on the DB layer, while lib/email.ts is
// the transport and stays free of it.

import {
  getEmailRecipients,
  updateEmailCampaign,
  getActiveWebinarSession,
  type EmailCampaign,
} from '@/lib/db';
import { sendCampaignEmails } from '@/lib/email';

export interface FireEmailResult {
  status: EmailCampaign['status'];
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

export async function fireEmailCampaign(campaign: EmailCampaign): Promise<FireEmailResult> {
  // Scope to the campaign's own session when it has one, so a broadcast
  // scheduled for a past cohort does not silently pick up the current one.
  const sessionId = campaign.sessionId ?? (await getActiveWebinarSession())?.id ?? null;
  const recipients = await getEmailRecipients(campaign.audience, sessionId);

  if (recipients.length === 0) {
    // Nothing to send is not a failure, but it must not stay 'scheduled' or the
    // cron would retry it every five minutes forever.
    await updateEmailCampaign(campaign.id, {
      status: 'sent',
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      scheduledFor: null,
      errorSummary: 'No recipients matched the audience at send time.',
      sentAt: new Date().toISOString(),
    });
    return { status: 'sent', totalRecipients: 0, sentCount: 0, failedCount: 0, errors: [] };
  }

  await updateEmailCampaign(campaign.id, {
    status: 'sending',
    totalRecipients: recipients.length,
  });

  try {
    const result = await sendCampaignEmails({
      campaignId: campaign.id,
      subject: campaign.subject,
      bodyText: campaign.bodyText,
      bodyHtml: campaign.bodyHtml,
      bannerUrl: campaign.bannerUrl,
      recipients,
    });

    const status: EmailCampaign['status'] =
      result.failedCount === 0 ? 'sent' :
      result.sentCount === 0   ? 'failed' :
                                 'partial';

    await updateEmailCampaign(campaign.id, {
      status,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errorSummary: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      // Clear the schedule so a fired campaign is never re-fired.
      scheduledFor: null,
      sentAt: new Date().toISOString(),
    });

    return { status, totalRecipients: recipients.length, ...result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Leave scheduledFor cleared: a transport outage should surface as a failed
    // campaign an admin can retry, not an infinite cron loop.
    await updateEmailCampaign(campaign.id, {
      status: 'failed',
      errorSummary: msg.slice(0, 300),
      scheduledFor: null,
    });
    return { status: 'failed', totalRecipients: recipients.length, sentCount: 0, failedCount: recipients.length, errors: [msg] };
  }
}
