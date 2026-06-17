import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignLogs, getWhatsAppCampaignConversion, getWhatsAppCampaignConvertedPhones } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Logs drive the delivery funnel; conversion is the unverified→verified metric;
    // convertedPhones flags which recipients in the list actually converted.
    const [logs, conversion, convertedPhones] = await Promise.all([
      getWhatsAppCampaignLogs(id),
      getWhatsAppCampaignConversion(id),
      getWhatsAppCampaignConvertedPhones(id),
    ]);
    return NextResponse.json({ logs, conversion, convertedPhones });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
