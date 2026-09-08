-- 0034_email_campaign_schedule.sql
-- One-off SCHEDULED email broadcasts ("send this blast Tuesday 9am").
--
-- WhatsApp campaigns already have this (0023): scheduled_for + a 'scheduled'
-- status, fired by the 5-minute cron. Email had only the per-recipient
-- email_schedule_queue used by trigger-based auto-sends, so a campaign-level
-- send could only be fired by hand, right now. This brings email to parity.

ALTER TABLE excel_to_ai.email_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Allow 'scheduled' alongside the existing statuses.
ALTER TABLE excel_to_ai.email_campaigns
  DROP CONSTRAINT IF EXISTS email_campaigns_status_check;
ALTER TABLE excel_to_ai.email_campaigns
  ADD CONSTRAINT email_campaigns_status_check
  CHECK (status IN ('draft','scheduled','sending','sent','partial','failed'));

-- Due-work lookup for the cron. Partial index: only scheduled rows are polled.
CREATE INDEX IF NOT EXISTS ec_scheduled_due
  ON excel_to_ai.email_campaigns (scheduled_for)
  WHERE status = 'scheduled';
