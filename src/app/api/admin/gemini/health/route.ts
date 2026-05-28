import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type LeadScore = 'hot' | 'warm' | 'cold' | 'junk';
const VALID_SCORES: LeadScore[] = ['hot', 'warm', 'cold', 'junk'];

function extractScore(raw: string): string {
  // 1. Strip any markdown fences (inline or multiline)
  const stripped = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  // 2. Find the first { ... } block and parse it
  const start = stripped.indexOf('{');
  const end   = stripped.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const jsonStr = stripped.slice(start, end + 1);
    const parsed = JSON.parse(jsonStr) as { score?: string };
    const s = parsed.score?.toLowerCase();
    if (s && VALID_SCORES.includes(s as LeadScore)) return s;
  }

  // 3. Last resort: regex scan for score value in any format
  const m = raw.match(/"score"\s*:\s*"(hot|warm|cold|junk)"/i);
  if (m) return m[1].toLowerCase();

  throw new Error('no valid score found in response');
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

const TEST_TRANSCRIPT = `Counsellor: Quick one — working or studying?
Prospect: working full time in IT.
Counsellor: What's pulling you toward data and AI?
Prospect: want to switch to ML engineer role.`;

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET() {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, latencyMs: 0, error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const prompt = `${SYSTEM_PROMPT}\n\nConversation:\n${TEST_TRANSCRIPT}\n\nReturn only the JSON object.`;

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 256,
            },
          }),
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ ok: false, latencyMs, error: `Gemini error ${res.status}: ${errText}` });
    }

    const data = await res.json();
    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();

    let score: string | undefined;
    try {
      score = extractScore(raw);
    } catch {
      return NextResponse.json({ ok: false, latencyMs, error: `Failed to parse Gemini response: ${raw.slice(0, 200)}` });
    }

    return NextResponse.json({ ok: true, score, latencyMs });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, latencyMs, error: message });
  }
}
