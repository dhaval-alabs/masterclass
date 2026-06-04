import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, getUnsentWhatsAppRegistrations, updateWhatsAppCampaign, getActiveWebinarSession } from '@/lib/db';
import { sendWhatsAppCampaign } from '@/lib/whatsapp';

// POST /api/admin/whatsapp/campaigns/:id/send-new
// Sends the same campaign to recipients in the audience who haven't received it
// yet (new registrants since it was sent), and appends them to the campaign.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Optional header-image override (for campaigns created without one).
  const overrideImage = await req.json().then(b => (b?.headerImageUrl as string | undefined)?.trim() || null).catch(() => null);

  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    const headerImageUrl = overrideImage ?? campaign.headerImageUrl;
    const session = await getActiveWebinarSession();
    const newRecipients = await getUnsentWhatsAppRegistrations(campaign.id, campaign.audience, session?.id ?? null);

    if (newRecipients.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No new recipients — everyone in this audience has already received this campaign.' });
    }

    const result = await sendWhatsAppCampaign({
      campaignId: campaign.id,
      templateName: campaign.templateName,
      languageCode: campaign.languageCode,
      variables: campaign.variables,
      recipients: newRecipients,
      headerImageUrl,
    });

    // Add to existing totals (cumulative across the original send + this top-up).
    const newTotal  = campaign.totalRecipients + result.sentCount + result.failedCount;
    const newSent   = campaign.sentCount + result.sentCount;
    const newFailed = campaign.failedCount + result.failedCount;
    const finalStatus =
      newFailed === 0 ? 'sent'   :
      newSent   === 0 ? 'failed' : 'partial';

    await updateWhatsAppCampaign(campaign.id, {
      status:          finalStatus,
      sentCount:       newSent,
      failedCount:     newFailed,
      totalRecipients: newTotal,
      // Clear any stale error from a past attempt when this send had no errors.
      errorSummary:    result.errors.length ? result.errors.slice(0, 3).join(' | ') : null,
      sentAt:          campaign.sentAt ?? new Date().toISOString(),
      ...(overrideImage ? { headerImageUrl } : {}),
    });

    return NextResponse.json({
      success: result.sentCount > 0,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      errors: result.errors,
      message: `Sent to ${result.sentCount} new recipient${result.sentCount !== 1 ? 's' : ''}.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — preview how many new recipients exist without sending.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const session = await getActiveWebinarSession();
    const newRecipients = await getUnsentWhatsAppRegistrations(campaign.id, campaign.audience, session?.id ?? null);

    return NextResponse.json({
      newCount: newRecipients.length,
      samples: newRecipients.slice(0, 5).map(r => ({ phone: r.phone, name: r.fullName })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
