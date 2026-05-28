import { NextRequest, NextResponse } from 'next/server';
import { listWhatsAppOptouts, addWhatsAppOptout, removeWhatsAppOptout } from '@/lib/db';

/** Strip non-digits, remove leading country code 91 if present, keep last 10 digits. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Remove leading 91 if the number is longer than 10 digits.
  const trimmed = digits.length > 10 && digits.startsWith('91')
    ? digits.slice(2)
    : digits;
  // Keep last 10 digits.
  return trimmed.slice(-10);
}

export async function GET() {
  try {
    const optouts = await listWhatsAppOptouts();
    return NextResponse.json({ optouts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { phone?: string; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawPhone = body.phone ?? '';
  if (!rawPhone.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  const phone = normalisePhone(rawPhone);
  if (phone.length !== 10) {
    return NextResponse.json({ error: 'phone must normalise to 10 digits' }, { status: 400 });
  }

  try {
    await addWhatsAppOptout(phone, body.reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let body: { phone?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawPhone = body.phone ?? '';
  if (!rawPhone.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  const phone = normalisePhone(rawPhone);

  try {
    await removeWhatsAppOptout(phone);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
