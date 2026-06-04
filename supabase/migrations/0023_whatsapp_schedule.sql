-- Allow scheduling a WhatsApp campaign to fire at a future time.
-- The audience is recomputed fresh when the cron fires, so registrants who
-- join between scheduling and send time are included automatically.

ALTER TABLE excel_to_ai.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Allow the new 'scheduled' status alongside the existing ones.
ALTER TABLE excel_to_ai.whatsapp_campaigns
  DROP CONSTRAINT IF EXISTS whatsapp_campaigns_status_check;
ALTER TABLE excel_to_ai.whatsapp_campaigns
  ADD CONSTRAINT whatsapp_campaigns_status_check
    CHECK (status IN ('draft','scheduled','sending','sent','partial','failed'));

-- Fast lookup of campaigns that are due to fire.
CREATE INDEX IF NOT EXISTS wac_scheduled_due
  ON excel_to_ai.whatsapp_campaigns (scheduled_for)
  WHERE status = 'scheduled';
