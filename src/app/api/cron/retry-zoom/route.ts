import { NextRequest, NextResponse } from 'next/server';
import { getRegistrationById, getVerifiedWithoutZoomLink, getWebinarConfig, updateZoomRegistration } from '@/lib/db';
import { registerWebinarParticipant } from '@/lib/zoom';
import { syncRegistration } from '@/lib/mindbird-sync';
import { retryMissingZoomLinks } from '@/lib/zoom-retry';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// GET|POST /api/cron/retry-zoom
// Verified registrants of the active session whose Zoom registration failed at
// OTP time are registered again, and Mindbird is told their new link so the
// WhatsApp confirmation and link reminders go out (see zoom-retry.ts).
async function handle(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await retryMissingZoomLinks({
    activeSession: async () => {
      const config = await getWebinarConfig().catch(() => null);
      if (!config?.activeSessionId) return null;
      // The same webinar id verification registers people with.
      return { id: config.activeSessionId, datetimeUtc: config.webinarDatetimeUtc ?? null, zoomWebinarId: config.zoomWebinarId?.trim() || null };
    },
    missing: getVerifiedWithoutZoomLink,
    register: registerWebinarParticipant,
    save: (id, joinUrl) => updateZoomRegistration(id, true, joinUrl),
    notify: async (id, joinUrl) => {
      const reg = await getRegistrationById(id);
      if (reg) await syncRegistration({ ...reg, zoomRegistered: true, zoomJoinUrl: joinUrl }, { event: 'mc_verified', joinUrl });
    },
  });
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
