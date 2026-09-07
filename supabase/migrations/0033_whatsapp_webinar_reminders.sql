-- 0033_whatsapp_webinar_reminders.sql
-- Time-based WhatsApp reminders before the webinar.
--
-- WHY: reminders were email-only, and email open rate is ~2% — so roughly 145
-- of the last 149 registrants never saw one. WhatsApp is the channel these
-- registrants actually read (it is already how OTP reaches them).
--
-- The existing auto-send triggers are all EVENT-driven (fire N minutes after
-- something happens). Reminders are CLOCK-driven: they fire at a fixed offset
-- before the session's datetime_utc, so the send time is computed from the
-- webinar, not from the enqueue moment. Everything else — the scheduled-sends
-- table, the 5-minute drain cron, templates, opt-outs — is reused as-is.
--
-- "On registration" deliberately gets NO new trigger: the existing 'verified'
-- automation already fires right after OTP, which is that moment.

ALTER TABLE excel_to_ai.whatsapp_campaigns
  DROP CONSTRAINT IF EXISTS whatsapp_campaigns_auto_send_trigger_check;
ALTER TABLE excel_to_ai.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_auto_send_trigger_check
  CHECK (auto_send_trigger IN (
    'unverified','verified','noshow',
    'reminder_t3d','reminder_t1d','reminder_t1h'
  ));

ALTER TABLE excel_to_ai.whatsapp_scheduled_sends
  DROP CONSTRAINT IF EXISTS whatsapp_scheduled_sends_trigger_check;
ALTER TABLE excel_to_ai.whatsapp_scheduled_sends
  ADD CONSTRAINT whatsapp_scheduled_sends_trigger_check
  CHECK (trigger IN (
    'unverified','verified','noshow',
    'reminder_t3d','reminder_t1d','reminder_t1h'
  ));

-- One reminder per person per trigger per session. Without this, a repeat
-- verification (or a retried request) would enqueue a second copy and the
-- registrant would get the same reminder twice.
CREATE UNIQUE INDEX IF NOT EXISTS wss_one_reminder_per_reg
  ON excel_to_ai.whatsapp_scheduled_sends (registration_id, trigger)
  WHERE registration_id IS NOT NULL AND trigger LIKE 'reminder_%';
