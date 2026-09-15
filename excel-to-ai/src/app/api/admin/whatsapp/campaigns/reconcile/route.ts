import { NextRequest, NextResponse } from 'next/server';
import { listWhatsAppCampaigns, reconcileWhatsAppCampaignCounters } from '@/lib/db';

// POST /api/admin/whatsapp/campaigns/reconcile
// Recomputes stored counters (total/sent/failed/status) from the deduped send
// log for every campaign — fixes counters inflated by retries so the card
// matches the Stats panel. Optional body { id } reconciles a single campaign.
export async function POST(req: NextRequest) {
  const onlyId = await req.json().then(b => (b?.id as string | undefined)?.trim() || null).catch(() => null);

  try {
    const campaigns = onlyId
      ? [{ id: onlyId }]
      : await listWhatsAppCampaigns();

    let reconciled = 0;
    let skipped = 0;
    const changes: { id: string; total: number; sent: number; failed: number; status: string }[] = [];

    for (const c of campaigns) {
      const res = await reconcileWhatsAppCampaignCounters(c.id);
      if (res) {
        reconciled++;
        changes.push({ id: c.id, ...res });
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      reconciled,
      skipped,
      changes,
      message: `Reconciled ${reconciled} campaign${reconciled !== 1 ? 's' : ''} from the send log${skipped ? ` (${skipped} skipped — no log rows)` : ''}.`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
