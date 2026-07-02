import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
// Lead capture (DB / LSQ / Sheets) now happens in /api/lead/capture at form-submit time.
// This route only generates + sends the OTP and builds the signed token.
// Zoom registration is intentionally deferred to /api/otp/verify so Zoom's
// own confirmation email only reaches users who have verified their number.
import { findRegistrationByEmailOrPhone, getWebinarConfig, recordOtpSendResult } from '@/lib/db';
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

    // OTP requirement is per-session (admin toggle). When disabled, skip the
    // WhatsApp call entirely — the client finalizes registration directly via
    // /api/otp/verify, which re-checks otpRequired server-side so a client
    // can't bypass a session that still requires OTP.
    const otpRequired = config?.otpRequired !== false;

    // Send WhatsApp OTP via xBot (delivers the code we generated + signed).
    const zoomWebinarId = config?.zoomWebinarId?.trim() || null;
    const waResult = otpRequired
      ? await sendWhatsAppOtp({ phone, otp, fullName, email, city })
      : { status: 'skipped' as const, error: null, messageId: null };
    const waSuccess = waResult.status === 'sent';

    // registrationId comes from /api/lead/capture (step 1); embed in token so
    // /api/otp/verify can promote the same DB row to Verified.
    const registrationId: string | null =
      typeof incomingRegistrationId === 'string' && incomingRegistrationId
        ? incomingRegistrationId
        : null;

    // Persist the send outcome onto the lead row created in /api/lead/capture.
    // Before this, the row stayed 'pending' forever regardless of what Meta
    // said, which is why OTP failures were invisible. Awaited (not fire-and-
    // forget) because the serverless function may freeze right after responding.
    // Best-effort: a telemetry write failure must not break the user's flow.
    if (registrationId) {
      try {
        await recordOtpSendResult(registrationId, {
          whatsappStatus: otpRequired ? waResult.status : 'otp_disabled',
          whatsappError: waResult.error,
          whatsappMessageId: waResult.messageId ?? null,
        });
      } catch (err) {
        console.error('[otp/send] recordOtpSendResult failed:', err);
      }
    }

    const token = Buffer.from(JSON.stringify({
      expiry, hmac, fullName, email, phone, city, typeFilter,
      zoomWebinarId,
      registrationId,
    })).toString('base64');

    return NextResponse.json({
      success: true,
      token,
      // fallback = WhatsApp send failed while OTP was required (legacy behaviour).
      fallback: otpRequired && !waSuccess,
      // otpDisabled = admin turned OTP off for this session; the client should
      // skip the OTP screen and finalize registration directly.
      otpDisabled: !otpRequired,
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
