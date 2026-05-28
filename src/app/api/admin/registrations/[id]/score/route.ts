import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateLeadScore } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type LeadScore = 'hot' | 'warm' | 'cold' | 'junk';

const VALID_SCORES: LeadScore[] = ['hot', 'warm', 'cold', 'junk'];

const LSQ_SCORE_FIELD = process.env.LSQ_LEAD_SCORE_FIELD || 'mx_Lead_Score';

const LSQ_SCORE_LABEL: Record<LeadScore, string> = {
  hot:  'Hot',
  warm: 'Warm',
  cold: 'Cold',
  junk: 'Junk',
};

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
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
      console.warn('[score-override] LSQ lead not found for phone:', phone);
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
    console.error('[score-override] LSQ update failed:', err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  let score: string;
  let phone: string | undefined;

  try {
    const body = await req.json();
    score = body?.score;
    phone = body?.phone ?? undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!VALID_SCORES.includes(score as LeadScore)) {
    return NextResponse.json(
      { error: `score must be one of: ${VALID_SCORES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    await updateLeadScore(id, score as LeadScore);

    // Fire-and-forget LSQ update — only if phone was supplied
    if (phone) {
      updateLsqScore(phone, score as LeadScore).catch(err =>
        console.error('[score-override] LSQ fire-and-forget failed:', err),
      );
    }

    return NextResponse.json({ success: true, score });
  } catch (err) {
    console.error('[score-override] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
