-- Per-recipient send queue for WhatsApp campaigns. Large sends are enqueued and
-- drained in time-bounded chunks by the cron (and one chunk inline at send time),
-- so no audience size can ever exceed a serverless function timeout.

CREATE TABLE IF NOT EXISTS excel_to_ai.whatsapp_send_queue (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid        NOT NULL REFERENCES excel_to_ai.whatsapp_campaigns(id) ON DELETE CASCADE,
  phone          text        NOT NULL,
  recipient_name text        NOT NULL DEFAULT '',
  status         text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'cancelled')),
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  UNIQUE (campaign_id, phone)
);

-- Fast lookup of work still to do.
CREATE INDEX IF NOT EXISTS wsq_pending
  ON excel_to_ai.whatsapp_send_queue (campaign_id)
  WHERE status = 'pending';

ALTER TABLE excel_to_ai.whatsapp_send_queue ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service role full access" ON excel_to_ai.whatsapp_send_queue
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
