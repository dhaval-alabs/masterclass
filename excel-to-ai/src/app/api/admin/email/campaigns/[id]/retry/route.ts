import { NextRequest, NextResponse } from 'next/server';
import { getEmailCampaignById, getEmailRecipients, updateEmailCampaign, getActiveWebinarSession } from '@/lib/db';
import { sendCampaignEmails } from '@/lib/email';

// POST /api/admin/email/campaigns/:id/retry
// Re-sends the campaign to all recipients in the original audience.
// Intended for failed or partial campaigns where sends need to be retried.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const campaign = await getEmailCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });
    if (campaign.status === 'sent') return NextResponse.json({ error: 'Campaign already sent successfully — use "Send to new" instead' }, { status: 409 });

    await updateEmailCampaign(campaign.id, { status: 'sending' });

    const session = await getActiveWebinarSession();
    const recipients = await getEmailRecipients(campaign.audience, session?.id ?? null);

    if (recipients.length === 0) {
      await updateEmailCampaign(campaign.id, { status: campaign.status });
      return NextResponse.json({ success: false, message: 'No recipients found for this audience.' });
    }

    const result = await sendCampaignEmails({
      campaignId: campaign.id,
      subject: campaign.subject,
      bodyText: campaign.bodyText,
      bodyHtml: campaign.bodyHtml,
      bannerUrl: campaign.bannerUrl,
      recipients,
    });

    const finalStatus =
      result.failedCount === 0 ? 'sent'    :
      result.sentCount   === 0 ? 'failed'  :
                                 'partial';

    await updateEmailCampaign(campaign.id, {
      status:       finalStatus,
      sentCount:    result.sentCount,
      failedCount:  result.failedCount,
      totalRecipients: recipients.length,
      errorSummary: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:       new Date().toISOString(),
    });

    return NextResponse.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message:
        finalStatus === 'sent'    ? `Retry successful — sent to all ${result.sentCount} recipients.` :
        finalStatus === 'partial' ? `Partial retry — sent to ${result.sentCount}/${recipients.length}, ${result.failedCount} failed.` :
                                    `Retry failed for all ${recipients.length} recipients.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
