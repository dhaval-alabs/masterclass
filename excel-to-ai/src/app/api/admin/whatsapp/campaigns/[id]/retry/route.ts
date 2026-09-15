export const maxDuration = 300; // inline chunk; the cron drains the rest
import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, getEmailRecipients, getActiveWebinarSession } from '@/lib/db';
import { startCampaignSend } from '@/lib/whatsapp-campaign';

// POST /api/admin/whatsapp/campaigns/:id/retry — re-send to the WHOLE audience.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Optional header-image override — lets you fix campaigns created without an image.
  const overrideImage = await req.json().then(b => (b?.headerImageUrl as string | undefined)?.trim() || null).catch(() => null);

  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });
    if (campaign.status === 'sent') return NextResponse.json({ error: 'Campaign already sent successfully' }, { status: 409 });

    const session = await getActiveWebinarSession();
    const allRecipients = await getEmailRecipients(campaign.audience, session?.id ?? null);
    const recipients = allRecipients.filter(r => r.phone?.trim());

    if (recipients.length === 0) {
      return NextResponse.json({ success: false, message: 'No recipients with phone numbers found.' });
    }

    const r = await startCampaignSend(campaign, recipients, { headerImageUrl: overrideImage, totalMode: 'set' });
    return NextResponse.json({ success: r.status !== 'failed', sentCount: r.sentNow, queuedRemaining: r.queuedRemaining, message: r.message });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
