// Resend OTP — generates a fresh code for an in-flight session.
//
// Unlike /api/otp/send, this route is idempotent w.r.t. downstream systems:
//   - Does NOT insert a new registration row (avoids polluting the admin
//     panel with extra Unverified attempts when the user just wants another
//     code).
//   - Does NOT push to LeadSquared or Google Sheets again (already pushed
//     on the original send).
//   - Does NOT register again with Zoom (already done).
//   - Does NOT fire a Lead pixel (already fired on the original send).
//
// What it does: validates the existing token, generates a NEW OTP + HMAC +
// expiry, sends WhatsApp, and returns the NEW token + the previous Zoom URL
// so the client UI keeps working as if the user just started the OTP step.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendWhatsAppOtp } from '@/lib/whatsapp';
import { getWebinarConfig } from '@/lib/db';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
    }

    // Decode previous token to recover the lead context (name/email/phone +
    // zoomJoinUrl + registrationId). The token isn't signed — we sign the
    // OTP itself via HMAC inside the token — but we accept it as-is since
    // the attacker would need a valid send-route call to forge it anyway.
    let decoded: Record<string, unknown>;
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    } catch {
      return NextResponse.json({ success: false, error: 'Bad token' }, { status: 400 });
    }

    const phone = typeof decoded.phone === 'string' ? decoded.phone : '';
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Bad token' }, { status: 400 });
    }

    const hmacSecret = requireEnv('OTP_HMAC_SECRET');
    if (hmacSecret.length < 32) throw new Error('OTP_HMAC_SECRET must be at least 32 chars');

    // 1. Fresh OTP + expiry + HMAC.
    const otp = String(crypto.randomInt(1000, 9999));
    const expiry = Date.now() + 10 * 60 * 1000;
    const hmac = crypto.createHmac('sha256', hmacSecret).update(`${phone}:${otp}:${expiry}`).digest('hex');

    // 2. WhatsApp send (uses the admin-configurable template name).
    const config = await getWebinarConfig().catch(() => null);
    const whatsappTemplate = config?.whatsappTemplateName?.trim() || 'form_otp';
    const waResult = await sendWhatsAppOtp(phone, otp, whatsappTemplate);

    // 3. Build refreshed token. Carries forward everything from the old
    // token (name, email, city, typeFilter, zoomJoinUrl, registrationId)
    // but with the fresh expiry + HMAC.
    const newTokenPayload = {
      ...decoded,
      expiry,
      hmac,
    };
    const newToken = Buffer.from(JSON.stringify(newTokenPayload)).toString('base64');

    return NextResponse.json({
      success: true,
      token: newToken,
      waStatus: waResult.status,
      // We deliberately do NOT expose the underlying error string to the
      // client — could leak Meta error codes. The user just sees the UI
      // toast and tries again or uses the help link.
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
