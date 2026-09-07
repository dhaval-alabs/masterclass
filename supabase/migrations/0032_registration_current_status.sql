-- 0032_registration_current_status.sql
-- The registration form has always had a MANDATORY "current status" select
-- (Student / Recent graduate / Working professional). Its value was validated
-- client-side, posted to /api/lead/capture as `body.status` … and then dropped:
-- nothing read it, so it reached neither this table nor LeadSquared. Sales had
-- no way to segment by it.
--
-- Named current_status, NOT status: registrations.status already means the OTP
-- state ('Verified' / 'Unverified'), and reusing the name would collide.

ALTER TABLE excel_to_ai.registrations
  ADD COLUMN IF NOT EXISTS current_status text;

-- Segmentation queries filter on it, and the admin list groups by it.
CREATE INDEX IF NOT EXISTS registrations_current_status
  ON excel_to_ai.registrations (current_status)
  WHERE current_status IS NOT NULL;
