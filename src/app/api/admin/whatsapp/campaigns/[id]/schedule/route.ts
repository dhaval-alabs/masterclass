import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignById, updateWhatsAppCampaign } from '@/lib/db';
import { fireWhatsAppCampaign } from '@/lib/whatsapp-campaign';

// PATCH /api/admin/whatsapp/campaigns/:id/schedule
// Reschedule a scheduled campaign to a new future time.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = (body?.scheduledFor as string | undefined)?.trim();
  if (!raw) return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 });

  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return NextResponse.json({ error: 'scheduledFor is not a valid date' }, { status: 400 });
  if (when.getTime() <= Date.now() + 30_000) return NextResponse.json({ error: 'scheduledFor must be at least a minute in the future' }, { status: 400 });

  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    await updateWhatsAppCampaign(id, { status: 'scheduled', scheduledFor: when.toISOString() });
    return NextResponse.json({ success: true, scheduledFor: when.toISOString(), message: `Rescheduled for ${when.toLocaleString()}.` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/admin/whatsapp/campaigns/:id/schedule
// Cancel a scheduled campaign — reverts it to draft so it will NOT fire.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'scheduled') {
      return NextResponse.json({ error: `Only scheduled campaigns can be cancelled (this one is "${campaign.status}").` }, { status: 409 });
    }
    await updateWhatsAppCampaign(id, { status: 'draft', scheduledFor: null });
    return NextResponse.json({ success: true, message: 'Schedule cancelled — reverted to draft.' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/admin/whatsapp/campaigns/:id/schedule
// Send now — fire a scheduled (or draft) campaign immediately instead of waiting.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await getWhatsAppCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    const result = await fireWhatsAppCampaign(campaign);
    return NextResponse.json({ success: result.status !== 'failed', ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
