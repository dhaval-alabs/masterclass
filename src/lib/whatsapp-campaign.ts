import {
  getEmailRecipients,
  getActiveWebinarSession,
  updateWhatsAppCampaign,
  type WhatsAppCampaign,
} from './db';
import { sendWhatsAppCampaign, getBroadcastCreds } from './whatsapp';

export interface FireResult {
  status: WhatsAppCampaign['status'];
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
  message: string;
}

// Sends a campaign right now: recomputes the audience fresh (so registrants who
// joined after scheduling are included), sends via the broadcast number, and
// records the final counts. Shared by the cron and the manual "Send now" action.
export async function fireWhatsAppCampaign(campaign: WhatsAppCampaign): Promise<FireResult> {
  const creds = getBroadcastCreds();
  if (!creds.waAccessToken || !creds.waPhoneId) {
    await updateWhatsAppCampaign(campaign.id, {
      status: 'draft',
      errorSummary: 'WhatsApp broadcast credentials not configured at fire time.',
    });
    return { status: 'draft', sentCount: 0, failedCount: 0, totalRecipients: 0, message: 'Broadcast credentials not configured — reverted to draft.' };
  }

  const session = await getActiveWebinarSession();
  const all = await getEmailRecipients(campaign.audience, session?.id ?? null);
  const recipients = all.filter(r => r.phone?.trim());

  if (recipients.length === 0) {
    await updateWhatsAppCampaign(campaign.id, {
      status: 'sent',
      totalRecipients: 0,
      sentAt: new Date().toISOString(),
      scheduledFor: null,
      errorSummary: 'No recipients with phone numbers at fire time.',
    });
    return { status: 'sent', sentCount: 0, failedCount: 0, totalRecipients: 0, message: 'No recipients with phone numbers.' };
  }

  await updateWhatsAppCampaign(campaign.id, { status: 'sending', totalRecipients: recipients.length });

  const result = await sendWhatsAppCampaign({
    campaignId: campaign.id,
    templateName: campaign.templateName,
    languageCode: campaign.languageCode,
    variables: campaign.variables,
    recipients,
    headerImageUrl: campaign.headerImageUrl,
  });

  const status: WhatsAppCampaign['status'] =
    result.failedCount === 0 ? 'sent' :
    result.sentCount   === 0 ? 'failed' : 'partial';

  await updateWhatsAppCampaign(campaign.id, {
    status,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
    totalRecipients: recipients.length,
    errorSummary: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
    sentAt: new Date().toISOString(),
    scheduledFor: null,
  });

  return {
    status,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
    totalRecipients: recipients.length,
    message:
      status === 'sent'    ? `Sent to ${result.sentCount} recipients.` :
      status === 'partial' ? `Sent to ${result.sentCount}/${recipients.length}. ${result.failedCount} failed.` :
                             `Send failed for all ${recipients.length} recipients.`,
  };
}
