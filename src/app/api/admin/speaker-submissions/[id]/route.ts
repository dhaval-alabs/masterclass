export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import {
  getSpeakerSubmissionById,
  updateSpeakerSubmission,
  createWebinarSession,
  generateNextSessionCode,
} from '@/lib/db';

async function getAdmin() {
  const token = (await cookies()).get('admin_session')?.value;
  return verifyAdminSession(token);
}

// PATCH /api/admin/speaker-submissions/[id]  { action: 'approve' | 'reject' }
// Approve → create a new 'upcoming' webinar session carrying the speaker's
// profile (admin sets the date/title in the Sessions tab, then activates it to
// make it live). Reject → mark rejected.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;
  let body: { action?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const submission = await getSpeakerSubmissionById(id);
  if (!submission) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });

  if (body.action === 'reject') {
    await updateSpeakerSubmission(id, { status: 'rejected', reviewedBy: admin.sub, reviewedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, status: 'rejected' });
  }

  if (body.action === 'approve') {
    if (submission.status === 'approved' && submission.sessionId) {
      return NextResponse.json({ error: 'Already approved.', sessionId: submission.sessionId }, { status: 409 });
    }
    try {
      const code = await generateNextSessionCode();
      const session = await createWebinarSession({
        code,
        title: `Masterclass with ${submission.speakerName}`,
        speakerName: submission.speakerName,
        speakerTitle: submission.speakerTitle,
        speakerImage: submission.speakerImage,
        speakerBio: submission.speakerBio,
      });
      await updateSpeakerSubmission(id, {
        status: 'approved',
        sessionId: session.id,
        reviewedBy: admin.sub,
        reviewedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, status: 'approved', session });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action. Use "approve" or "reject".' }, { status: 400 });
}
