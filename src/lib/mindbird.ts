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
  /** The session's database id: never changes, unlike the code an admin can edit. */
  id?: string | null;
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
  /** WhatsApp marketing consent from the form's tick box, with the wording shown. */
  consent?: { at: string; text: string } | null;
}

export interface McContactRow {
  phone: string;
  name: string;
  email: string;
  tags: string[];
  batches: string[];
  attributes: Record<string, string>;
  /** Sent only when the person ticked the box: Mindbird records it as their opt-in, once. */
  consent?: { grantedAt: string; text: string; method: string };
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
    // The round Mindbird's creatives are chosen by (rules read mc_session_id).
    mc_session_id: session.id ?? "",
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
    // "yes" only: an unticked box must never look like a withdrawal.
    mc_wa_consent: lead.consent ? "yes" : "",
  };
  // Mindbird keeps at most 500 characters per value. Empties are left out so a
  // later push never blanks a value an earlier one set — except the join link,
  // which belongs to one session: sent blank, it clears the last session's link.
  const ALWAYS = new Set(["mc_join_url"]);
  const attributes = Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => [k, String(v).trim().slice(0, 500)] as const).filter(([k, v]) => v !== "" || ALWAYS.has(k)),
  );
  return {
    phone: toMindbirdPhone(lead.phone),
    name: (lead.fullName ?? "").trim(),
    email: (lead.email ?? "").trim(),
    tags: ["masterclass", `mc-${session.code}`],
    batches: ["Masterclass", sessionBatchName(session)],
    attributes,
    ...(lead.consent ? { consent: { grantedAt: lead.consent.at, text: lead.consent.text, method: "masterclass registration form tick box" } } : {}),
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

const ATTENDANCE_EVENT_DAYS = 7;

/**
 * Attended / no-show events (which Mindbird's rules turn into messages) only
 * for a session that started in the last 7 days. A Zoom re-sync of an old
 * session updates the details but must not message people about a masterclass
 * weeks behind them.
 */
export function attendanceEventAllowed(session: McSession, now = Date.now()): boolean {
  const t = session.datetimeUtc ? Date.parse(session.datetimeUtc) : NaN;
  return Number.isFinite(t) && t <= now && now - t <= ATTENDANCE_EVENT_DAYS * 86_400_000;
}

// ── Campaign creatives ──────────────────────────────────────────────────────
//
// One image per WhatsApp template with an image header, plus a default, per
// session. Sent to Mindbird (PUT /api/creatives), which keeps its own copy and
// picks the right one for every message when it is SENT: the image of the
// session the message is about. See wa-broadcaster
// docs/superpowers/specs/2026-11-25-campaign-creatives-design.md.
//
// Works as soon as MINDBIRD_API_URL and MINDBIRD_API_KEY are set, without
// MINDBIRD_SYNC_ENABLED: loading creatives sends nobody a message, so they can
// be ready before the switch-over.

export const CREATIVE_SET = "masterclass";
const TEMPLATE_RE = /^[a-z0-9_]{1,512}$/;

export interface SessionCreatives {
  default: string | null;
  templates: Record<string, string>;
}

export interface CreativeItemResult {
  template: string | null;
  status: "stored" | "unchanged" | "refused";
  imageUrl?: string;
  reason?: string;
  warning?: string;
  keptPrevious?: boolean;
}

export interface CreativesSync {
  at: string;
  ok: boolean;
  error?: string;
  items?: CreativeItemResult[];
}

export function mindbirdConfigured(): boolean {
  return !!process.env.MINDBIRD_API_URL?.trim() && !!process.env.MINDBIRD_API_KEY?.trim();
}

/** A stored value made safe: only https links, only template-shaped names. */
export function cleanCreatives(raw: unknown): SessionCreatives {
  const out: SessionCreatives = { default: null, templates: {} };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { default?: unknown; templates?: unknown };
  const url = (v: unknown) => (typeof v === "string" && /^https:\/\//i.test(v.trim()) && v.trim().length <= 2000 ? v.trim() : null);
  out.default = url(r.default);
  if (r.templates && typeof r.templates === "object") {
    for (const [name, v] of Object.entries(r.templates as Record<string, unknown>)) {
      const u = url(v);
      if (u && TEMPLATE_RE.test(name)) out.templates[name] = u;
    }
  }
  return out;
}

export function creativeItems(c: SessionCreatives): { template: string | null; imageUrl: string }[] {
  return [
    ...(c.default ? [{ template: null, imageUrl: c.default }] : []),
    ...Object.entries(c.templates).sort(([a], [b]) => a.localeCompare(b)).map(([template, imageUrl]) => ({ template, imageUrl })),
  ];
}

/** Image templates with no image: covered by their own image or the default. */
export function missingImageTemplates(imageTemplates: string[], c: SessionCreatives): string[] {
  if (c.default) return [];
  return imageTemplates.filter(t => !c.templates[t]);
}

async function call(method: "GET" | "PUT", path: string, body: unknown, timeoutMs: number): Promise<{ ok: boolean; status?: number; json?: unknown; error?: string }> {
  try {
    const res = await fetch(`${process.env.MINDBIRD_API_URL!.replace(/\/+$/, "")}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MINDBIRD_API_KEY}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await res.json().catch(() => null);
    if (res.ok) return { ok: true, status: res.status, json };
    const said = (json as { error?: string } | null)?.error;
    return { ok: false, status: res.status, error: said ? String(said).slice(0, 300) : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}

/**
 * Send one session's creatives to Mindbird. Never throws. `version` is the
 * save time, so an older save that arrives late cannot overwrite a newer one.
 * The whole set goes every time: Mindbird keeps unchanged links without
 * downloading them again.
 */
export async function pushSessionCreatives(
  session: McSession & { id: string; status?: string | null },
  creatives: SessionCreatives,
  opts: { version?: number; timeoutMs?: number } = {},
): Promise<CreativesSync> {
  const at = new Date().toISOString();
  if (!mindbirdConfigured()) return { at, ok: false, error: "Mindbird is not connected (MINDBIRD_API_URL / MINDBIRD_API_KEY)." };
  const r = await call("PUT", "/api/creatives", {
    set: CREATIVE_SET,
    ref: session.id,
    label: (session.dateLabel || session.title || session.code).trim(),
    startsAt: session.datetimeUtc || null,
    batchName: sessionBatchName(session),
    setBatchName: "Masterclass",
    current: session.status === "active",
    version: opts.version ?? Date.now(),
    items: creativeItems(creatives),
  }, opts.timeoutMs ?? 55_000);
  if (!r.ok) return { at, ok: false, error: r.error };
  const j = (r.json ?? {}) as { ignored?: boolean; reason?: string; items?: CreativeItemResult[] };
  if (j.ignored) return { at, ok: false, error: j.reason ?? "Mindbird already has a newer save of this session." };
  const items = j.items ?? [];
  return { at, ok: items.every(i => i.status !== "refused"), items };
}

/** What Mindbird holds for a session, and its image templates. Never throws. */
export async function sessionCreativeStatus(sessionId: string): Promise<{ ok: boolean; error?: string; imageTemplates?: string[]; held?: { template: string | null; imageUrl: string }[] }> {
  if (!mindbirdConfigured()) return { ok: false, error: "Mindbird is not connected." };
  const r = await call("GET", `/api/creatives?set=${CREATIVE_SET}&ref=${encodeURIComponent(sessionId)}`, undefined, 15_000);
  if (!r.ok) return { ok: false, error: r.error };
  const j = (r.json ?? {}) as { imageTemplates?: string[]; round?: { items?: { template: string | null; imageUrl: string }[] } | null };
  return { ok: true, imageTemplates: j.imageTemplates ?? [], held: j.round?.items ?? [] };
}
