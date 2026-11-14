// Classifies a WhatsApp failure by its Meta error code so the rest of the system
// can react correctly instead of treating every failure the same.
//
// Why this exists: a "never attended" broadcast failed ~4,000 of 6,111. Some of
// those are permanent per-person outcomes (number not on WhatsApp, Meta declining
// a marketing message to someone it considers over-messaged). Retrying those is
// pointless and hurts the number's quality rating — while the old code ALSO let a
// run of 5 such people abort the whole chunk as if the token were broken.
//
// error_detail is stored as "code=131049: <message>" by both the send path and
// the delivery webhook, so the code is parsed back out of the text.

export type WaErrorKind =
  | 'not_on_whatsapp'   // permanent: number can't receive WhatsApp (131026 etc.)
  | 'meta_filtered'     // Meta chose not to deliver this marketing message (131049, 130472)
  | 'transient'         // rate limit / outage — worth retrying later
  | 'config'            // template / token / account problem — affects EVERYONE, stop and fix
  | 'unknown';

const NOT_ON_WHATSAPP = new Set([131026, 131021, 131030, 1013]);
const META_FILTERED   = new Set([131049, 130472]);
const TRANSIENT       = new Set([1, 2, 4, 17, 80007, 130429, 131000, 131016, 131056, 133004, 133005]);
const CONFIG          = new Set([100, 190, 368, 131008, 131009, 131031, 131037, 131042, 131047, 131051, 131052, 131053, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 132069]);

export function waErrorCode(detail: string | null | undefined): number | null {
  const m = /code=(\d+)/.exec(detail ?? '');
  return m ? parseInt(m[1], 10) : null;
}

export function classifyWaError(detail: string | null | undefined): WaErrorKind {
  const text = detail ?? '';
  const code = waErrorCode(text);
  if (code !== null) {
    if (NOT_ON_WHATSAPP.has(code)) return 'not_on_whatsapp';
    if (META_FILTERED.has(code))   return 'meta_filtered';
    if (TRANSIENT.has(code))       return 'transient';
    if (CONFIG.has(code))          return 'config';
  }
  if (/^HTTP 5\d\d/.test(text) || /^HTTP 429/.test(text)) return 'transient';
  if (/Aborted after \d+ consecutive failures/.test(text)) return 'transient'; // cut off by us, never actually tried
  if (text === '' || /fetch failed|ECONN|ETIMEDOUT|network/i.test(text)) return 'transient';
  return 'unknown';
}

/** Failures about THE PERSON — they say nothing about whether the next send will work. */
export function isRecipientLevelError(kind: WaErrorKind): boolean {
  return kind === 'not_on_whatsapp' || kind === 'meta_filtered';
}

/** Worth re-sending to? Permanent / Meta-filtered outcomes are not. */
export function isRetryable(kind: WaErrorKind): boolean {
  return !isRecipientLevelError(kind);
}

export const WA_ERROR_LABEL: Record<WaErrorKind, string> = {
  not_on_whatsapp: 'Number not on WhatsApp / undeliverable',
  meta_filtered: 'Meta declined to deliver (marketing frequency / engagement filter)',
  transient: 'Temporary (rate limit / outage / cut off)',
  config: 'Template, token or account problem',
  unknown: 'Other / unknown',
};
