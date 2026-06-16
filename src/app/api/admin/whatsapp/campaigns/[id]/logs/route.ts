import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignLogs, getWhatsAppCampaignConversion } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Logs drive the delivery funnel; conversion is the unverified→verified metric.
    const [logs, conversion] = await Promise.all([
      getWhatsAppCampaignLogs(id),
      getWhatsAppCampaignConversion(id),
    ]);
    return NextResponse.json({ logs, conversion });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
