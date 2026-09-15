import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { listAdminUsers, getAdminByEmail, createAdminUser } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<{ ok: false } | { ok: true; sub: string }> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return { ok: false };
  return { ok: true, sub: session.sub };
}

function generatePassword(length = 20): string {
  // base64url-ish, stripped of confusable chars
  return crypto
    .randomBytes(length * 2)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .replace(/[O0Il1]/g, '')
    .slice(0, length);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function validateProvidedPassword(value: unknown): string | { error: string } {
  if (typeof value !== 'string') return { error: 'Password must be a string' };
  if (value.length < PASSWORD_MIN) return { error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (value.length > PASSWORD_MAX) return { error: `Password must be at most ${PASSWORD_MAX} characters` };
  if (/^\s|\s$/.test(value)) return { error: 'Password cannot start or end with a space' };
  return value;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
  try {
    return NextResponse.json(await listAdminUsers());
  } catch (err) {
    console.error('[Team GET] error:', err);
    return NextResponse.json({ error: 'Failed to load admins' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const auth = await requireAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const existing = await getAdminByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An admin with this email already exists' }, { status: 409 });
    }

    // Caller may supply their own password; otherwise we generate one.
    let password: string;
    let userProvided = false;
    if (body.password !== undefined && body.password !== '') {
      const result = validateProvidedPassword(body.password);
      if (typeof result !== 'string') {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      password = result;
      userProvided = true;
    } else {
      password = generatePassword(20);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await createAdminUser({
      email,
      name: name || null,
      passwordHash,
      createdBy: auth.sub,
    });

    // If the caller supplied the password themselves, they already know it —
    // omit it from the response so the UI doesn't echo it back in a modal.
    return NextResponse.json({
      admin: created,
      password: userProvided ? null : password,
    });
  } catch (err) {
    console.error('[Team POST] error:', err);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
