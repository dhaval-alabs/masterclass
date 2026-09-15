import { NextRequest, NextResponse } from 'next/server';
import { getEmailCampaignById, getEmailCampaignStats, getQueueSummary } from '@/lib/db';

// GET /api/admin/email/campaigns/:id — campaign detail + stats + queue summary
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [campaign, stats, queue] = await Promise.all([
      getEmailCampaignById(id),
      getEmailCampaignStats(id),
      getQueueSummary(id),
    ]);
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ campaign, stats, queue });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
