-- Migration 0022: optional image-header support for WhatsApp campaigns.
-- Templates with an IMAGE header require the media to be supplied at send time;
-- store the header image URL per campaign so sends (and retries) can attach it.

ALTER TABLE excel_to_ai.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS header_image_url text;
