import { NextRequest, NextResponse } from 'next/server';
import { getUnscoredVerifiedRegistrations, updateLeadScore } from '@/lib/db';
import { scoreConversation, type ConversationTurn } from '@/lib/qualify';

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
  for (const row of rows) {
    try {
      const { score } = await scoreConversation(row.conversation as ConversationTurn[]);
      await updateLeadScore(row.id, score);
      console.log(`[rescore-cron] ${row.id} → ${score}`);
      scored++;
    } catch (err) {
      console.error(`[rescore-cron] ${row.id} failed:`, err);
      failed++;
    }
  }
  return NextResponse.json({ pending: rows.length, scored, failed });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
