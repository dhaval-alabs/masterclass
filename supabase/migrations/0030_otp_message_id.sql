-- 0030_otp_message_id.sql
-- Adds whatsapp_message_id to registrations so OTP sends can be correlated to
-- Meta's delivery-status webhook (delivered / read / FAILED). Before this, OTP
-- delivery failures were invisible: the send API returns 200 ("accepted") even
-- when Meta later drops the message, and the webhook had nowhere to record it.
--
-- Nullable, no default — existing rows are preserved. Safe to run multiple times.

set search_path = excel_to_ai, public;

alter table excel_to_ai.registrations
  add column if not exists whatsapp_message_id text;   -- Meta wamid from the OTP send

-- The webhook looks rows up by this id, so index it.
create index if not exists registrations_whatsapp_message_id_idx
  on excel_to_ai.registrations (whatsapp_message_id);

-- Reload PostgREST schema cache so the new column is visible to the REST API
-- immediately (the app reads/writes registrations via supabase-js / PostgREST).
notify pgrst, 'reload schema';
