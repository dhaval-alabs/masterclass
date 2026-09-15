// Duplicate cleanup for registration rows.
//
//   GET                     → dry-run preview (counts only, never deletes)
//   POST { dryRun: true }   → dry-run preview
//   POST { dryRun: false }  → executes the delete
//
// Dedup logic: rows are grouped by union-find of normalized email OR phone.
// Within each group, the keeper is the Verified row if one exists, else the
// most recently created Unverified row. Everything else is deleted.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { previewDuplicateCleanup, applyDuplicateCleanup } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

export async function GET() {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const plan = await previewDuplicateCleanup();
    return NextResponse.json({
      success: true,
      dryRun: true,
      totalGroups: plan.totalGroups,
      totalToDelete: plan.totalToDelete,
      // Cap the group preview to keep the response small; the UI just needs
      // representative samples for the confirmation modal.
      sampleGroups: plan.groups.slice(0, 10).map((g) => ({
        keeperEmail: g.keeperEmail,
        keeperStatus: g.keeperStatus,
        duplicateCount: g.deleteIds.length,
      })),
    });
  } catch (err) {
    console.error('[dedupe preview] error:', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Preview failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  let dryRun = false;
  try {
    const body = await request.json().catch(() => ({}));
    dryRun = body?.dryRun === true;
  } catch {
    // Body was missing or unparseable — treat as live run.
  }

  try {
    const plan = await previewDuplicateCleanup();

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        totalGroups: plan.totalGroups,
        totalToDelete: plan.totalToDelete,
        sampleGroups: plan.groups.slice(0, 10).map((g) => ({
          keeperEmail: g.keeperEmail,
          keeperStatus: g.keeperStatus,
          duplicateCount: g.deleteIds.length,
        })),
      });
    }

    const result = await applyDuplicateCleanup(plan);
    return NextResponse.json({
      success: result.failed.length === 0,
      dryRun: false,
      totalGroups: plan.totalGroups,
      totalToDelete: plan.totalToDelete,
      deleted: result.deleted,
      failed: result.failed,
    });
  } catch (err) {
    console.error('[dedupe execute] error:', err);
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Cleanup failed' }, { status: 500 });
  }
}
