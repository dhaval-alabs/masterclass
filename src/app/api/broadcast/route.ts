export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runBroadcast, BroadcastError, type BroadcastInput } from '@/lib/broadcast';

// POST /api/broadcast — internal, API-key-authed programmatic broadcasting for
// BOTH WhatsApp and Email. See docs/broadcast-api.md for the full contract.
//
// Auth: Authorization: Bearer <BROADCAST_API_KEY>  (server-to-server only).
//
// Reuses the exact campaign/queue/daily-cap/dedup plumbing the admin UI uses —
// large WhatsApp sends queue and drain over the cron just like the admin path.

// Constant-time bearer-token check. Returns false on any malformed/mismatched
// header (and when the secret isn't configured, so the API stays closed).
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.BROADCAST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const provided = header.slice(prefix.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

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
    console.error('[broadcast] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error while broadcasting.' }, { status: 500 });
  }
}
