-- 0027_whatsapp_autosend.sql
-- Event-triggered WhatsApp automations (mirrors the email auto-send model):
--   • unverified → nudge people who filled the form but didn't complete OTP
--   • verified   → welcome / join-link right after OTP
--   • noshow     → follow-up to registrants who didn't attend
-- An auto-send config is a whatsapp_campaign flagged auto_send_enabled with a
-- trigger + delay. When a trigger fires we enqueue a per-recipient scheduled
-- send; a cron sends due ones (skipping anyone whose state changed, e.g. they
-- verified before the nudge fired).

ALTER TABLE excel_to_ai.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS auto_send_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_send_trigger text
    CHECK (auto_send_trigger IN ('unverified','verified','noshow')),
  ADD COLUMN IF NOT EXISTS delay_value int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS delay_unit text NOT NULL DEFAULT 'minutes'
    CHECK (delay_unit IN ('minutes','hours','days'));

CREATE TABLE IF NOT EXISTS excel_to_ai.whatsapp_scheduled_sends (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        NOT NULL REFERENCES excel_to_ai.whatsapp_campaigns(id) ON DELETE CASCADE,
  registration_id text,
  phone           text        NOT NULL,
  recipient_name  text        NOT NULL DEFAULT '',
  trigger         text        NOT NULL CHECK (trigger IN ('unverified','verified','noshow')),
  send_after      timestamptz NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','skipped','cancelled','failed')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);

-- Due-work lookup, and a way to cancel a person's pending nudge when they verify.
CREATE INDEX IF NOT EXISTS wss_due ON excel_to_ai.whatsapp_scheduled_sends (send_after) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS wss_reg ON excel_to_ai.whatsapp_scheduled_sends (registration_id, trigger) WHERE status = 'pending';

ALTER TABLE excel_to_ai.whatsapp_scheduled_sends ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service role full access" ON excel_to_ai.whatsapp_scheduled_sends
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
