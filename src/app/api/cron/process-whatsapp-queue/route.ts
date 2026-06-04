import { NextRequest, NextResponse } from 'next/server';
import { getDueScheduledWhatsAppCampaigns } from '@/lib/db';
import { fireWhatsAppCampaign } from '@/lib/whatsapp-campaign';

// POST /api/cron/process-whatsapp-queue
// Called by Vercel Cron every 5 minutes. Fires every WhatsApp campaign whose
// scheduled_for has passed. Audience is recomputed at fire time so late
// registrants are included.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const due = await getDueScheduledWhatsAppCampaigns(25);
    if (due.length === 0) {
      return NextResponse.json({ processed: 0, sent: 0, failed: 0 });
    }

    let totalSent = 0;
    let totalFailed = 0;
    const results: { id: string; status: string; sent: number; failed: number }[] = [];

    // Sequential — sendWhatsAppCampaign already loops recipients; running
    // campaigns one at a time keeps us well under the API rate ceiling.
    for (const campaign of due) {
      try {
        const r = await fireWhatsAppCampaign(campaign);
        totalSent += r.sentCount;
        totalFailed += r.failedCount;
        results.push({ id: campaign.id, status: r.status, sent: r.sentCount, failed: r.failedCount });
      } catch (err) {
        console.error(`[cron] whatsapp campaign ${campaign.id} failed:`, err);
        results.push({ id: campaign.id, status: 'error', sent: 0, failed: 0 });
      }
    }

    return NextResponse.json({ processed: due.length, sent: totalSent, failed: totalFailed, results });
  } catch (err) {
    console.error('[cron] process-whatsapp-queue error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
