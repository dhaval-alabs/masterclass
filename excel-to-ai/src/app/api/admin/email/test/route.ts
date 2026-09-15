import { NextRequest, NextResponse } from 'next/server';
import { sendTestEmail } from '@/lib/email';

// POST /api/admin/email/test
// Body: { toEmail, subject, bodyText, bodyHtml?, bannerUrl? }
export async function POST(req: NextRequest) {
  let body: { toEmail?: string; subject?: string; bodyText?: string; bodyHtml?: string; bannerUrl?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { toEmail, subject, bodyText, bodyHtml, bannerUrl } = body;
  if (!toEmail?.trim()) return NextResponse.json({ error: 'toEmail is required' }, { status: 400 });
  if (!subject?.trim())  return NextResponse.json({ error: 'subject is required' }, { status: 400 });
  if (!bodyText?.trim() && !bodyHtml?.trim()) return NextResponse.json({ error: 'body is required' }, { status: 400 });

  const result = await sendTestEmail({
    toEmail: toEmail.trim(),
    subject: subject.trim(),
    bodyText: bodyText?.trim() ?? '',
    bodyHtml: bodyHtml?.trim() || null,
    bannerUrl: bannerUrl?.trim() || null,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ success: true });
}
