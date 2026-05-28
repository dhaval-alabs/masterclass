import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCampaignLogs } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const logs = await getWhatsAppCampaignLogs(id);
    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
