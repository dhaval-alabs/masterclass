import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';
import { getNumberCreds, type WaNumberKey } from '@/lib/whatsapp';

// Setting a WhatsApp number's profile photo is a 3-step Meta flow:
//   1. POST /{app-id}/uploads      → opens a resumable upload session
//   2. POST /{upload-session-id}   → uploads the bytes, returns a media handle
//   3. POST /{phone-id}/whatsapp_business_profile with profile_picture_handle
// Step 1 needs the Meta App id (META_APP_ID); without it, photo upload is disabled.
//   https://developers.facebook.com/docs/graph-api/guides/upload
const GRAPH_API_VERSION = 'v22.0';
const MAX_BYTES = 5 * 1024 * 1024; // Meta caps profile photos at 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  return (await verifyAdminSession(token)) !== null;
}

function metaError(body: unknown, fallbackStatus: number): string {
  const err = (body as { error?: { code?: number; message?: string } } | null)?.error;
  return err ? `code=${err.code ?? '?'}: ${err.message ?? 'unknown'}` : `HTTP ${fallbackStatus}`;
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: 'Profile-photo upload needs META_APP_ID to be set.' }, { status: 503 });
  }

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
  }

  const file = form.get('file');
  const numberRaw = form.get('number');
  const which: WaNumberKey = numberRaw === 'otp' ? 'otp' : 'broadcast';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No image received.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Image must be a JPG or PNG.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 });
  }

  const { waAccessToken, waPhoneId } = getNumberCreds(which);
  if (!waAccessToken || !waPhoneId) {
    return NextResponse.json({ error: `The ${which} number isn't configured.` }, { status: 503 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    // Step 1 — open an upload session.
    const sessUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${appId}/uploads`
      + `?file_name=${encodeURIComponent(file.name || 'profile.jpg')}`
      + `&file_length=${bytes.length}`
      + `&file_type=${encodeURIComponent(file.type)}`;
    const sessRes = await fetch(sessUrl, { method: 'POST', headers: { Authorization: `Bearer ${waAccessToken}` } });
    const sessBody = await sessRes.json().catch(() => null);
    if (!sessRes.ok || !sessBody?.id) {
      return NextResponse.json({ error: `Couldn't start the upload: ${metaError(sessBody, sessRes.status)}` }, { status: 502 });
    }

    // Step 2 — upload the bytes; returns the media handle `h`.
    const upRes = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${sessBody.id}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${waAccessToken}`, file_offset: '0' },
      body: bytes,
    });
    const upBody = await upRes.json().catch(() => null);
    if (!upRes.ok || !upBody?.h) {
      return NextResponse.json({ error: `Image upload failed: ${metaError(upBody, upRes.status)}` }, { status: 502 });
    }

    // Step 3 — point the profile at the uploaded handle.
    const setRes = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${waAccessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: upBody.h }),
      },
    );
    if (!setRes.ok) {
      const errBody = await setRes.json().catch(() => null);
      return NextResponse.json({ error: `Couldn't set the photo: ${metaError(errBody, setRes.status)}` }, { status: 502 });
    }

    // Re-read the new URL so the panel can refresh its preview.
    let profilePictureUrl: string | null = null;
    try {
      const r = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${waPhoneId}/whatsapp_business_profile?fields=profile_picture_url`,
        { headers: { Authorization: `Bearer ${waAccessToken}` }, cache: 'no-store' },
      );
      const b = await r.json();
      profilePictureUrl = b?.data?.[0]?.profile_picture_url ?? null;
    } catch { /* preview refresh is best-effort */ }

    return NextResponse.json({ ok: true, profilePictureUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
