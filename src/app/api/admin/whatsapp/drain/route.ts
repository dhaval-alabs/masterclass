export const maxDuration = 300;
import { NextResponse } from 'next/server';
import { getCampaignIdsWithPendingQueue } from '@/lib/db';
import { drainWhatsAppCampaignQueue, drainWhatsAppAutoSends } from '@/lib/whatsapp-campaign';

// POST /api/admin/whatsapp/drain
// Admin-authed (via middleware) drain of ONE campaign's chunk PLUS any due
// event-triggered auto-sends. The WhatsApp tab calls this repeatedly while a
// campaign is sending, so work drains while an admin has the page open.
//
// Auto-sends are included because they were previously reachable ONLY via the
// Vercel cron, and measured against the live data that cron lands roughly every
// 2-5 hours rather than the */5 its schedule asks for — median 97 minutes late,
// worst case 5 hours. A T-1h reminder that late arrives after the webinar has
// started. Until the cron cadence is fixed this gives an admin a way to push
// the backlog through, and it costs nothing when there is none.
export async function POST() {
  try {
    const ids = await getCampaignIdsWithPendingQueue();

    let drained = 0;
    let sent = 0;
    let stillQueued = 0;
    if (ids.length > 0) {
      const r = await drainWhatsAppCampaignQueue(ids[0]);
      drained = 1;
      sent = r.sentNow;
      stillQueued = r.queuedRemaining;
    }

    // Never let an auto-send failure hide a successful campaign drain.
    let autoSends = { sent: 0, skipped: 0, failed: 0 };
    try {
      autoSends = await drainWhatsAppAutoSends();
    } catch (err) {
      console.error('[admin drain] auto-sends failed:', err);
    }

    const remaining = await getCampaignIdsWithPendingQueue();
    return NextResponse.json({ drained, sent, stillQueued, pendingCampaigns: remaining.length, autoSends });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
