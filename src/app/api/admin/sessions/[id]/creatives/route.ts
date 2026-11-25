// A session's WhatsApp creatives (see src/lib/mindbird.ts, "Campaign creatives").
//   GET                                   → the session's images, Mindbird's image templates, what is missing, the last send
//   PUT  { default, templates }           → save them, then send them to Mindbird
//   POST                                  → send the saved images to Mindbird again

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getWebinarSessionById, setSessionCreatives, logSessionAudit } from '@/lib/db';
import { verifyAdminSession, type AdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';
import { cleanCreatives, mindbirdConfigured, missingImageTemplates, pushSessionCreatives, sessionCreativeStatus } from '@/lib/mindbird';

export const maxDuration = 60;

async function requireAdmin(): Promise<AdminSession | null> {
  return verifyAdminSession((await cookies()).get('admin_session')?.value);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;
  const session = await getWebinarSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const status = await sessionCreativeStatus(id);
  const imageTemplates = status.imageTemplates ?? [];
  return NextResponse.json({
    connected: mindbirdConfigured(),
    mindbirdError: status.ok ? null : status.error,
    creatives: session.waCreatives,
    sync: session.waCreativesSync,
    imageTemplates,
    missing: missingImageTemplates(imageTemplates, session.waCreatives),
    held: status.held ?? [],
  });
}

async function saveAndPush(id: string, admin: AdminSession, request: Request, body: unknown | null) {
  const session = await getWebinarSessionById(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const creatives = body === null ? session.waCreatives : cleanCreatives(body);
  // Saved here first, so the images are kept even if Mindbird is down; the
  // send's result is stored next to them for the panel to show.
  if (body !== null) await setSessionCreatives(id, { creatives });
  const sync = await pushSessionCreatives(session, creatives);
  const saved = await setSessionCreatives(id, { sync });
  logSessionAudit({
    sessionId: id, adminEmail: admin.sub, action: 'update',
    before: session, after: saved, ip: request.headers.get('x-forwarded-for') ?? null,
  });
  return NextResponse.json({ creatives: saved.waCreatives, sync });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request).ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  try {
    return await saveAndPush(id, admin, request, body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save the creatives' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request).ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await requireAdmin();
  if (!admin) return new NextResponse('Unauthorized', { status: 401 });
  const { id } = await params;
  try {
    return await saveAndPush(id, admin, request, null);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not send the creatives' }, { status: 500 });
  }
}
