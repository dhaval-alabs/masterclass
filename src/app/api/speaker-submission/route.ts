import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { assertSameOrigin } from '@/lib/security';
import { createSpeakerSubmission } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUCKET = 'excel-to-ai-uploads';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

// POST /api/speaker-submission — PUBLIC (no admin auth). The "next speaker"
// intake form posts here. Same-origin only (CSRF guard). The photo is uploaded
// server-side via the service client because the submitter isn't logged in, so
// the admin-only /api/upload route can't be used.
export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const speakerName = (form.get('speakerName') as string | null)?.trim() || '';
    if (!speakerName) {
      return NextResponse.json({ error: 'Your name is required.' }, { status: 400 });
    }

    // Optional photo → upload to public storage, capture the URL.
    let speakerImage: string | null = null;
    const file = form.get('photo');
    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      const f = file as File;
      if (f.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: 'Photo is too large (max 5 MB).' }, { status: 400 });
      }
      if (f.size > 0) {
        const supabase = getServiceClient();
        if (supabase) {
          try {
            const { data: bucket } = await supabase.storage.getBucket(BUCKET);
            if (!bucket) await supabase.storage.createBucket(BUCKET, { public: true });
            const filename = `speaker_${Date.now()}_${f.name.replace(/\s+/g, '_')}`;
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, f, {
              contentType: f.type || undefined,
              upsert: false,
            });
            if (!upErr) {
              speakerImage = supabase.storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
            }
          } catch (err) {
            // Non-fatal — the submission still goes through without a photo.
            console.error('[speaker-submission] photo upload failed:', err);
          }
        }
      }
    }

    await createSpeakerSubmission({
      speakerName,
      speakerTitle: str(form.get('speakerTitle')),
      speakerBio:   str(form.get('speakerBio')),
      contactEmail: str(form.get('contactEmail')),
      contactPhone: str(form.get('contactPhone')),
      linkedinUrl:  str(form.get('linkedinUrl')),
      notes:        str(form.get('notes')),
      speakerImage,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[speaker-submission] error:', err);
    return NextResponse.json({ error: 'Could not submit — please try again.' }, { status: 500 });
  }
}
