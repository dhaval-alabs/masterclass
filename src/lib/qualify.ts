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

export async function scoreConversation(
  conversation: ConversationTurn[],
): Promise<{ score: LeadScore; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const transcript = conversation
    .map(m => `${m.role === 'assistant' ? 'Counsellor' : 'Prospect'}: ${m.content}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}\n\nConversation:\n${transcript}\n\nReturn only the JSON object.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Gemini error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();

    const stripped = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const start = stripped.indexOf('{');
    const end   = stripped.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error(`No JSON in Gemini response: ${raw.slice(0, 200)}`);

    const parsed = JSON.parse(stripped.slice(start, end + 1)) as { score: string; reason: string };
    let score = parsed.score?.toLowerCase() as LeadScore;
    if (!VALID.includes(score)) {
      const m = raw.match(/"score"\s*:\s*"(hot|warm|cold|junk)"/i);
      if (!m) throw new Error(`Invalid score from Gemini: ${parsed.score}`);
      score = m[1].toLowerCase() as LeadScore;
    }
    return { score, reason: parsed.reason ?? '' };
  } finally {
    clearTimeout(timeout);
  }
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
  try {
    const { score } = await scoreConversation(conversation);
    console.log(`${label} Gemini returned score="${score}" for ${registrationId}`);
    try {
      await updateLeadScore(registrationId, score);
      console.log(`${label} DB write OK → ${registrationId} = ${score}`);
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : JSON.stringify(dbErr);
      console.error(`${label} DB write FAILED for ${registrationId}: ${msg}`);
      console.error(`${label} HINT: Have you run migrations 0020 + 0021 in Supabase? The lead_score column may not exist.`);
      return;
    }
    saveConversation(registrationId, conversation)
      .catch(e => console.error(`${label} conversation save failed:`, e));
  } catch (err) {
    console.error(`${label} Gemini scoring failed for ${registrationId}:`, err);
  }
}
