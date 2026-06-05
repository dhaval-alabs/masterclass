export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getAnalyticsOverview } from '@/lib/db';

// GET /api/admin/analytics/overview — cross-channel KPI rollup (Email + WhatsApp).
export async function GET() {
  try {
    const overview = await getAnalyticsOverview();
    return NextResponse.json(overview);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
