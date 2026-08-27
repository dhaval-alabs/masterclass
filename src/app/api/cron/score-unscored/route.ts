import { NextRequest, NextResponse } from 'next/server';
import { getUnscoredVerifiedRegistrations, updateLeadScore } from '@/lib/db';
import { scoreConversation, type ConversationTurn } from '@/lib/qualify';
import { sendMetaCapiEvent } from '@/lib/meta';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GET|POST /api/cron/score-unscored
// Safety net for lead scoring: any Verified registration with a saved chat
// but no lead_score (scoring interrupted at OTP time) gets rescored here.
// Capped per run; rows that keep failing are retried on later runs.
async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await getUnscoredVerifiedRegistrations(5);
  let scored = 0;
  let failed = 0;
  let metaFired = 0;
  for (const row of rows) {
    try {
      const { score } = await scoreConversation(row.conversation as ConversationTurn[]);
      await updateLeadScore(row.id, score);
      console.log(`[rescore-cron] ${row.id} → ${score}`);
      scored++;

      // Fire the same Meta CAPI event the live qualify route sends, so leads
      // recovered here (e.g. after a Gemini outage) still reach Meta — otherwise
      // the DB score updates but Meta never gets the QualifiedLead/JunkLead
      // signal. Mirrors /api/qualify: cold fires nothing; event_id qualify_<id>
      // dedups against any live send.
      if (score !== 'cold' && (row.email || row.phone)) {
        const nameParts = (row.fullName || '').split(' ').filter(Boolean);
        const capi = await sendMetaCapiEvent({
          eventName: score === 'junk' ? 'JunkLead' : 'QualifiedLead',
          eventId: `qualify_${row.id}`,
          userData: {
            email: row.email ?? undefined,
            phone: row.phone ?? undefined,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || undefined,
            city: row.city ?? undefined,
            externalId: row.id,
            fbc: row.fbc ?? undefined,
            fbp: row.fbp ?? undefined,
          },
          customData: { lead_score: score, content_name: 'Lead Qualification' },
        });
        if (capi.ok) metaFired++;
        else console.error(`[rescore-cron] Meta CAPI failed for ${row.id}: ${capi.error}`);
      }
    } catch (err) {
      console.error(`[rescore-cron] ${row.id} failed:`, err);
      failed++;
    }
  }
  return NextResponse.json({ pending: rows.length, scored, failed, metaFired });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
