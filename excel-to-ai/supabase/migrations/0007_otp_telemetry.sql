-- 0007_otp_telemetry.sql
-- Adds per-row OTP delivery telemetry and admin-editable OTP help text fields.
-- All columns are nullable / have safe defaults so existing rows are preserved.
-- Safe to run multiple times.

set search_path = excel_to_ai, public;

-- ── registrations: telemetry ────────────────────────────────────────────────
alter table excel_to_ai.registrations
  add column if not exists whatsapp_status text,         -- 'sent' | 'api_failed' | 'skipped' | null (unknown/legacy)
  add column if not exists whatsapp_error  text,         -- Meta API error message if api_failed
  add column if not exists verified_at     timestamptz,  -- set when status flips to Verified
  add column if not exists attempt_number  integer default 1;

create index if not exists registrations_email_phone_idx
  on excel_to_ai.registrations (email, phone);

-- ── settings: OTP help / fallback ──────────────────────────────────────────
alter table excel_to_ai.settings
  add column if not exists otp_help_whatsapp_number text,
  add column if not exists otp_help_text            text,
  add column if not exists otp_resend_label         text;

-- Reload PostgREST schema cache so new columns are visible immediately.
notify pgrst, 'reload schema';
