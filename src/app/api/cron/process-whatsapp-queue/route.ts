export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getDueScheduledWhatsAppCampaigns, getCampaignIdsWithPendingQueue } from '@/lib/db';
import { fireWhatsAppCampaign, drainWhatsAppCampaignQueue } from '@/lib/whatsapp-campaign';

// POST /api/cron/process-whatsapp-queue
// Called by Vercel Cron every 5 minutes. Two passes:
//   1. Fire any scheduled campaign whose time has passed (enqueues its audience).
//   2. Drain a chunk of every campaign that still has pending recipients.
// Both respect the daily cap; work left over is picked up on the next tick, so
// any audience size drains safely over multiple ticks without ever timing out.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  // Stop starting new work past this; next tick continues. 45s keeps us safely
  // under Vercel Hobby's 60s function limit (Pro allows more, but this is fine).
  const DEADLINE_MS = 45_000;

  try {
    // 1. Fire due scheduled campaigns.
    const due = await getDueScheduledWhatsAppCampaigns(25);
    let scheduledFired = 0;
    for (const campaign of due) {
      if (Date.now() - startedAt > DEADLINE_MS) break;
      try {
        await fireWhatsAppCampaign(campaign);
        scheduledFired++;
      } catch (err) {
        console.error(`[cron] whatsapp scheduled fire ${campaign.id} failed:`, err);
      }
    }

    // 2. Drain pending queues (includes campaigns just fired above).
    const pendingIds = await getCampaignIdsWithPendingQueue();
    let queuesDrained = 0;
    let sent = 0;
    let stillQueued = 0;
    for (const id of pendingIds) {
      if (Date.now() - startedAt > DEADLINE_MS) break;
      try {
        const r = await drainWhatsAppCampaignQueue(id);
        sent += r.sentNow;
        stillQueued += r.queuedRemaining;
        queuesDrained++;
      } catch (err) {
        console.error(`[cron] whatsapp drain ${id} failed:`, err);
      }
    }

    return NextResponse.json({ scheduledFired, queuesDrained, sent, stillQueued, pendingCampaigns: pendingIds.length });
  } catch (err) {
    console.error('[cron] process-whatsapp-queue error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
