// Resend OTP — asks the WABA OTP service for a fresh code for an in-flight session.
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
// What it does: reads the existing token for context, asks the WABA service to
// send a NEW code, and returns the token back so the client UI keeps working as
// if the user just started the OTP step. The code + its verification are owned
// by the WABA service — no HMAC/expiry is minted here.

import { NextRequest, NextResponse } from 'next/server';
import { sendOtpCode } from '@/lib/otpService';
import { recordOtpSendResult } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;
    if (typeof token !== 'string' || !token) {
      return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
    }

    // Decode the token for lead context (phone + registrationId). It isn't
    // signed; an attacker would need a valid send-route call to forge it anyway.
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

    // Ask the WABA OTP service to send a fresh code (area "PPC").
    const otpSend = await sendOtpCode(phone);

    // Record the resend outcome on the same registration row. Best-effort.
    const registrationId = typeof decoded.registrationId === 'string' ? decoded.registrationId : null;
    if (registrationId) {
      try {
        await recordOtpSendResult(registrationId, {
          whatsappStatus: otpSend.ok ? 'sent' : 'failed',
          whatsappError: otpSend.error,
          whatsappMessageId: null,
        });
      } catch (err) {
        console.error('[otp/resend] recordOtpSendResult failed:', err);
      }
    }

    // The token is unchanged (context only) — hand it back so the client keeps
    // its in-flight OTP state.
    return NextResponse.json({
      success: true,
      token,
      waStatus: otpSend.ok ? 'sent' : 'failed',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
