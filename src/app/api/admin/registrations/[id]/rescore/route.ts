import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateLeadScore } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type LeadScore = 'hot' | 'warm' | 'cold' | 'junk';

const LSQ_SCORE_FIELD = process.env.LSQ_LEAD_SCORE_FIELD || 'mx_Lead_Score';

const LSQ_SCORE_LABEL: Record<LeadScore, string> = {
  hot:  'Hot',
  warm: 'Warm',
  cold: 'Cold',
  junk: 'Junk',
};

const SYSTEM_PROMPT = `You are a lead qualification assistant for AnalytixLabs, India's leading Data Science & AI education provider.

Assess the prospect's purchase intent from their chat answers and return EXACTLY this JSON — no extra text:
{"score":"hot","reason":"One sentence."}

Tiers:
- hot: clear goal, starts within 1–3 months, high intent
- warm: interested but 3–6 months out, comparing options, or moderate fit
- cold: low urgency, 6+ months, early research, significant barriers
- junk: bot, gibberish, fake details, zero intent, irrelevant answers

score must be one of: hot warm cold junk (lowercase).`;

interface ConversationTurn {
  role: string;
  content: string;
}

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

async function scoreLead(conversation: ConversationTurn[]): Promise<{ score: LeadScore; reason: string }> {
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
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-flash-latest'}:generateContent?key=${apiKey}`,
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

    const validScores: LeadScore[] = ['hot', 'warm', 'cold', 'junk'];
    const score = parsed.score?.toLowerCase() as LeadScore;
    if (!validScores.includes(score)) throw new Error(`Invalid score from Gemini: ${parsed.score}`);

    return { score, reason: parsed.reason ?? '' };
  } finally {
    clearTimeout(timeout);
  }
}

async function updateLsqScore(phone: string, score: LeadScore): Promise<void> {
  const access = process.env.LSQ_ACCESS;
  const secret = process.env.LSQ_SECRET;
  if (!access || !secret) return;

  try {
    const res = await fetch(
      `https://api-in21.leadsquared.com/v2/LeadManagement.svc/RetrieveLeadByPhoneNumber?accessKey=${access}&secretKey=${secret}&phone=${encodeURIComponent(phone)}`,
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || data.length === 0) {
      console.warn('[rescore] LSQ lead not found for phone:', phone);
      return;
    }
    const prospectId: string = data[0].ProspectID;
    await fetch(
      `https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.Update?accessKey=${access}&secretKey=${secret}&leadId=${prospectId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ Attribute: LSQ_SCORE_FIELD, Value: LSQ_SCORE_LABEL[score] }]),
      },
    );
  } catch (err) {
    console.error('[rescore] LSQ update failed:', err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  let conversation: ConversationTurn[];
  let phone: string | undefined;

  try {
    const body = await req.json() as {
      conversation: ConversationTurn[];
      email?: string;
      phone?: string;
      name?: string;
      city?: string;
    };

    conversation = body?.conversation;
    phone = body?.phone ?? undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
    return NextResponse.json({ error: 'conversation is required and must be a non-empty array' }, { status: 400 });
  }

  try {
    const { score, reason } = await scoreLead(conversation);

    await updateLeadScore(id, score);

    // Fire-and-forget LSQ update
    if (phone) {
      updateLsqScore(phone, score).catch(err =>
        console.error('[rescore] LSQ fire-and-forget failed:', err),
      );
    }

    return NextResponse.json({ success: true, score, reason });
  } catch (err) {
    console.error('[rescore] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
