-- Migration 0021: Admin panel enhancements
-- Adds chat transcript storage, Zoom registration result, and source tracking

ALTER TABLE excel_to_ai.registrations
  ADD COLUMN IF NOT EXISTS chat_conversation jsonb,
  ADD COLUMN IF NOT EXISTS zoom_registered   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS zoom_join_url     text;

CREATE INDEX IF NOT EXISTS idx_registrations_zoom_registered
  ON excel_to_ai.registrations (zoom_registered)
  WHERE zoom_registered = true;
