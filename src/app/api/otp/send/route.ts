import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
// Lead capture (DB / LSQ / Sheets) now happens in /api/lead/capture at form-submit time.
// This route only generates + sends the OTP and builds the signed token.
// Zoom registration is intentionally deferred to /api/otp/verify so Zoom's
// own confirmation email only reaches users who have verified their number.
import { findRegistrationByEmailOrPhone, getWebinarConfig } from '@/lib/db';
import { sendWhatsAppOtp } from '@/lib/whatsapp';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fullName, email, phone, city, typeFilter, registrationId: incomingRegistrationId } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const config = await getWebinarConfig().catch(() => null);

    if (!config?.activeSessionId) {
      return NextResponse.json(
        { success: false, error: 'Registration is not currently open. Please check back when the next webinar is announced.' },
        { status: 503 },
      );
    }

    // Only reject VERIFIED duplicates — the lead was already captured as Unverified
    // in /api/lead/capture and findRegistrationByEmailOrPhone only returns Verified rows.
    const existing = await findRegistrationByEmailOrPhone(email, phone, config.activeSessionId);
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          error: 'This email or phone is already registered for this webinar. Check your inbox for the Zoom join link.',
        },
        { status: 409 },
      );
    }

    // Generate OTP & HMAC
    const otp = String(crypto.randomInt(1000, 9999));
    const expiry = Date.now() + 10 * 60 * 1000;
    const hmacSecret = requireEnv('OTP_HMAC_SECRET');
    if (hmacSecret.length < 32) throw new Error('OTP_HMAC_SECRET must be at least 32 chars');
    const hmac = crypto.createHmac('sha256', hmacSecret).update(`${phone}:${otp}:${expiry}`).digest('hex');

    // Send WhatsApp OTP
    const whatsappTemplate = config?.whatsappTemplateName?.trim() || 'form_otp';
    const zoomWebinarId = config?.zoomWebinarId?.trim() || null;
    const waResult = await sendWhatsAppOtp(phone, otp, whatsappTemplate);
    const waSuccess = waResult.status === 'sent';

    // registrationId comes from /api/lead/capture (step 1); embed in token so
    // /api/otp/verify can promote the same DB row to Verified.
    const registrationId: string | null =
      typeof incomingRegistrationId === 'string' && incomingRegistrationId
        ? incomingRegistrationId
        : null;

    const token = Buffer.from(JSON.stringify({
      expiry, hmac, fullName, email, phone, city, typeFilter,
      zoomWebinarId,
      registrationId,
    })).toString('base64');

    return NextResponse.json({
      success: true,
      token,
      fallback: !waSuccess,
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
