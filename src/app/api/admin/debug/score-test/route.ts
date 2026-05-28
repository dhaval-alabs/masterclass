import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { scoreConversation } from '@/lib/qualify';
import { updateLeadScore, getRegistrationsPaginated } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debug/score-test
 * Runs through the full scoring pipeline and reports exactly where it fails.
 * Use this to diagnose "score not showing in admin".
 */
export async function GET(req: NextRequest) {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const results: Record<string, unknown> = {};

  // Step 1: Check if lead_score column exists by reading from DB
  try {
    const page = await getRegistrationsPaginated(1, 1);
    const first = page.data[0];
    results.db_read = 'ok';
    results.sample_row_id = first?.id ?? null;
    results.lead_score_column_visible = first !== undefined
      ? ('leadScore' in first ? 'yes' : 'no — column missing in DB')
      : 'no rows to check';
    results.sample_lead_score = first?.leadScore ?? null;
  } catch (err) {
    results.db_read = `FAILED: ${String(err)}`;
  }

  // Step 2: Test Gemini scoring
  const mockConversation = [
    { role: 'assistant' as const, content: 'Quick one — currently working or studying?' },
    { role: 'user' as const, content: 'Working full-time as a software engineer' },
    { role: 'assistant' as const, content: "What's pulling you toward data and AI right now?" },
    { role: 'user' as const, content: 'I want to switch to a data scientist role within 2 months' },
    { role: 'assistant' as const, content: 'When are you looking to upskill?' },
    { role: 'user' as const, content: 'Within 1-2 months, very soon' },
  ];
  let geminiScore: string | null = null;
  try {
    const { score, reason } = await scoreConversation(mockConversation);
    geminiScore = score;
    results.gemini = 'ok';
    results.gemini_score = score;
    results.gemini_reason = reason;
  } catch (err) {
    results.gemini = `FAILED: ${String(err)}`;
  }

  // Step 3: Test DB write (only if we have a real registration and a score)
  const url = new URL(req.url);
  const testId = url.searchParams.get('id');
  if (testId && geminiScore) {
    try {
      await updateLeadScore(testId, geminiScore as 'hot' | 'warm' | 'cold' | 'junk');
      results.db_write = `ok — wrote score "${geminiScore}" to registration ${testId}`;
    } catch (err) {
      results.db_write = `FAILED: ${String(err)}`;
    }
  } else {
    results.db_write = testId
      ? 'skipped — Gemini failed so nothing to write'
      : 'skipped — pass ?id=<registrationId> to test write';
  }

  return NextResponse.json(results, { status: 200 });
}
