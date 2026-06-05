export const maxDuration = 300; // inline chunk; the cron drains the rest
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, getFailedWhatsAppRecipients, getActiveWebinarSession } from '@/lib/db';
import { startCampaignSend } from '@/lib/whatsapp-campaign';

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

    const session = await getActiveWebinarSession();
    const failed = await getFailedWhatsAppRecipients(campaign.id, campaign.audience, session?.id ?? null);

    if (failed.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: 'No failed recipients to retry (everyone failed has either succeeded since or left the audience).' });
    }

    // Re-send only the failed people; total stays (they're already counted).
    const r = await startCampaignSend(campaign, failed, { headerImageUrl: overrideImage, totalMode: 'keep' });
    return NextResponse.json({ success: r.status !== 'failed', sentCount: r.sentNow, queuedRemaining: r.queuedRemaining, message: r.message });
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
