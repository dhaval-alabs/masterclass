export const maxDuration = 300; // per-recipient send loop can run minutes
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, getFailedWhatsAppRecipients, updateWhatsAppCampaign, getActiveWebinarSession } from '@/lib/db';
import { sendWhatsAppCampaign } from '@/lib/whatsapp';

// POST /api/admin/whatsapp/campaigns/:id/retry-failed
// Re-sends ONLY to recipients who failed in this campaign and are still in the
// audience (never to people who already succeeded or have since verified).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const overrideImage = await req.json().then(b => (b?.headerImageUrl as string | undefined)?.trim() || null).catch(() => null);

  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    const headerImageUrl = overrideImage ?? campaign.headerImageUrl;
    const session = await getActiveWebinarSession();
    const failed = await getFailedWhatsAppRecipients(campaign.id, campaign.audience, session?.id ?? null);

    if (failed.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No failed recipients to retry (everyone failed has either succeeded since or left the audience).' });
    }

    const result = await sendWhatsAppCampaign({
      campaignId: campaign.id,
      templateName: campaign.templateName,
      languageCode: campaign.languageCode,
      variables: campaign.variables,
      recipients: failed,
      headerImageUrl,
    });

    // Successes move out of failed into sent; remaining failures stay failed.
    const newSent   = campaign.sentCount + result.sentCount;
    const newFailed = Math.max(0, campaign.failedCount - result.sentCount);
    const finalStatus =
      newFailed === 0 ? 'sent'   :
      newSent   === 0 ? 'failed' : 'partial';

    await updateWhatsAppCampaign(campaign.id, {
      status:       finalStatus,
      sentCount:    newSent,
      failedCount:  newFailed,
      // Clear any stale error from a past attempt when this retry had no errors.
      errorSummary: result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:       campaign.sentAt ?? new Date().toISOString(),
      ...(overrideImage ? { headerImageUrl } : {}),
    });

    return NextResponse.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message: `Retried ${failed.length} failed — ${result.sentCount} sent, ${result.failedCount} still failed.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — preview how many failed recipients can be retried.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    const session = await getActiveWebinarSession();
    const failed = await getFailedWhatsAppRecipients(campaign.id, campaign.audience, session?.id ?? null);
    return NextResponse.json({ failedCount: failed.length, samples: failed.slice(0, 5).map(r => ({ phone: r.phone, name: r.fullName })) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
