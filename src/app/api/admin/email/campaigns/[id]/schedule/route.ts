// Schedule / reschedule / cancel / send-now for a one-off email broadcast.
// Mirrors the WhatsApp equivalent so both channels behave identically.

export const maxDuration = 300; // send-now dispatches the whole audience
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEmailCampaignById, updateEmailCampaign } from '@/lib/db';
import { fireEmailCampaign } from '@/lib/email-campaign';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function guard(req: NextRequest) {
  if (!assertSameOrigin(req).ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const session = await verifyAdminSession((await cookies()).get('admin_session')?.value);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  return null;
}

// PATCH — schedule or reschedule for a future time.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = (body?.scheduledFor as string | undefined)?.trim();
  if (!raw) return NextResponse.json({ error: 'scheduledFor is required' }, { status: 400 });

  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: 'scheduledFor is not a valid date' }, { status: 400 });
  }
  // The cron runs every 5 minutes, so anything inside the next minute would
  // fire almost immediately and look like the schedule was ignored.
  if (when.getTime() <= Date.now() + 60_000) {
    return NextResponse.json({ error: 'scheduledFor must be at least a minute in the future' }, { status: 400 });
  }

  try {
    const campaign = await getEmailCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    await updateEmailCampaign(id, { status: 'scheduled', scheduledFor: when.toISOString() });
    return NextResponse.json({ success: true, scheduledFor: when.toISOString() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — cancel a schedule, reverting to draft so it will NOT fire.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const campaign = await getEmailCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'scheduled') {
      return NextResponse.json({ error: `Nothing to cancel (campaign is "${campaign.status}").` }, { status: 409 });
    }
    await updateEmailCampaign(id, { status: 'draft', scheduledFor: null });
    return NextResponse.json({ success: true, message: 'Schedule cancelled — reverted to draft.' });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — send now, instead of waiting for the scheduled time.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const campaign = await getEmailCampaignById(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status === 'sending') return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 });

    const result = await fireEmailCampaign(campaign);
    return NextResponse.json({ success: result.status !== 'failed', ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
