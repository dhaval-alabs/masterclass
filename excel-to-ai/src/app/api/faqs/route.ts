import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFaqs, replaceFaqs } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET() {
  return NextResponse.json(await getFaqs());
}

export async function PUT(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Body must be an array' }, { status: 400 });
    }
    if (body.length > 50) {
      return NextResponse.json({ success: false, error: 'Too many items (max 50)' }, { status: 400 });
    }
    const saved = await replaceFaqs(body);
    return NextResponse.json({ success: true, faqs: saved });
  } catch (error) {
    console.error('[FAQs PUT] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save FAQs' }, { status: 500 });
  }
}
