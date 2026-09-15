ALTER TABLE excel_to_ai.email_settings
  ADD COLUMN IF NOT EXISTS header_color text NOT NULL DEFAULT '#003368';
