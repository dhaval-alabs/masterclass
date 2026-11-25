-- 0042_registration_wa_consent.sql
-- WhatsApp marketing consent from the registration form's tick box (unticked by
-- default). Saved with the exact wording shown, as the evidence, and sent to
-- Mindbird, which records the opt-in. See src/lib/consent.ts.
-- Safe to run repeatedly.

set search_path = excel_to_ai, public;

alter table excel_to_ai.registrations add column if not exists wa_consent boolean not null default false;
alter table excel_to_ai.registrations add column if not exists wa_consent_at timestamptz;
alter table excel_to_ai.registrations add column if not exists wa_consent_text text;

-- The wording, editable in Admin → Webinar. NULL = the default in consent.ts.
alter table excel_to_ai.settings add column if not exists form_wa_consent_label text;

notify pgrst, 'reload schema';
