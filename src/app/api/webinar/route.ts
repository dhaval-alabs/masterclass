import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getWebinarConfig, updateWebinarConfig } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return NextResponse.json(await getWebinarConfig());
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Body must be a JSON object' }, { status: 400 });
    }
    const updated = await updateWebinarConfig(body);
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    console.error('[Webinar POST] error:', error);
    // Surface the real cause (admin-only endpoint) so failures are diagnosable
    // instead of an opaque 500.
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `Failed to update webinar config: ${detail}` }, { status: 500 });
  }
}
