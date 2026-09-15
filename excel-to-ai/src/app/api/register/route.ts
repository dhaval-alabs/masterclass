import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addRegistration, getRegistrationsPaginated, getUniqueRegistrationsPaginated, getRegistrationStats, getActiveWebinarSession } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10) || 1;
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '50', 10) || 50;
  const wantStats = url.searchParams.get('stats') === '1';
  const scoreFilter = url.searchParams.get('score') || null;
  const attendedFilter = url.searchParams.get('attended') || null;
  const statusFilter = url.searchParams.get('regStatus') || null;
  // Collapse a person's repeat attempts into one row by default; pass
  // unique=0 to see every raw submission.
  const unique = url.searchParams.get('unique') !== '0';

  // Scope to the active cohort so multiple masterclasses don't mix. Passing
  // allSessions=1 (admin escape hatch) shows everyone across every session.
  const allSessions = url.searchParams.get('allSessions') === '1';
  const activeSession = allSessions ? null : await getActiveWebinarSession();
  const scopeSessionId = activeSession?.id ?? null;

  const [pageRes, stats] = await Promise.all([
    unique
      ? getUniqueRegistrationsPaginated(page, pageSize, scopeSessionId, scoreFilter, attendedFilter, statusFilter)
      : getRegistrationsPaginated(page, pageSize, scopeSessionId, scoreFilter, attendedFilter, statusFilter),
    wantStats ? getRegistrationStats(scopeSessionId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ...pageRes,
    ...(stats ? { stats } : {}),
    scope: {
      allSessions,
      sessionCode: activeSession?.code ?? null,
      sessionTitle: activeSession?.title ?? null,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newReg = await addRegistration({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      status: body.status,
      city: body.city
    });
    return NextResponse.json({ success: true, registration: newReg });
  } catch (error) {
    console.error('[Register POST] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to register' }, { status: 500 });
  }
}
