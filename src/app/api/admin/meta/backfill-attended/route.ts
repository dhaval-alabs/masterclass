// Meta CAPI attendance backfill — re-sends WebinarAttended for attendees we
// already have in our own database, with no Zoom call involved.
//
// WHY THIS EXISTS (separate from /api/admin/zoom/sync-attendance):
//
// The sync can only fire for people it matches in a LIVE Zoom report. Zoom
// 404s the report for a past occurrence, and the sync aborts on that error
// before sending anything — so it cannot recover an old cohort no matter how
// often it is re-run, and `force` does not help.
//
// That matters because of the phantom-success bug fixed in #28: every
// attendee's `meta_attended_event_fired` was set to true off a bare HTTP 200
// while Meta had actually DROPPED the event (per-session custom event names
// sit unconfirmed, and Meta does not count what arrives while pending — nor
// does confirming later apply retroactively). The rows therefore look done and
// the sync's idempotency guard skips them permanently.
//
// This endpoint reads the attendance already persisted on the row
// (attended_at, attendance_duration_min) and re-sends. It reuses the SAME
// event_id (`attended_<id>`) as the sync, so anything that genuinely did land
// is deduplicated by Meta rather than double-counted.
//
// NOTE ON TIMESTAMPS: Meta hard-rejects events older than 7 days, so
// sendMetaCapiEvent clamps event_time into that window. Backfilled attendance
// from past months therefore lands stamped ~now. That is fine for building
// custom audiences and lookalikes (the point of the recovery) but it does NOT
// retroactively attribute those attendees to their original ad click.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendMetaCapiEvent } from '@/lib/meta';
import {
  getAttendedRegistrationsForMetaBackfill,
  updateRegistrationAttendance,
  listWebinarSessions,
} from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const META_EVENT_NAME = process.env.META_ATTENDED_EVENT_NAME || 'WebinarAttended';

// Fire a bounded number at a time. Sequential is too slow for ~400 rows inside
// the function timeout; unbounded risks Meta rate-limiting us into failures
// that would look like the very bug we are fixing.
const CONCURRENCY = 6;

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  // sessionId omitted (or 'all') = every cohort.
  const rawSessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  const sessionId = rawSessionId && rawSessionId !== 'all' ? rawSessionId : null;
  const dryRun = body?.dryRun === true;

  try {
    const rows = await getAttendedRegistrationsForMetaBackfill(sessionId);
    if (!rows.length) {
      return NextResponse.json({ success: true, total: 0, sent: 0, failed: 0, skipped: 0, dryRun, errors: [] });
    }

    const sessions = await listWebinarSessions();
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];
    // A previous run reported 399/399 sent while Meta's dataset received none of
    // them, so record what the FIRST send actually did — which pixel took it and
    // Meta's verbatim reply — rather than trusting the success counter again.
    let firstSend: Record<string, unknown> | null = null;

    const queue = [...rows];
    async function worker() {
      for (;;) {
        const reg = queue.shift();
        if (!reg) return;

        // Meta needs at least one contact identifier to match on.
        if (!reg.email && !reg.phone) {
          skipped++;
          continue;
        }
        if (dryRun) {
          sent++;
          continue;
        }

        const cohort = reg.sessionId ? sessionById.get(reg.sessionId) : undefined;
        const nameParts = (reg.fullName || '').split(' ').filter(Boolean);

        const res = await sendMetaCapiEvent({
          eventName: META_EVENT_NAME,
          // Same id the sync uses — Meta dedups instead of double-counting.
          eventId: `attended_${reg.id}`,
          eventTime: reg.attendedAt
            ? Math.floor(new Date(reg.attendedAt).getTime() / 1000)
            : undefined,
          actionSource: 'system_generated',
          userData: {
            email: reg.email,
            phone: reg.phone,
            firstName: nameParts[0],
            lastName: nameParts.slice(1).join(' ') || undefined,
            city: reg.city,
            country: 'in',
            externalId: reg.id,
            fbc: reg.fbc ?? undefined,
            fbp: reg.fbp ?? undefined,
          },
          customData: {
            content_name: 'ExcelToAI_Masterclass',
            duration_min: reg.attendanceDurationMin ?? undefined,
            webinar_session_code: cohort?.code,
            webinar_session_title: cohort?.title,
            backfill: true,
          },
        });

        if (!firstSend) {
          firstSend = res.ok
            ? { ok: true, pixelTail: res.pixelTail, eventsReceived: res.eventsReceived, raw: res.raw }
            : { ok: false, error: res.error };
          console.log('[meta-backfill] first send →', JSON.stringify(firstSend));
        }
        if (res.ok) {
          sent++;
          try {
            await updateRegistrationAttendance({ id: reg.id, attended: true, metaAttendedEventFired: true });
          } catch {
            // Best effort. Re-running is safe: Meta dedups on event_id.
          }
        } else {
          failed++;
          // Leave the flag alone on failure so a later run retries this row.
          if (errors.length < 10) errors.push(`[${reg.email || reg.phone}] ${res.error}`);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

    console.log(
      `[meta-backfill] scope=${sessionId ?? 'all'} total=${rows.length} sent=${sent} failed=${failed} skipped=${skipped} dryRun=${dryRun}`,
    );

    return NextResponse.json({
      success: failed === 0,
      scope: sessionId ?? 'all',
      eventName: META_EVENT_NAME,
      total: rows.length,
      sent,
      failed,
      skipped,
      dryRun,
      errors,
      // Verbatim evidence from the first send. If `sent` is high but the dataset
      // stays empty, this is what tells you whether Meta was even called and
      // which pixel answered.
      firstSend,
      env: { vercelEnv: process.env.VERCEL_ENV ?? null, testCodeSet: !!process.env.META_TEST_EVENT_CODE },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[meta-backfill] fatal:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
