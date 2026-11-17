export const maxDuration = 300; // inline chunk; the cron drains the rest
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, getUnsentWhatsAppRegistrations, getQueuedWhatsAppPhoneKeys, getActiveWebinarSession, campaignAudienceSpec } from '@/lib/db';
import { startCampaignSend } from '@/lib/whatsapp-campaign';

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
    // Allowed while 'sending': new registrants keep arriving during a multi-day drain (the
    // unverified nudge especially) and shouldn't wait for it to finish. People already waiting in
    // the queue are left out, so nobody is added twice.

    const session = await getActiveWebinarSession();
    const queued = await getQueuedWhatsAppPhoneKeys(campaign.id);
    const newRecipients = (await getUnsentWhatsAppRegistrations(campaign.id, campaignAudienceSpec(campaign, session?.id ?? null)))
      .filter(r => !queued.has(r.phone.replace(/\D/g, '').slice(-10)));

    if (newRecipients.length === 0) {
      return NextResponse.json({ success: true, sentCount: 0, message: queued.size ? `No new recipients — everyone else has received it or is already queued (${queued.size} waiting).` : 'No new recipients — everyone in this audience has already received this campaign.' });
    }

    // Append the new recipients to the campaign total and send via the queue.
    const r = await startCampaignSend(campaign, newRecipients, { headerImageUrl: overrideImage, totalMode: 'add' });
    return NextResponse.json({ success: r.status !== 'failed', sentCount: r.sentNow, queuedRemaining: r.queuedRemaining, message: r.message });
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
    const queued = await getQueuedWhatsAppPhoneKeys(campaign.id);
    const newRecipients = (await getUnsentWhatsAppRegistrations(campaign.id, campaignAudienceSpec(campaign, session?.id ?? null)))
      .filter(r => !queued.has(r.phone.replace(/\D/g, '').slice(-10)));

    return NextResponse.json({
      newCount: newRecipients.length,
      samples: newRecipients.slice(0, 5).map(r => ({ phone: r.phone, name: r.fullName })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
