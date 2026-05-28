export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getEmailSettings, updateEmailSettings } from '@/lib/db';

export async function GET() {
  try {
    const settings = await getEmailSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let body: { logoUrl?: string | null; logoAlign?: string; logoHeight?: number; headerColor?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const validAligns = ['left', 'center', 'right'] as const;
  const updates: Parameters<typeof updateEmailSettings>[0] = {};

  if ('logoUrl' in body) updates.logoUrl = body.logoUrl ?? null;
  if (body.logoAlign && validAligns.includes(body.logoAlign as never)) {
    updates.logoAlign = body.logoAlign as 'left' | 'center' | 'right';
  }
  if (typeof body.logoHeight === 'number' && body.logoHeight >= 20 && body.logoHeight <= 80) {
    updates.logoHeight = body.logoHeight;
  }
  if (body.headerColor && /^#[0-9a-fA-F]{6}$/.test(body.headerColor)) {
    updates.headerColor = body.headerColor;
  }

  try {
    await updateEmailSettings(updates);
    const settings = await getEmailSettings();
    return NextResponse.json(settings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
