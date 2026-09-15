import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { scoreConversation } from '@/lib/qualify';
import { updateLeadScore } from '@/lib/db';
import { getServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const forceId = url.searchParams.get('id');

  const results: Record<string, unknown> = {};

  // ── 1. Check columns exist ────────────────────────────────────────────────
  try {
    const supabase = getServiceClient();
    if (!supabase) throw new Error('Supabase client not configured');

    const { data, error } = await supabase
      .schema('excel_to_ai')
      .from('registrations')
      .select('id, status, lead_score, chat_conversation, zoom_registered, qualified_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    results.columns_ok = true;
    results.recent_registrations = (data ?? []).map((r: any) => ({
      id: r.id,
      status: r.status,
      lead_score: r.lead_score ?? null,
      has_conversation: Array.isArray(r.chat_conversation) && r.chat_conversation.length > 0,
      conversation_turns: Array.isArray(r.chat_conversation) ? r.chat_conversation.length : 0,
      zoom_registered: r.zoom_registered ?? null,
      qualified_at: r.qualified_at ?? null,
    }));
  } catch (err) {
    results.columns_ok = false;
    results.columns_error = String(err);
    results.hint = 'Run migrations 0020+0021 in Supabase SQL editor';
  }

  // ── 2. Gemini health ──────────────────────────────────────────────────────
  const mockConversation = [
    { role: 'assistant' as const, content: 'Quick one — where are you right now?' },
    { role: 'user' as const, content: 'Early-career professional, working as a software engineer' },
    { role: 'assistant' as const, content: "What's your main goal right now?" },
    { role: 'user' as const, content: 'Switch into a data career — data scientist role within 2 months' },
    { role: 'assistant' as const, content: 'When are you looking to upskill?' },
    { role: 'user' as const, content: 'Within 1-2 months, very soon' },
  ];
  let geminiScore: string | null = null;
  try {
    const t0 = Date.now();
    const { score, reason } = await scoreConversation(mockConversation);
    geminiScore = score;
    results.gemini_ok = true;
    results.gemini_score = score;
    results.gemini_reason = reason;
    results.gemini_latency_ms = Date.now() - t0;
  } catch (err) {
    results.gemini_ok = false;
    results.gemini_error = String(err);
  }

  // ── 3. Force-write score to a real registration ID ───────────────────────
  if (forceId && geminiScore) {
    try {
      await updateLeadScore(forceId, geminiScore as 'hot' | 'warm' | 'cold' | 'junk');
      results.db_write = `OK — wrote "${geminiScore}" to ${forceId}`;
    } catch (err) {
      results.db_write = `FAILED: ${String(err)}`;
    }
  } else if (forceId) {
    results.db_write = 'skipped — Gemini failed, nothing to write';
  } else {
    results.db_write = 'pass ?id=<registrationId> to test a real DB write';
  }

  // ── 4. Diagnosis summary ─────────────────────────────────────────────────
  const regs = results.recent_registrations as any[] | undefined;
  const anyWithConversation = regs?.some(r => r.has_conversation);
  const anyWithScore = regs?.some(r => r.lead_score);

  results.diagnosis = anyWithConversation && !anyWithScore
    ? 'CONVERSATIONS SAVED but scores NOT written → Gemini or DB write failing after chat'
    : !anyWithConversation && !anyWithScore
    ? 'NO conversations saved → chat flow not completing OR conversation not reaching server'
    : anyWithScore
    ? 'Scoring is working — at least one lead has a score'
    : 'Unknown state';

  return NextResponse.json(results, { status: 200 });
}
