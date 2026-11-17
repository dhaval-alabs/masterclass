// Masterclass registrations → Mindbird, the organisation's WhatsApp system.
//
// Every masterclass campaign (broadcasts, the verify / welcome / no-show
// automations, the reminders before a session) runs from the Mindbird portal.
// This file is the only thing that talks to it: each registration and each
// status change is sent as a contact (tags, batches, mc_* details) plus an
// event that Mindbird's API rules act on.
//
// OFF unless MINDBIRD_SYNC_ENABLED=1 and MINDBIRD_API_URL + MINDBIRD_API_KEY are
// set. Never throws and gives up after 5 s: a registration must not fail or
// wait because Mindbird is slow or down. No "@/" imports, so `node --test` can
// load it directly (src/lib/mindbird.test.ts). scripts/backfill-to-mindbird.mjs
// repeats buildContactRow's mapping — change both together.

export type McEvent = "mc_registered" | "mc_verified" | "mc_attended" | "mc_no_show";

export interface McSession {
  code: string;
  title: string;
  dateLabel: string | null;
  datetimeUtc: string | null;
}

export interface McLead {
  phone: string;
  fullName: string;
  email: string;
  city?: string | null;
  currentStatus?: string | null;
  verified: boolean;
  attended: boolean | null;     // null = not synced from Zoom yet
  registeredAt: string;
  joinUrl?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
}

export interface McContactRow {
  phone: string;
  name: string;
  email: string;
  tags: string[];
  batches: string[];
  attributes: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export function mindbirdEnabled(): boolean {
  return process.env.MINDBIRD_SYNC_ENABLED === "1" && !!process.env.MINDBIRD_API_URL?.trim() && !!process.env.MINDBIRD_API_KEY?.trim();
}

/** Digits only; a bare Indian number (10 digits, or 0 + 10) gets 91 in front. */
export function toMindbirdPhone(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

function isoOrEmpty(v: string | null | undefined): string {
  if (!v) return "";
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

export function sessionBatchName(s: McSession): string {
  return `Masterclass · ${(s.dateLabel || s.title || s.code).trim()}`;
}

export function buildContactRow(lead: McLead, session: McSession): McContactRow {
  const attrs: Record<string, string> = {
    mc_session: session.code,
    mc_session_title: session.title,
    mc_session_date: session.dateLabel ?? "",
    mc_session_at: isoOrEmpty(session.datetimeUtc),
    mc_verified: lead.verified ? "yes" : "no",
    mc_attended: lead.attended === true ? "yes" : lead.attended === false ? "no" : "pending",
    mc_registered_at: isoOrEmpty(lead.registeredAt),
    mc_join_url: lead.joinUrl ?? "",
    mc_city: lead.city ?? "",
    mc_current_status: lead.currentStatus ?? "",
    mc_utm_source: lead.utm?.source ?? "",
    mc_utm_medium: lead.utm?.medium ?? "",
    mc_utm_campaign: lead.utm?.campaign ?? "",
  };
  // Mindbird keeps at most 500 characters per value; empties are left out so a
  // later push never blanks a value an earlier one set.
  const attributes = Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => [k, String(v).trim().slice(0, 500)] as const).filter(([, v]) => v !== ""),
  );
  return {
    phone: toMindbirdPhone(lead.phone),
    name: (lead.fullName ?? "").trim(),
    email: (lead.email ?? "").trim(),
    tags: ["masterclass", `mc-${session.code}`],
    batches: ["Masterclass", sessionBatchName(session)],
    attributes,
  };
}

async function post(path: string, body: unknown, timeoutMs: number): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(`${process.env.MINDBIRD_API_URL!.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MINDBIRD_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) return { ok: true, status: res.status };
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text.slice(0, 300) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

/** Up to 1,000 contacts per call (Mindbird's cap). skipAutomations = an import. */
export function pushMasterclassLeads(rows: McContactRow[], opts: { skipAutomations?: boolean; timeoutMs?: number } = {}) {
  return post("/api/contacts", { contacts: rows, overwriteAttributes: true, ...(opts.skipAutomations ? { skipAutomations: true } : {}) }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

export function sendMindbirdEvent(event: McEvent, row: McContactRow, opts: { timeoutMs?: number } = {}) {
  return post("/api/events", { event, phone: row.phone, name: row.name, data: row.attributes }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
}

/**
 * Send one lead's current state to Mindbird, then (when given) the event that
 * Mindbird's rules act on. The contact goes first so a rule that reads the
 * contact sees the new details. No-op when switched off; never throws.
 */
export async function syncLead(lead: McLead, session: McSession, event?: McEvent, opts: { timeoutMs?: number } = {}): Promise<void> {
  if (!mindbirdEnabled()) return;
  try {
    const row = buildContactRow(lead, session);
    if (row.phone.length < 10) return;
    const pushed = await pushMasterclassLeads([row], opts);
    if (!pushed.ok) console.error(`[mindbird] contact push failed (${pushed.status ?? "no response"}): ${pushed.error ?? ""}`);
    if (!event) return;
    const sent = await sendMindbirdEvent(event, row, opts);
    if (!sent.ok) console.error(`[mindbird] ${event} failed (${sent.status ?? "no response"}): ${sent.error ?? ""}`);
  } catch (err) {
    console.error("[mindbird] sync failed:", err);
  }
}
