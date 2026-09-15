import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getAdminByEmail, updateAdminUser } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function validatePassword(value: unknown): string | { error: string } {
  if (typeof value !== 'string') return { error: 'Password must be a string' };
  if (value.length < PASSWORD_MIN) return { error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (value.length > PASSWORD_MAX) return { error: `Password must be at most ${PASSWORD_MAX} characters` };
  if (/^\s|\s$/.test(value)) return { error: 'Password cannot start or end with a space' };
  return value;
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await request.json();
    const currentPassword = body.currentPassword;
    const newPasswordRaw = body.newPassword;

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
    }
    const newPassword = validatePassword(newPasswordRaw);
    if (typeof newPassword !== 'string') {
      return NextResponse.json({ error: newPassword.error }, { status: 400 });
    }
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: 'New password must be different from the current one' }, { status: 400 });
    }

    // We look up by the email stored in the session subject. Env-only admins
    // will have a DB row already (the login route promotes them on every
    // successful env login), so this should always find a row for an
    // authenticated user.
    const admin = await getAdminByEmail(session.sub);
    if (!admin) {
      return NextResponse.json(
        {
          error:
            'Your account is not yet in the team table. Log out and log back in once so it can be created, then try again.',
        },
        { status: 404 },
      );
    }

    const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateAdminUser(admin.id, { passwordHash });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Self password change] error:', err);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
