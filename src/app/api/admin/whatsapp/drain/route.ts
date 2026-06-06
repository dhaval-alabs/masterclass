export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { getCampaignIdsWithPendingQueue } from '@/lib/db';
import { drainWhatsAppCampaignQueue } from '@/lib/whatsapp-campaign';

// POST /api/admin/whatsapp/drain
// Admin-authed (via middleware) drain of ONE campaign's chunk. The WhatsApp tab
// calls this repeatedly while a campaign is sending, so the queue drains while an
// admin has the page open — no external cron required. (The cron also drains.)
export async function POST() {
  try {
    const ids = await getCampaignIdsWithPendingQueue();
    if (ids.length === 0) {
      return NextResponse.json({ drained: 0, sent: 0, pendingCampaigns: 0, stillQueued: 0 });
    }
    const r = await drainWhatsAppCampaignQueue(ids[0]);
    const remaining = await getCampaignIdsWithPendingQueue();
    return NextResponse.json({ drained: 1, sent: r.sentNow, stillQueued: r.queuedRemaining, pendingCampaigns: remaining.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
