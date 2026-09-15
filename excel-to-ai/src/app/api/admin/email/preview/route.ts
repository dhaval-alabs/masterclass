import { NextRequest, NextResponse } from 'next/server';
import { getEmailRecipients, getActiveWebinarSession } from '@/lib/db';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('audience') ?? 'verified';
  const audience = (['verified', 'unverified', 'all'] as const).includes(raw as never)
    ? (raw as 'verified' | 'unverified' | 'all')
    : 'verified';
  const full = req.nextUrl.searchParams.get('full') === 'true';

  try {
    const session = await getActiveWebinarSession();
    const recipients = await getEmailRecipients(audience, session?.id ?? null);

    return NextResponse.json({
      count: recipients.length,
      sessionCode: session?.code ?? null,
      samples: recipients.slice(0, 8).map(r => ({ email: r.email, name: r.fullName })),
      ...(full ? { all: recipients.map(r => ({ email: r.email, name: r.fullName })) } : {}),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
