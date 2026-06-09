-- 0026_speaker_submissions.sql
-- "Next speaker" intake: a public form captures a speaker's profile + contact,
-- submissions land in the admin panel, and on approval we create a new
-- 'upcoming' webinar session carrying that speaker. Activating that session
-- (existing Sessions tab) then surfaces the speaker on the live landing page.

-- 1. Speaker profile travels with the session, so activating a session swaps
--    the live speaker without overwriting the global settings row.
ALTER TABLE excel_to_ai.webinar_sessions
  ADD COLUMN IF NOT EXISTS speaker_name  text,
  ADD COLUMN IF NOT EXISTS speaker_title text,
  ADD COLUMN IF NOT EXISTS speaker_image text,
  ADD COLUMN IF NOT EXISTS speaker_bio   text;

-- 2. Pending/approved/rejected speaker submissions from the public form.
CREATE TABLE IF NOT EXISTS excel_to_ai.speaker_submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  speaker_name   text        NOT NULL,
  speaker_title  text,
  speaker_image  text,
  speaker_bio    text,
  contact_email  text,
  contact_phone  text,
  linkedin_url   text,
  notes          text,
  session_id     uuid        REFERENCES excel_to_ai.webinar_sessions(id) ON DELETE SET NULL,
  reviewed_by    text,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS speaker_submissions_pending
  ON excel_to_ai.speaker_submissions (created_at DESC)
  WHERE status = 'pending';

ALTER TABLE excel_to_ai.speaker_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service role full access" ON excel_to_ai.speaker_submissions
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
