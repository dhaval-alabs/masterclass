-- 0012_email_body_html.sql
-- Stores the rich HTML body produced by the visual email builder.
-- body_text remains the plain-text fallback for email clients that prefer it.

set search_path = excel_to_ai, public;

alter table excel_to_ai.email_campaigns
  add column if not exists body_html text;

notify pgrst, 'reload schema';
