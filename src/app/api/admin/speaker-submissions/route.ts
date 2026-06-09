export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from '@/lib/auth';
import { listSpeakerSubmissions } from '@/lib/db';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  return (await verifyAdminSession(token)) !== null;
}

// GET /api/admin/speaker-submissions — list all speaker submissions (newest first).
export async function GET() {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });
  try {
    const submissions = await listSpeakerSubmissions();
    return NextResponse.json({ submissions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
