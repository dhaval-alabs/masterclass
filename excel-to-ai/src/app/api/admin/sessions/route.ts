// Webinar session management.
//   GET  → list all sessions (newest first)
//   POST → create a new session (status='upcoming')

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  listWebinarSessions,
  createWebinarSession,
} from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET() {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const sessions = await listWebinarSessions();
    return NextResponse.json(sessions);
  } catch (err) {
    console.error('[sessions GET] error:', err);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!code) return NextResponse.json({ error: 'Code is required (e.g. W002)' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const created = await createWebinarSession({
      code,
      title,
      dateLabel: body.dateLabel ?? null,
      timeLabel: body.timeLabel ?? null,
      datetimeUtc: body.datetimeUtc ?? null,
      durationLabel: body.durationLabel ?? null,
      zoomWebinarId: body.zoomWebinarId ?? null,
      whatsappTemplateName: body.whatsappTemplateName ?? null,
      lsqSourceName: body.lsqSourceName ?? null,
      metaEventSuffix: body.metaEventSuffix ?? null,
    });
    return NextResponse.json({ session: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create session';
    const isUnique = msg.toLowerCase().includes('unique') || msg.includes('23505');
    console.error('[sessions POST] error:', err);
    return NextResponse.json(
      { error: isUnique ? 'A session with that code already exists' : msg },
      { status: isUnique ? 409 : 500 },
    );
  }
}
