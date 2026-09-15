// Thin client for the shared WABA OTP microservice (wa-broadcaster, exposed at
// waba.analytixlabs.co.in). That service GENERATES, DELIVERS (Meta WhatsApp
// AUTHENTICATION template) and VERIFIES the code — we never see the code or
// hold an HMAC anymore. Auth is a shared secret sent as `x-otp-secret`.
//
// Env:
//   OTP_API_SECRET    (required)  — same value configured on the portal
//   OTP_API_BASE_URL  (optional)  — defaults to https://waba.analytixlabs.co.in
//   OTP_AREA          (optional)  — routing area / number. Defaults to "PPC"
//                                   (see below); set this to override.

const BASE_URL = (process.env.OTP_API_BASE_URL || 'https://waba.analytixlabs.co.in').replace(/\/+$/, '');
// The WABA service's DEFAULT number (used when "area" is omitted) is the
// "Organic" channel — confirmed via Meta Graph API on 15 Sep 2026 to be
// BANNED (quality_rating RED, status BANNED). It accepts the send API call
// and returns a real message id, so failures here are invisible to both this
// client and the caller — the code silently never arrives. "PPC" is the
// "PPC SM" channel, confirmed healthy (quality_rating GREEN, CONNECTED) the
// same day. Defaulting here — not leaving it to an env var — means masterclass
// can't regress to the banned number by a missing/blank OTP_AREA the way
// OTP_API_SECRET once regressed to a placeholder value in .env.local.
const DEFAULT_AREA = process.env.OTP_AREA || 'PPC';

function secret(): string {
  const s = process.env.OTP_API_SECRET;
  if (!s) throw new Error('Missing required env var: OTP_API_SECRET');
  return s;
}

/**
 * The service normalizes to digits and delivers via Meta, so it needs the full
 * number WITH country code. Our form collects a bare 10-digit Indian mobile, so
 * prepend 91. Anything already carrying a country code (>10 digits) is left as-is.
 */
function toServicePhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.length === 10 ? `91${d}` : d;
}

export type OtpSendResult = {
  ok: boolean;
  error: string | null;
  retryAfterSeconds?: number;
  status?: number;
};

/** Ask the service to generate + WhatsApp a fresh code to this phone. */
export async function sendOtpCode(phone: string, area: string = DEFAULT_AREA): Promise<OtpSendResult> {
  try {
    // Only include "area" when we actually have one. Omitting it makes the WABA
    // service route to the DEFAULT number (per the portal's integration note),
    // instead of a named area like "PPC".
    const trimmedArea = (area || '').trim();
    const body = trimmedArea
      ? { phone: toServicePhone(phone), area: trimmedArea }
      : { phone: toServicePhone(phone) };
    const res = await fetch(`${BASE_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-otp-secret': secret() },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: string; retryAfterSeconds?: number }
      | null;
    if (!res.ok || !data?.success) {
      return {
        ok: false,
        error: data?.error || `OTP send failed (HTTP ${res.status})`,
        retryAfterSeconds: data?.retryAfterSeconds,
        status: res.status,
      };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type OtpVerifyResult = { valid: boolean; reason: string | null };

/** Check a code the user typed. The service always 200s with { valid, reason? }. */
export async function verifyOtpCode(phone: string, code: string): Promise<OtpVerifyResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-otp-secret': secret() },
      body: JSON.stringify({ phone: toServicePhone(phone), code: String(code || '').trim() }),
    });
    const data = (await res.json().catch(() => null)) as { valid?: boolean; reason?: string; error?: string } | null;
    if (!res.ok || !data) {
      return { valid: false, reason: data?.error || `http_${res.status}` };
    }
    return { valid: !!data.valid, reason: data.reason ?? null };
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
