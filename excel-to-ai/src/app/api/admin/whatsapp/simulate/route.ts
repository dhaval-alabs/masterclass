export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getEmailRecipients, getActiveWebinarSession, getWhatsAppDailySentCount } from '@/lib/db';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('audience') ?? 'verified';
  const audience = (['verified', 'unverified', 'all'] as const).includes(raw as never)
    ? (raw as 'verified' | 'unverified' | 'all')
    : 'verified';

  try {
    const session = await getActiveWebinarSession();
    const allRecipients = await getEmailRecipients(audience, session?.id ?? null);

    // Only include recipients with a non-empty phone.
    const withPhone = allRecipients.filter(r => r.phone?.trim());
    const dailySentCount = await getWhatsAppDailySentCount();

    return NextResponse.json({
      totalCount:  allRecipients.length,
      withPhone:   withPhone.length,
      sessionCode: session?.code ?? null,
      dailySentCount,
      recipients:  withPhone.map(r => ({
        name:  r.fullName,
        email: r.email,
        phone: r.phone,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
