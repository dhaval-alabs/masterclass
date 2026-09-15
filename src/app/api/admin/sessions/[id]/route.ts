// Per-session operations.
//   PATCH  { action: 'activate' }       → mark this session active (auto-completes the previous one)
//   PATCH  { action: 'end' }            → mark this session completed
//   PATCH  { action: 'update', ...patch } → update editable fields
//   DELETE                              → permanently delete the session (blocked if it has registrations)

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  activateWebinarSession,
  endWebinarSession,
  updateWebinarSession,
  getWebinarSessionById,
  deleteWebinarSession,
  logSessionAudit,
  type WebinarSession,
} from '@/lib/db';
import { verifyAdminSession, type AdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get('admin_session')?.value;
  return verifyAdminSession(token);
}

function requestIp(request: Request): string | null {
  return request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const action: string = body.action;

    // Snapshot the row before mutating so the audit log can record exactly
    // what changed, not just that "an update happened". Added after
    // otp_required was found flipped off on the live session for ~3 hours
    // with no way to tell who did it — a plain fire-and-forget PATCH left no
    // trace at all.
    const before = (await getWebinarSessionById(id).catch(() => null)) as WebinarSession | null;
    const ip = requestIp(request);

    if (action === 'activate') {
      const session = await activateWebinarSession(id);
      logSessionAudit({ sessionId: id, adminEmail: admin.sub, action: 'activate', before, after: session, ip });
      return NextResponse.json({ session });
    }
    if (action === 'end') {
      const session = await endWebinarSession(id);
      logSessionAudit({ sessionId: id, adminEmail: admin.sub, action: 'end', before, after: session, ip });
      return NextResponse.json({ session });
    }
    if (action === 'update') {
      const session = await updateWebinarSession(id, {
        title: body.title,
        dateLabel: body.dateLabel,
        timeLabel: body.timeLabel,
        datetimeUtc: body.datetimeUtc,
        durationLabel: body.durationLabel,
        zoomWebinarId: body.zoomWebinarId,
        whatsappTemplateName: body.whatsappTemplateName,
        lsqSourceName: body.lsqSourceName,
        metaEventSuffix: body.metaEventSuffix,
        otpRequired: body.otpRequired,
      });
      logSessionAudit({ sessionId: id, adminEmail: admin.sub, action: 'update', before, after: session, ip });
      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[sessions PATCH] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const session = await getWebinarSessionById(id);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    // Don't let the live cohort be deleted out from under the LP.
    if (session.status === 'active') {
      return NextResponse.json({ error: 'End this session before deleting it.' }, { status: 409 });
    }

    await deleteWebinarSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sessions DELETE] error:', err);
    // Supabase errors are plain objects, not Error instances. A foreign-key
    // violation (23503) means the session still has registrations / attendance
    // records pointing at it — deleting would destroy that history.
    const e = (err ?? {}) as { code?: string; message?: string };
    const isFk = e.code === '23503' || /foreign key|violates foreign/i.test(e.message ?? '');
    return NextResponse.json(
      {
        error: isFk
          ? "Can't delete this session — it still has registrations or attendance records. That history references it, so deletion is blocked to avoid losing data."
          : (e.message || 'Failed to delete session'),
      },
      { status: isFk ? 409 : 500 },
    );
  }
}
