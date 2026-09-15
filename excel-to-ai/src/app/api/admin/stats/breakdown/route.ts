import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getScoreBreakdownByCity } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') ?? undefined;

  try {
    const breakdown = await getScoreBreakdownByCity(sessionId);
    return NextResponse.json({ breakdown });
  } catch (err) {
    console.error('[stats/breakdown] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch breakdown' },
      { status: 500 },
    );
  }
}
