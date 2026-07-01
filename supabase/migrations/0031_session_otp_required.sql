-- 0031_session_otp_required.sql
-- Per-session toggle for whether the registration form requires WhatsApp OTP
-- verification. Added to work around WhatsApp delivery outages: an admin can
-- turn OTP off for the active session so registrations still complete (Zoom
-- registration + verified emails) without a code.
--
-- Defaults to TRUE so existing behaviour is unchanged. Safe to run repeatedly.

set search_path = excel_to_ai, public;

alter table excel_to_ai.webinar_sessions
  add column if not exists otp_required boolean not null default true;

-- Reload PostgREST schema cache so the new column is visible to the REST API
-- immediately.
notify pgrst, 'reload schema';
