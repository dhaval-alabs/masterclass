export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getEmailRecipients, getActiveWebinarSession, getWhatsAppDailySentCount } from '@/lib/db';
import { dailyLimitInfo, dayStartLabel } from '@/lib/wa-limits';

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
    // The limit the server actually enforces — the UI used to read its own
    // NEXT_PUBLIC_WA_DAILY_LIMIT, which could disagree with what was sent.
    const limit = await dailyLimitInfo();

    return NextResponse.json({
      totalCount:  allRecipients.length,
      withPhone:   withPhone.length,
      sessionCode: session?.code ?? null,
      dailySentCount,
      dailyLimit:    limit.limit,
      appLimit:      limit.appLimit,
      metaLimit:     limit.metaLimit,
      metaTier:      limit.metaTier,
      constrainedBy: limit.constrainedBy,
      resetsAt:      dayStartLabel(),
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
