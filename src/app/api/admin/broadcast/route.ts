export const dynamic = 'force-dynamic';
// Sends run a per-recipient loop / batched email send — give the function room.
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { runBroadcast, audienceSpecFor, BroadcastError, type BroadcastInput, type Audience } from '@/lib/broadcast';
import { getActiveWebinarSession, resolveAudience, MigrationRequiredError, type AudienceScope } from '@/lib/db';
import { automationReserve, whatsAppDailyLimit } from '@/lib/whatsapp-campaign';

// Admin-session authed (the BROADCAST_API_KEY is for server-to-server callers
// and never reaches the browser). This route lets the admin UI drive the same
// runBroadcast() engine the public API uses.
async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  return (await verifyAdminSession(token)) !== null;
}

// GET /api/admin/broadcast?channel=&audience=&scope=&exclude=
//   → { count, sessionCode, whatsapp?: { dailyLimit, broadcastPerDay, estimatedDays } }
// Lets the UI show "this will send to N people" — and, for a WhatsApp send
// bigger than one day's cap, how long the queue will take to reach them all —
// before the admin commits.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') === 'email' ? 'email' : 'whatsapp';
  const audience = searchParams.get('audience') as Audience | null;
  const scope = (searchParams.get('scope') === 'all_sessions' ? 'all_sessions' : 'session') as AudienceScope;
  const exclude = searchParams.get('exclude') !== 'false';
  if (audience !== 'verified' && audience !== 'unverified' && audience !== 'all') {
    return NextResponse.json({ count: 0 });
  }
  try {
    const session = await getActiveWebinarSession();
    const { spec } = audienceSpecFor({ audience, scope, excludeCurrentRegistrants: exclude }, session?.id ?? null);
    const count = (await resolveAudience(spec, channel)).length;

    let whatsapp: { dailyLimit: number; broadcastPerDay: number; estimatedDays: number } | undefined;
    if (channel === 'whatsapp') {
      const dailyLimit = whatsAppDailyLimit();
      const broadcastPerDay = Math.max(1, dailyLimit - automationReserve(dailyLimit));
      whatsapp = { dailyLimit, broadcastPerDay, estimatedDays: Math.ceil(count / broadcastPerDay) };
    }
    return NextResponse.json({ count, sessionCode: session?.code ?? null, whatsapp });
  } catch (err) {
    return NextResponse.json({ count: 0, error: String(err) }, { status: 500 });
  }
}

// POST /api/admin/broadcast  → runs the broadcast (same body shape as /api/broadcast)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  let body: BroadcastInput;
  try {
    body = (await req.json()) as BroadcastInput;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const result = await runBroadcast(body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BroadcastError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    // Cross-session sends need migration 0036 — say so instead of "internal error".
    if (err instanceof MigrationRequiredError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 503 });
    }
    console.error('[admin/broadcast] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error while broadcasting.' }, { status: 500 });
  }
}
