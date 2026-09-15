import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { signAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';
import {
  getAdminByEmailActive,
  createAdminUser,
  touchAdminLastLogin,
  countAdminUsers,
} from '@/lib/db';

type EnvCredential = { user: string; password: string };

// Env-based credentials are the *fallback* (so DB outage / fresh DB never
// locks you out). On a successful env-cred login, we auto-migrate the entry
// into the admin_users table so future logins go through bcrypt + DB.
function loadEnvCredentials(): EnvCredential[] {
  const list: EnvCredential[] = [];
  const raw = process.env.ADMIN_CREDENTIALS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.user === 'string' && typeof item.password === 'string') {
            list.push({ user: item.user, password: item.password });
          }
        }
      }
    } catch (err) {
      console.error('[Login] ADMIN_CREDENTIALS is not valid JSON:', err);
    }
  }
  const legacyUser = process.env.ADMIN_USER;
  const legacyPass = process.env.ADMIN_PASSWORD;
  if (legacyUser && legacyPass && !list.some((c) => c.user === legacyUser)) {
    list.push({ user: legacyUser, password: legacyPass });
  }
  return list;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { username, password } = await request.json();

    if (typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Bad request' }, { status: 400 });
    }

    let matchedUser: string | null = null;
    let matchedAdminId: string | null = null;

    // 1. Try the DB first.
    try {
      const dbAdmin = await getAdminByEmailActive(username);
      if (dbAdmin && (await bcrypt.compare(password, dbAdmin.passwordHash))) {
        matchedUser = dbAdmin.email;
        matchedAdminId = dbAdmin.id;
      }
    } catch (err) {
      // DB unreachable / table missing — log and continue to env fallback.
      console.error('[Login] DB lookup failed, falling back to env:', err);
    }

    // 2. Fall back to env credentials.
    if (!matchedUser) {
      const envCreds = loadEnvCredentials();
      for (const cred of envCreds) {
        const userOk = timingSafeEqualStr(username, cred.user);
        const passOk = timingSafeEqualStr(password, cred.password);
        if (userOk && passOk) matchedUser = cred.user;
      }
      // On a successful env-cred login, ensure the user has a DB row so they
      // can manage themselves from the portal (change their password, etc.).
      // This runs on every env login — not just the first — so removing
      // someone from `ADMIN_CREDENTIALS` is the only way to truly revoke
      // env-based access. Existing DB rows are left alone (we don't overwrite
      // a password the user may have already customised through the portal).
      if (matchedUser) {
        try {
          const existing = await getAdminByEmailActive(matchedUser).catch(() => null);
          if (existing) {
            matchedAdminId = existing.id;
          } else {
            const hash = await bcrypt.hash(password, 10);
            const created = await createAdminUser({
              email: matchedUser,
              name: null,
              passwordHash: hash,
              createdBy: 'env-bootstrap',
            });
            matchedAdminId = created.id;
            const total = await countAdminUsers().catch(() => -1);
            console.log(
              `[Login] Promoted env credential to admin_users: ${matchedUser} (table size: ${total})`,
            );
          }
        } catch (err) {
          console.error('[Login] Bootstrap into admin_users failed (login still succeeded):', err);
        }
      }
    }

    if (!matchedUser) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (matchedAdminId) {
      // Fire-and-forget — don't block login if the timestamp update fails.
      touchAdminLastLogin(matchedAdminId).catch(() => undefined);
    }

    const ttlSeconds = 60 * 60 * 24;
    const token = await signAdminSession(matchedUser, ttlSeconds);

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: 'admin_session',
      value: token,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ttlSeconds,
    });
    return response;
  } catch (error) {
    console.error('[Login] error:', error);
    return NextResponse.json({ success: false, error: 'Bad request' }, { status: 400 });
  }
}
