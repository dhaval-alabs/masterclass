import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addRegistration, getRegistrationsPaginated, getRegistrationStats } from '@/lib/db';
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

  const [pageRes, stats] = await Promise.all([
    getRegistrationsPaginated(page, pageSize, null, scoreFilter),
    wantStats ? getRegistrationStats() : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ...pageRes,
    ...(stats ? { stats } : {}),
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
