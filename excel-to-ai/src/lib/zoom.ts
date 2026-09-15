function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const accountId = requireEnv('ZOOM_ACCOUNT_ID');
  const clientId = requireEnv('ZOOM_CLIENT_ID');
  const clientSecret = requireEnv('ZOOM_CLIENT_SECRET');

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 401/400 from token endpoint usually means wrong account_id, client_id, or secret.
    throw new Error(`Zoom OAuth failed [HTTP ${res.status}]: ${body || '(empty body)'}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, (data.expires_in - 60)) * 1000,
  };
  return data.access_token;
}

export type ZoomRegistrantInput = {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  city?: string;
  /** Optional override for ZOOM_WEBINAR_ID env var (sourced from admin DB). */
  webinarId?: string | null;
};

/**
 * Some Zoom accounts strictly validate the phone field and reject raw 10-digit
 * Indian numbers. Normalize to E.164 (+91...) when the input looks Indian.
 */
function normalizePhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (raw.trim().startsWith('+')) return raw.trim();
  return `+${digits}`;
}

export type ZoomRegistrationResult =
  | { ok: true; joinUrl: string; registrantId: string }
  | { ok: false; error: string };

function describeZoomError(status: number, body: any): string {
  // Zoom error shape: { code: 300, message: '...', errors?: [{ field, message }] }
  const parts: string[] = [`HTTP ${status}`];
  if (body?.code != null) parts.push(`code=${body.code}`);
  if (body?.message) parts.push(body.message);
  if (Array.isArray(body?.errors) && body.errors.length) {
    const fieldErrors = body.errors
      .map((e: any) => `${e.field ?? '?'}: ${e.message ?? JSON.stringify(e)}`)
      .join(' | ');
    parts.push(`fields=[${fieldErrors}]`);
  }
  return parts.join(' ');
}

export async function registerWebinarParticipant(
  input: ZoomRegistrantInput
): Promise<ZoomRegistrationResult> {
  try {
    const webinarId = input.webinarId?.trim() || requireEnv('ZOOM_WEBINAR_ID');
    if (!/^\d{9,12}$/.test(webinarId)) {
      return { ok: false, error: `Zoom webinar ID looks invalid (expected 9-12 digits): ${webinarId}` };
    }

    // Zoom rejects empty first_name with a confusing error.
    const firstName = (input.firstName || '').trim();
    if (!firstName) {
      return { ok: false, error: 'first_name is empty — cannot register with Zoom' };
    }

    const token = await getZoomAccessToken();

    const payload: Record<string, string> = {
      email: input.email,
      first_name: firstName,
      last_name: (input.lastName || '').trim(),
    };
    const normalizedPhone = normalizePhone(input.phone);
    if (normalizedPhone) payload.phone = normalizedPhone;
    if (input.city) payload.city = input.city;

    const res = await fetch(
      `https://api.zoom.us/v2/webinars/${webinarId}/registrants`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      // If the token was rejected, clear cache so the next attempt re-auths.
      if (res.status === 401) tokenCache = null;
      return { ok: false, error: `Zoom registrant create failed: ${describeZoomError(res.status, body)}` };
    }

    if (!body?.join_url) {
      return {
        ok: false,
        error: 'Zoom returned 200 but no join_url. Webinar Approval is likely set to "Manually Approve" — change to "Automatically Approve".',
      };
    }

    return {
      ok: true,
      joinUrl: body.join_url,
      registrantId: String(body.registrant_id ?? body.id ?? ''),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Post-webinar attendance reporting ──────────────────────────────────────

export type ZoomAttendee = {
  email: string;          // lowercased for matching
  name: string;
  joinTime: string;       // ISO from Zoom
  leaveTime: string | null;
  durationMin: number;    // total minutes attended (sum across sessions if Zoom paginated)
};

export type ZoomAttendeesResult =
  | { ok: true; attendees: ZoomAttendee[]; webinarId: string }
  | { ok: false; error: string };

/**
 * Pulls participants from Zoom's Report API for a finished webinar.
 *
 * NOTES:
 *   - Zoom's report data is only available ~30 minutes after the webinar ends.
 *     Running this before then returns an empty list or a 400.
 *   - The same person can appear multiple times if they joined-then-left-then-
 *     rejoined. We dedupe by lowercase email and sum their durations.
 *   - Requires the S2S OAuth app to have the scope:
 *       report:read:admin (or report_participants:read:admin)
 *     If you get a 4711 error, add that scope in Zoom Marketplace and revoke
 *     existing tokens.
 */
export async function fetchWebinarAttendees(
  webinarId?: string | null,
): Promise<ZoomAttendeesResult> {
  try {
    const id = webinarId?.trim() || requireEnv('ZOOM_WEBINAR_ID');
    if (!/^\d{9,12}$/.test(id)) {
      return { ok: false, error: `Zoom webinar ID looks invalid (expected 9-12 digits): ${id}` };
    }

    const token = await getZoomAccessToken();

    // Aggregate across pages — Zoom returns up to 300 participants per page.
    type RawParticipant = {
      id?: string;
      user_id?: string;
      name?: string;
      user_email?: string;
      join_time?: string;
      leave_time?: string;
      duration?: number; // SECONDS in /report/webinars endpoint
    };
    const collected: RawParticipant[] = [];
    let nextPageToken = '';

    do {
      const url = new URL(`https://api.zoom.us/v2/report/webinars/${id}/participants`);
      url.searchParams.set('page_size', '300');
      if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) tokenCache = null;
        const body = await res.json().catch(() => null);
        return { ok: false, error: `Zoom report fetch failed: ${describeZoomError(res.status, body)}` };
      }

      const body = (await res.json().catch(() => null)) as {
        participants?: RawParticipant[];
        next_page_token?: string;
      } | null;

      if (!body) {
        return { ok: false, error: 'Zoom returned 200 but body was not JSON' };
      }

      if (Array.isArray(body.participants)) collected.push(...body.participants);
      nextPageToken = body.next_page_token || '';
    } while (nextPageToken);

    // Dedupe by lowercase email; sum durations across re-joins.
    const byEmail = new Map<string, ZoomAttendee>();
    for (const p of collected) {
      const email = (p.user_email || '').trim().toLowerCase();
      if (!email) continue; // skip anonymous joiners
      const durSec = typeof p.duration === 'number' ? p.duration : 0;
      const durMin = Math.round(durSec / 60);
      const existing = byEmail.get(email);
      if (existing) {
        existing.durationMin += durMin;
        if (p.join_time && p.join_time < existing.joinTime) existing.joinTime = p.join_time;
        if (p.leave_time && (!existing.leaveTime || p.leave_time > existing.leaveTime)) {
          existing.leaveTime = p.leave_time;
        }
      } else {
        byEmail.set(email, {
          email,
          name: (p.name || '').trim(),
          joinTime: p.join_time || new Date().toISOString(),
          leaveTime: p.leave_time || null,
          durationMin: durMin,
        });
      }
    }

    return { ok: true, attendees: Array.from(byEmail.values()), webinarId: id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Re-export the token cache invalidation hook so callers can reset on 401.
// (Module-level `tokenCache` is already used internally; this comment is for
// future maintainers — no extra export needed.)

