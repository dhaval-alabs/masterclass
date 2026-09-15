import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';
import { getNumberCreds, listWaNumbers, type WaNumberKey } from '@/lib/whatsapp';

// WhatsApp Business Profile API. Reads + writes the public profile of a connected
// number: photo, "about" headline, business description, address, email, industry
// (vertical) and websites. See:
//   https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles
const GRAPH_API_VERSION = 'v22.0';
const PROFILE_FIELDS = 'about,address,description,email,profile_picture_url,vertical,websites';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  return (await verifyAdminSession(token)) !== null;
}

// Default to the broadcast number when it's a distinct configured number (that's
// the public-facing marketing number recipients see), otherwise the OTP number.
function resolveNumber(requested: string | null, numbers: ReturnType<typeof listWaNumbers>): WaNumberKey {
  if (requested === 'otp' || requested === 'broadcast') return requested;
  const broadcastDistinct = numbers.find(n => n.key === 'broadcast')?.configured;
  return broadcastDistinct ? 'broadcast' : 'otp';
}

function metaError(body: unknown, fallbackStatus: number): string {
  const err = (body as { error?: { code?: number; message?: string } } | null)?.error;
  return err ? `code=${err.code ?? '?'}: ${err.message ?? 'unknown'}` : `HTTP ${fallbackStatus}`;
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const numbers = listWaNumbers();
  const which = resolveNumber(new URL(request.url).searchParams.get('number'), numbers);
  const pictureUploadAvailable = !!process.env.META_APP_ID;
  const { waAccessToken, waPhoneId } = getNumberCreds(which);

  // Soft errors return 200 + an `error` field so the panel can still render the
  // number selector and show the problem inline.
  if (!waAccessToken || !waPhoneId) {
    return NextResponse.json({
      error: `The ${which} number isn't configured.`,
      numbers, selected: which, pictureUploadAvailable,
    });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/whatsapp_business_profile?fields=${PROFILE_FIELDS}`,
      { headers: { Authorization: `Bearer ${waAccessToken}` }, cache: 'no-store' },
    );
    const body = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: metaError(body, res.status), numbers, selected: which, pictureUploadAvailable });
    }

    const p = body?.data?.[0] ?? {};
    return NextResponse.json({
      profile: {
        about: p.about ?? '',
        description: p.description ?? '',
        address: p.address ?? '',
        email: p.email ?? '',
        vertical: p.vertical ?? '',
        websites: Array.isArray(p.websites) ? p.websites : [],
        profilePictureUrl: p.profile_picture_url ?? null,
      },
      numbers, selected: which, pictureUploadAvailable,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      numbers, selected: which, pictureUploadAvailable,
    });
  }
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let body: {
    number?: string;
    about?: string; description?: string; address?: string;
    email?: string; vertical?: string; websites?: string[];
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const which = resolveNumber(body.number ?? null, listWaNumbers());
  const { waAccessToken, waPhoneId } = getNumberCreds(which);
  if (!waAccessToken || !waPhoneId) {
    return NextResponse.json({ ok: false, error: `The ${which} number isn't configured.` }, { status: 503 });
  }

  // Only send fields the client actually included. Meta enforces these max
  // lengths — clamp so an over-long value gets a clear update rather than a 400.
  const payload: Record<string, unknown> = { messaging_product: 'whatsapp' };
  if (body.about !== undefined)       payload.about = body.about.slice(0, 139);
  if (body.description !== undefined) payload.description = body.description.slice(0, 512);
  if (body.address !== undefined)     payload.address = body.address.slice(0, 256);
  if (body.email !== undefined)       payload.email = body.email.slice(0, 128);
  if (body.vertical)                  payload.vertical = body.vertical;
  if (Array.isArray(body.websites)) {
    payload.websites = body.websites.map(w => w.trim()).filter(Boolean).slice(0, 2);
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${waAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (res.ok) return NextResponse.json({ ok: true });
    const errBody = await res.json().catch(() => null);
    return NextResponse.json({ ok: false, error: metaError(errBody, res.status) }, { status: 502 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
