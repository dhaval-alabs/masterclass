import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceClient } from '@/lib/supabase';
import { verifyAdminSession } from '@/lib/auth';
import { assertSameOrigin } from '@/lib/security';

const BUCKET = 'excel-to-ai-uploads';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

let bucketEnsured = false;
async function ensureBucket(supabase: NonNullable<ReturnType<typeof getServiceClient>>) {
  if (bucketEnsured) return;
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
  bucketEnsured = true;
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!(await requireAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file received.' }, { status: 400 });
    }

    await ensureBucket(supabase);

    const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 });
  }
}
