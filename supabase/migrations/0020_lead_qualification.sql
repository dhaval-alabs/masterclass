-- Migration 0020: Lead qualification scoring
-- Adds lead_score and qualified_at to registrations table

ALTER TABLE excel_to_ai.registrations
  ADD COLUMN IF NOT EXISTS lead_score text
    CONSTRAINT registrations_lead_score_check
    CHECK (lead_score IN ('hot','warm','cold','junk')),
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

-- Index for filtering by score in admin dashboards
CREATE INDEX IF NOT EXISTS idx_registrations_lead_score
  ON excel_to_ai.registrations (lead_score)
  WHERE lead_score IS NOT NULL;
