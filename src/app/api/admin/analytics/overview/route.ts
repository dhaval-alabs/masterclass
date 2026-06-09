export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsOverview, getActiveWebinarSession } from '@/lib/db';

// GET /api/admin/analytics/overview — cross-channel KPI rollup (Email + WhatsApp).
// Scoped to the active cohort by default; pass ?allSessions=1 for all-time.
export async function GET(req: NextRequest) {
  try {
    const allSessions = new URL(req.url).searchParams.get('allSessions') === '1';
    const session = allSessions ? null : await getActiveWebinarSession();
    const overview = await getAnalyticsOverview(session?.id ?? null);
    return NextResponse.json(overview);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
