-- Add per-campaign delivery delay to email_campaigns
ALTER TABLE excel_to_ai.email_campaigns
  ADD COLUMN IF NOT EXISTS delay_value integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_unit  text    NOT NULL DEFAULT 'hours'
    CHECK (delay_unit IN ('minutes', 'hours', 'days'));

-- Scheduled send queue: one row per recipient per campaign
CREATE TABLE IF NOT EXISTS excel_to_ai.email_schedule_queue (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid        NOT NULL REFERENCES excel_to_ai.email_campaigns(id) ON DELETE CASCADE,
  recipient_email text        NOT NULL,
  recipient_name  text        NOT NULL,
  scheduled_for   timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient_email)
);

-- Fast lookup: all pending rows ordered by delivery time
CREATE INDEX IF NOT EXISTS esq_pending_due
  ON excel_to_ai.email_schedule_queue (scheduled_for)
  WHERE status = 'pending';
