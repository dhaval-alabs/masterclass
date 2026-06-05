export const maxDuration = 300; // per-recipient send loop can run minutes
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, getEmailRecipients, updateWhatsAppCampaign, getActiveWebinarSession } from '@/lib/db';
import { sendWhatsAppCampaign } from '@/lib/whatsapp';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Optional header-image override — lets you fix campaigns that were created
  // without an image (image-header templates) without recreating them.
  const overrideImage = await req.json().then(b => (b?.headerImageUrl as string | undefined)?.trim() || null).catch(() => null);

  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });
    if (campaign.status === 'sent') return NextResponse.json({ error: 'Campaign already sent successfully' }, { status: 409 });

    const headerImageUrl = overrideImage ?? campaign.headerImageUrl;
    await updateWhatsAppCampaign(campaign.id, { status: 'sending' });

    const session = await getActiveWebinarSession();
    const allRecipients = await getEmailRecipients(campaign.audience, session?.id ?? null);
    const recipients = allRecipients.filter(r => r.phone?.trim());

    if (recipients.length === 0) {
      await updateWhatsAppCampaign(campaign.id, { status: campaign.status });
      return NextResponse.json({ success: false, message: 'No recipients with phone numbers found.' });
    }

    const result = await sendWhatsAppCampaign({
      campaignId: campaign.id,
      templateName: campaign.templateName,
      languageCode: campaign.languageCode,
      variables: campaign.variables,
      recipients,
      headerImageUrl,
    });

    const finalStatus =
      result.failedCount === 0 ? 'sent'   :
      result.sentCount   === 0 ? 'failed' : 'partial';

    await updateWhatsAppCampaign(campaign.id, {
      status:          finalStatus,
      sentCount:       result.sentCount,
      failedCount:     result.failedCount,
      totalRecipients: recipients.length,
      errorSummary:    result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:          new Date().toISOString(),
      // Persist a newly-provided image so future retries/send-new reuse it.
      ...(overrideImage ? { headerImageUrl } : {}),
    });

    return NextResponse.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message:
        finalStatus === 'sent'    ? `Retry successful — sent to ${result.sentCount} recipients.` :
        finalStatus === 'partial' ? `Partial retry — ${result.sentCount}/${recipients.length} sent.` :
                                    `Retry failed for all ${recipients.length} recipients.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
