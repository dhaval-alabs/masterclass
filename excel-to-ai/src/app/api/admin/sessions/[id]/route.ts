// Per-session operations.
//   PATCH { action: 'activate' }       → mark this session active (auto-completes the previous one)
//   PATCH { action: 'end' }            → mark this session completed
//   PATCH { action: 'update', ...patch } → update editable fields

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  activateWebinarSession,
  endWebinarSession,
  updateWebinarSession,
} from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const action: string = body.action;

    if (action === 'activate') {
      const session = await activateWebinarSession(id);
      return NextResponse.json({ session });
    }
    if (action === 'end') {
      const session = await endWebinarSession(id);
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
      });
      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[sessions PATCH] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
