export const dynamic = 'force-dynamic';
// Sends run a per-recipient loop / batched email send — give the function room.
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { runBroadcast, BroadcastError, type BroadcastInput, type Audience } from '@/lib/broadcast';
import { getActiveWebinarSession, getEmailRecipients } from '@/lib/db';

// Admin-session authed (the BROADCAST_API_KEY is for server-to-server callers
// and never reaches the browser). This route lets the admin UI drive the same
// runBroadcast() engine the public API uses.
async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  return (await verifyAdminSession(token)) !== null;
}

// GET /api/admin/broadcast?channel=&audience=  → { count }
// Lets the UI show "this will send to N people" before the admin commits.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel');
  const audience = searchParams.get('audience') as Audience | null;
  if (audience !== 'verified' && audience !== 'unverified' && audience !== 'all') {
    return NextResponse.json({ count: 0 });
  }
  try {
    const session = await getActiveWebinarSession();
    const all = await getEmailRecipients(audience, session?.id ?? null);
    const count = channel === 'whatsapp'
      ? all.filter(r => r.phone?.trim()).length
      : all.filter(r => r.email?.trim()).length;
    return NextResponse.json({ count });
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
    console.error('[admin/broadcast] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error while broadcasting.' }, { status: 500 });
  }
}
