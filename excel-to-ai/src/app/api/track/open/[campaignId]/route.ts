import { NextRequest, NextResponse } from 'next/server';
import { recordEmailOpen } from '@/lib/db';
import { createHash } from 'crypto';

// 1×1 transparent GIF — smallest possible tracking pixel.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

// Public endpoint — NOT behind admin auth.
// Embedded in outgoing emails as: <img src="/api/track/open/{campaignId}?r={recipientHash}" />
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;

  // The 'r' query param is a sha-256 hash of the recipient email (generated
  // at send time). If absent, fall back to a hash of the request IP so we
  // still get approximate unique counts without storing PII.
  const rawR = req.nextUrl.searchParams.get('r');
  const recipientHash =
    rawR ??
    createHash('sha256')
      .update(req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'anon')
      .digest('hex')
      .slice(0, 16);

  // Fire-and-forget — never block the pixel response.
  recordEmailOpen(campaignId, recipientHash).catch(err =>
    console.error('[email-track/open]', err),
  );

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
