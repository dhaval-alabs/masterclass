// The WhatsApp daily send limit — the ONE place it's decided.
//
// Before this, the limit was read in five places from two different settings:
// the server used WA_DAILY_LIMIT (default 900) and the WhatsApp tab's display
// used a separate NEXT_PUBLIC_WA_DAILY_LIMIT, so changing one made the screen
// and the actual sending disagree.
//
// Two ceilings apply, and the lower one wins:
//   1. Our own limit — WA_DAILY_LIMIT, default 3,000.
//   2. Meta's messaging tier for the broadcast number — the most UNIQUE people
//      it may start conversations with per rolling 24h. Read live from Meta.
//      On 2026-10-08 that was TIER_2K: a flat 3,000 would have sent ~1,000 a
//      day straight into Meta's wall. Meta raises the tier automatically as a
//      number keeps using it with good quality; when it does, the higher of our
//      limit takes effect here with no change.
//
// The "day" starts at 09:00 IST, not midnight UTC. Whatever a day's limit
// doesn't cover stays queued and resumes at 09:00 IST — previously "next day"
// meant midnight UTC, so leftover broadcasts started arriving at 05:30 IST.
//
// Deliberately dependency-free (reads env directly rather than importing
// getBroadcastCreds) so db.ts can use it without an import cycle.

const GRAPH = 'https://graph.facebook.com/v22.0';
const IST_OFFSET_MIN = 5 * 60 + 30;

/** Our own daily ceiling, before Meta's tier is applied. */
export function appDailyLimit(): number {
  const n = parseInt(process.env.WA_DAILY_LIMIT ?? '3000', 10);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/** IST hour at which the daily window resets (default 9 → 09:00 IST). */
export function dayStartHourIst(): number {
  const n = parseInt(process.env.WA_DAY_START_HOUR_IST ?? '9', 10);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : 9;
}

/** Start of the current sending day: the most recent HH:00 IST at or before `now`. */
export function waDayStart(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);   // IST wall clock, held in UTC fields
  const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), dayStartHourIst(), 0, 0, 0));
  if (start.getTime() > ist.getTime()) start.setUTCDate(start.getUTCDate() - 1);
  return new Date(start.getTime() - IST_OFFSET_MIN * 60_000);       // back to a real UTC instant
}

/** When today's limit resets and queued messages resume. */
export function nextWaDayStart(now: Date = new Date()): Date {
  return new Date(waDayStart(now).getTime() + 24 * 60 * 60_000);
}

/** "9:00 AM IST" — for UI copy. */
export function dayStartLabel(): string {
  const h = dayStartHourIst();
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'} IST`;
}

const TIER_LIMITS: Record<string, number> = {
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_2K: 2_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: Number.POSITIVE_INFINITY,
};

// Tiers change rarely; checking once an hour is plenty. If Meta can't be
// reached we keep using the last tier we saw rather than dropping the ceiling.
const TIER_TTL_MS = 60 * 60 * 1000;
let tierCache: { at: number; tier: string; limit: number } | null = null;

/** Meta's messaging tier for the broadcast number, or null if never readable. */
export async function metaTier(): Promise<{ tier: string; limit: number } | null> {
  if (tierCache && Date.now() - tierCache.at < TIER_TTL_MS) return tierCache;
  // Same fallback order as getBroadcastCreds() in whatsapp.ts.
  const token = process.env.META_WA_BROADCAST_ACCESS_TOKEN || process.env.META_WA_ACCESS_TOKEN;
  const phoneId = process.env.META_WA_BROADCAST_PHONE_NUMBER_ID || process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) return tierCache;
  try {
    const res = await fetch(`${GRAPH}/${phoneId}?fields=whatsapp_business_manager_messaging_limit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return tierCache;
    const data = await res.json() as { whatsapp_business_manager_messaging_limit?: string };
    const tier = data.whatsapp_business_manager_messaging_limit;
    if (!tier || !(tier in TIER_LIMITS)) return tierCache;
    tierCache = { at: Date.now(), tier, limit: TIER_LIMITS[tier] };
    return tierCache;
  } catch {
    return tierCache;
  }
}

export interface DailyLimitInfo {
  /** What actually gets enforced: the lower of the two ceilings. */
  limit: number;
  appLimit: number;
  /** Meta's tier ceiling, or null if it couldn't be read. */
  metaLimit: number | null;
  metaTier: string | null;
  /** Which ceiling is binding right now. */
  constrainedBy: 'app' | 'meta';
}

export async function dailyLimitInfo(): Promise<DailyLimitInfo> {
  const appLimit = appDailyLimit();
  const meta = await metaTier();
  const metaLimit = meta && Number.isFinite(meta.limit) ? meta.limit : null;
  const limit = metaLimit !== null ? Math.min(appLimit, metaLimit) : appLimit;
  return {
    limit,
    appLimit,
    metaLimit,
    metaTier: meta?.tier ?? null,
    constrainedBy: metaLimit !== null && metaLimit < appLimit ? 'meta' : 'app',
  };
}

/** The limit to enforce today. */
export async function effectiveDailyLimit(): Promise<number> {
  return (await dailyLimitInfo()).limit;
}

// The daily limit is shared by bulk campaigns and per-person automations (OTP
// nudge, welcome, T-3d/T-1d/T-1h reminders). A broadcast several times the
// limit would otherwise take the WHOLE allowance every day it drains — and the
// automations for the very masterclass it's promoting would get nothing.
// Bulk drains leave this slice for automations; WA_AUTOMATION_RESERVE
// overrides the default of 20%.
export function automationReserve(dailyLimit: number): number {
  const raw = process.env.WA_AUTOMATION_RESERVE;
  const n = raw !== undefined && raw.trim() !== '' ? parseInt(raw, 10) : Math.round(dailyLimit * 0.2);
  return Number.isFinite(n) ? Math.min(Math.max(0, n), dailyLimit) : 0;
}
