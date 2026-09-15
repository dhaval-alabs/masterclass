import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  listAdminUsers,
  updateAdminUser,
  deleteAdminUser,
} from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<{ ok: false } | { ok: true; sub: string }> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return { ok: false };
  return { ok: true, sub: session.sub };
}

function generatePassword(length = 20): string {
  return crypto
    .randomBytes(length * 2)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .replace(/[O0Il1]/g, '')
    .slice(0, length);
}

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

function validateProvidedPassword(value: unknown): string | { error: string } {
  if (typeof value !== 'string') return { error: 'Password must be a string' };
  if (value.length < PASSWORD_MIN) return { error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (value.length > PASSWORD_MAX) return { error: `Password must be at most ${PASSWORD_MAX} characters` };
  if (/^\s|\s$/.test(value)) return { error: 'Password cannot start or end with a space' };
  return value;
}

// Returns the row whose id matches, or null. We don't expose the hash here.
async function findById(id: string) {
  const all = await listAdminUsers();
  return all.find((a) => a.id === id) ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const target = await findById(id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isSelf = target.email.toLowerCase() === auth.sub.toLowerCase();

  try {
    const body = await request.json();
    const action: string | undefined = body.action;

    if (action === 'deactivate') {
      if (isSelf) {
        return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
      }
      const updated = await updateAdminUser(id, { isActive: false });
      return NextResponse.json({ admin: updated });
    }

    if (action === 'reactivate') {
      const updated = await updateAdminUser(id, { isActive: true });
      return NextResponse.json({ admin: updated });
    }

    if (action === 'reset_password') {
      // Caller may supply a custom new password; otherwise we generate one.
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
      const updated = await updateAdminUser(id, { passwordHash });
      return NextResponse.json({
        admin: updated,
        password: userProvided ? null : password,
      });
    }

    if (action === 'rename') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const updated = await updateAdminUser(id, { name: name || null });
      return NextResponse.json({ admin: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Team PATCH] error:', err);
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const auth = await requireAdmin();
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  const target = await findById(id);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (target.email.toLowerCase() === auth.sub.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  try {
    await deleteAdminUser(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Team DELETE] error:', err);
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 });
  }
}
