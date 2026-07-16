// Thin client for the shared WABA OTP microservice (wa-broadcaster, exposed at
// waba.analytixlabs.co.in). That service GENERATES, DELIVERS (Meta WhatsApp
// AUTHENTICATION template) and VERIFIES the code — we never see the code or
// hold an HMAC anymore. Auth is a shared secret sent as `x-otp-secret`.
//
// Env:
//   OTP_API_SECRET    (required)  — same value configured on the portal
//   OTP_API_BASE_URL  (optional)  — defaults to https://waba.analytixlabs.co.in
//   OTP_AREA          (optional)  — routing area / number; defaults to "PPC"

const BASE_URL = (process.env.OTP_API_BASE_URL || 'https://waba.analytixlabs.co.in').replace(/\/+$/, '');
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
    const res = await fetch(`${BASE_URL}/api/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-otp-secret': secret() },
      body: JSON.stringify({ phone: toServicePhone(phone), area }),
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
