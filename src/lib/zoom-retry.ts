// Verified registrants whose Zoom registration failed get it retried.
//
// The join link comes from Zoom at OTP verification. When that call failed the
// registrant was verified with no link, and Mindbird's link messages (the
// confirmation, the 48-hour, 1-hour and "live now" reminders) all need one, so
// they got none of them and never saw a join link on WhatsApp. Rare (1 in
// about 1,900 over six sessions) but the person is left with no way in.
//
// Every run (cron): for the ACTIVE session only, while it has not started,
// register each verified row without a link with Zoom again, exactly as
// verification does. On success the link is saved and the "verified" event is
// sent to Mindbird again with it: the messages it needed are queued now, and
// the frequency caps stop the ones already queued (the 12-hour reminder) from
// going twice. No "@/" imports so `node --test` can load it; the cron route
// passes the real functions in.

export interface ZoomRetryRow { id: string; fullName: string; email: string; phone: string; city: string | null }

export interface ZoomRetryDeps {
  /** The active session as verification sees it. */
  activeSession: () => Promise<{ id: string; datetimeUtc: string | null; zoomWebinarId: string | null } | null>;
  missing: (sessionId: string, limit: number) => Promise<ZoomRetryRow[]>;
  register: (input: { email: string; firstName: string; lastName: string; phone: string; city: string; webinarId: string | null }) => Promise<{ ok: true; joinUrl: string } | { ok: false; error: string }>;
  save: (id: string, joinUrl: string) => Promise<void>;
  /** Send the row to Mindbird again with the "verified" event and its new link. */
  notify: (id: string, joinUrl: string) => Promise<void>;
}

export interface ZoomRetryResult { checked: number; fixed: number; failed: number; skipped: string | null }

/** The same split verification uses: first word, then the rest. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || "").split(" ").filter(Boolean);
  return { firstName: parts[0] || fullName || "", lastName: parts.slice(1).join(" ") };
}

export async function retryMissingZoomLinks(deps: ZoomRetryDeps, opts: { now?: number; limit?: number } = {}): Promise<ZoomRetryResult> {
  const now = opts.now ?? Date.now();
  const session = await deps.activeSession();
  if (!session) return { checked: 0, fixed: 0, failed: 0, skipped: "no active session" };
  const start = session.datetimeUtc ? Date.parse(session.datetimeUtc) : NaN;
  // Once it has started a link from here reaches nobody in time; and without a
  // start time we cannot tell, so nothing is retried rather than guessed.
  if (!Number.isFinite(start)) return { checked: 0, fixed: 0, failed: 0, skipped: "session has no start time" };
  if (start <= now) return { checked: 0, fixed: 0, failed: 0, skipped: "session has started" };

  const rows = await deps.missing(session.id, opts.limit ?? 20);
  const out: ZoomRetryResult = { checked: rows.length, fixed: 0, failed: 0, skipped: null };
  for (const row of rows) {
    try {
      const { firstName, lastName } = splitName(row.fullName);
      const r = await deps.register({ email: row.email, firstName, lastName, phone: row.phone, city: row.city ?? "", webinarId: session.zoomWebinarId });
      if (!r.ok || !r.joinUrl) { out.failed++; console.error(`[zoom-retry] ${row.id} still failing: ${r.ok ? "no join link" : r.error}`); continue; }
      await deps.save(row.id, r.joinUrl);
      await deps.notify(row.id, r.joinUrl);
      out.fixed++;
    } catch (err) {
      out.failed++;
      console.error(`[zoom-retry] ${row.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}
