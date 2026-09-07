// ── Shared LeadSquared write client (retry + delivery confirmation) ──────────
// LSQ is the CRM system-of-record. Several routes write to it (Lead.Capture on
// registration, Lead.Update on OTP-verify, score/rescore/attendance tags). These
// writes used to be single-attempt fire-and-forget, so a transient LSQ 5xx (or a
// network blip) silently dropped the CRM update even though the caller returned
// 200 to the user — leaving, e.g., a VERIFIED lead still marked Unverified in the
// CRM, which mis-scores and mis-routes it for sales.
//
// This helper centralizes the retry policy so every LSQ write gets the same
// behaviour proven on the capture path: a few attempts with backoff, stop early
// on a non-retryable 4xx (bad key / bad payload won't succeed on retry), and a
// definitive delivered/failed outcome the caller logs.

export interface LsqWriteResult {
  ok: boolean;
  status: number | null;
  attempts: number;
  error?: string;
  /**
   * LSQ's own ExceptionType when it reports an error in the BODY of a 200.
   * Callers branch on this — notably 'MXDuplicateEntryException', which is not
   * a transient failure but a signal to update the existing lead instead.
   */
  exceptionType?: string;
}

// LSQ answers HTTP 200 and puts the failure in the body:
//   {"Status":"Error","ExceptionType":"MXDuplicateEntryException", ...}
// Treating res.ok as success therefore reports dropped writes as delivered —
// which is exactly how Lead.Capture silently discarded the entire payload for
// every registrant whose phone was already in LSQ, while the log said
// "capture delivered". Parse the body and believe it over the status code.
function readLsqBodyError(raw: string): { type?: string; message?: string } | null {
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as { Status?: string; ExceptionType?: string; ExceptionMessage?: string };
    if (typeof b?.Status === 'string' && b.Status.toLowerCase() === 'error') {
      return { type: b.ExceptionType, message: b.ExceptionMessage };
    }
  } catch {
    // Non-JSON 200 — nothing to extract; fall through and trust the status.
  }
  return null;
}

// Retrying these will fail identically every time: the payload, not the network,
// is the problem. Fail fast so the caller can act on it.
const NON_RETRYABLE_LSQ_EXCEPTIONS = new Set([
  'MXDuplicateEntryException',
  'MXInvalidLeadException',
  'MXInvalidFieldException',
]);

/**
 * POST a JSON body to an LSQ endpoint with retry + delivery confirmation.
 *
 * @param url        Fully-qualified LSQ endpoint (access/secret keys already in the query string).
 * @param body       JSON-serializable payload.
 * @param label      Short tag for logs, e.g. 'capture' or 'verify' → "[LSQ] <label> ...".
 * @param ctx        Optional context string for logs (e.g. "reg=abc" or "phone=…").
 * @param maxAttempts Total attempts including the first (default 3).
 */
export async function lsqPostWithRetry(
  url: string,
  body: unknown,
  label: string,
  ctx?: string | null,
  maxAttempts = 3,
): Promise<LsqWriteResult> {
  const where = ctx ? ` (${ctx})` : '';
  let lastStatus: number | null = null;
  let lastError: string | undefined;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      lastStatus = res.status;
      const raw = await res.text().catch(() => '');
      if (res.ok) {
        const bodyErr = readLsqBodyError(raw);
        if (!bodyErr) {
          console.log(`[LSQ] ${label} delivered on attempt ${attempt}/${maxAttempts}${where}`);
          return { ok: true, status: res.status, attempts: attempt };
        }
        lastError = `${bodyErr.type ?? 'LSQ error'}: ${bodyErr.message ?? ''}`.trim();
        if (bodyErr.type && NON_RETRYABLE_LSQ_EXCEPTIONS.has(bodyErr.type)) {
          console.error(`[LSQ] ${label} REJECTED${where}: ${lastError}`);
          return { ok: false, status: res.status, attempts: attempt, error: lastError, exceptionType: bodyErr.type };
        }
        // Some other in-body error — worth one more try.
      } else {
        lastError = `HTTP ${res.status}`;
      }
      // 4xx (bad payload / bad key) will not succeed on retry — stop early.
      // 429 (rate limit) IS worth retrying, so it's excluded from the early break.
      if (!res.ok && res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt)); // 400ms, then 800ms
  }
  console.error(`[LSQ] ${label} FAILED after ${attempt} attempt(s)${where}: ${lastError ?? lastStatus}`);
  return { ok: false, status: lastStatus, attempts: attempt, error: lastError };
}
