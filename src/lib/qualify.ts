import { updateLeadScore, saveConversation } from '@/lib/db';

export type LeadScore = 'hot' | 'warm' | 'cold' | 'junk';

export interface ConversationTurn {
  role: 'assistant' | 'user';
  content: string;
}

const SYSTEM_PROMPT = `You are a lead qualification assistant for AnalytixLabs, India's leading Data Science & AI education provider.

Assess the prospect's purchase intent from their chat answers and return EXACTLY this JSON — no extra text:
{"score":"hot","reason":"One sentence."}

Tiers:
- hot: clear goal, starts within 1–3 months, high intent
- warm: interested but 3–6 months out, comparing options, or moderate fit
- cold: low urgency, 6+ months, early research, significant barriers
- junk: bot, gibberish, fake details, zero intent, irrelevant answers

score must be one of: hot warm cold junk (lowercase).`;

const VALID: LeadScore[] = ['hot', 'warm', 'cold', 'junk'];

// A single completed chat is worth retrying for: before this, one transient
// Gemini failure (timeout / 429 / 5xx / malformed output) permanently left the
// lead unscored even though the conversation was saved.
const MAX_SCORE_ATTEMPTS = 3;
const PER_ATTEMPT_TIMEOUT_MS = 15000; // 3 attempts + backoff stays under the 55s route budget

/** Transient failures worth retrying. 4xx (bad key, disabled API) are NOT
 *  retried — a retry can't fix them. */
function isRetryableScoreError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return true; // per-attempt timeout
  if (err.name === 'TypeError') return true;  // fetch network failure
  const status = (err as { status?: number }).status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  // malformed / truncated LLM output — a fresh call usually fixes it
  return /No JSON in Gemini response|Invalid score from Gemini/.test(err.message);
}

async function scoreConversationOnce(
  apiKey: string,
  prompt: string,
): Promise<{ score: LeadScore; reason: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          // thinkingBudget: 0 — gemini-2.5-flash is a thinking model and its
          // hidden reasoning tokens count against maxOutputTokens. On longer
          // transcripts thinking could consume the whole budget, returning an
          // EMPTY response → "No JSON in Gemini response" → lead left unscored.
          generationConfig: { temperature: 0, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      const e = new Error(`Gemini error ${res.status}: ${err}`);
      (e as { status?: number }).status = res.status; // let isRetryableScoreError see the code
      throw e;
    }

    const data = await res.json();
    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();

    // Fast path: regex extraction works even on truncated JSON responses
    const scoreMatch = raw.match(/"score"\s*:\s*"(hot|warm|cold|junk)"/i);
    const reasonMatch = raw.match(/"reason"\s*:\s*"([^"]{1,300})"/i);
    if (scoreMatch) {
      const score = scoreMatch[1].toLowerCase() as LeadScore;
      console.log(`[qualify] regex extracted score="${score}" from Gemini`);
      return { score, reason: reasonMatch?.[1] ?? '' };
    }

    // Slow path: full JSON parse (for well-formed responses without truncation)
    const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const start = stripped.indexOf('{');
    const end   = stripped.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error(`No JSON in Gemini response: ${raw.slice(0, 300)}`);

    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { score: string; reason: string };
    const score = parsed.score?.toLowerCase() as LeadScore;
    if (!VALID.includes(score)) throw new Error(`Invalid score from Gemini: ${parsed.score}`);
    return { score, reason: parsed.reason ?? '' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function scoreConversation(
  conversation: ConversationTurn[],
): Promise<{ score: LeadScore; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const transcript = conversation
    .map(m => `${m.role === 'assistant' ? 'Counsellor' : 'Prospect'}: ${m.content}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\nConversation:\n${transcript}\n\nReturn only the JSON object.`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_SCORE_ATTEMPTS; attempt++) {
    try {
      return await scoreConversationOnce(apiKey, prompt);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!isRetryableScoreError(err) || attempt === MAX_SCORE_ATTEMPTS) {
        console.error(`[qualify] scoreConversation failed on attempt ${attempt}/${MAX_SCORE_ATTEMPTS} (no further retry): ${msg}`);
        break;
      }
      const backoffMs = 500 * 2 ** (attempt - 1); // 500ms, then 1s
      console.warn(`[qualify] scoreConversation attempt ${attempt}/${MAX_SCORE_ATTEMPTS} failed (${msg}); retrying in ${backoffMs}ms`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

/**
 * Score a lead and persist the result to the DB.
 * Fire-and-forget safe — never throws; logs errors instead.
 */
export async function scoreAndSave(params: {
  registrationId: string;
  conversation: ConversationTurn[];
  label?: string;
}): Promise<void> {
  const { registrationId, conversation, label = '[qualify]' } = params;

  // Save conversation immediately — independent of Gemini success so we
  // never lose chat data even if scoring fails or times out.
  saveConversation(registrationId, conversation)
    .catch(e => console.error(`${label} conversation save failed:`, e));

  try {
    const { score } = await scoreConversation(conversation);
    console.log(`${label} Gemini returned score="${score}" for ${registrationId}`);
    try {
      await updateLeadScore(registrationId, score);
      console.log(`${label} DB write OK → ${registrationId} = ${score}`);
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : JSON.stringify(dbErr);
      console.error(`${label} DB write FAILED for ${registrationId}: ${msg}`);
    }
  } catch (err) {
    console.error(`${label} Gemini scoring failed for ${registrationId}:`, err);
  }
}
