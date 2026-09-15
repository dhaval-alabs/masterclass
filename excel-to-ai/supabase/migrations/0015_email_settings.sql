-- Singleton table for email branding settings (one row always).
CREATE TABLE IF NOT EXISTS excel_to_ai.email_settings (
  singleton    boolean     PRIMARY KEY DEFAULT true CHECK (singleton = true),
  logo_url     text,
  logo_align   text        NOT NULL DEFAULT 'left'
                CHECK (logo_align IN ('left', 'center', 'right')),
  logo_height  integer     NOT NULL DEFAULT 36,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row so the app can always do SELECT + UPDATE, never INSERT.
INSERT INTO excel_to_ai.email_settings (singleton)
VALUES (true)
ON CONFLICT DO NOTHING;
