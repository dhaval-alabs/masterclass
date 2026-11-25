-- 0041_session_wa_creatives.sql
-- Each session's WhatsApp creatives: one image per template that has an image
-- header, plus a default, sent to Mindbird (PUT /api/creatives), which picks the
-- right one for every message when it is sent. See src/lib/mindbird.ts.
--
--   wa_creatives       { "default": url | null, "templates": { "<template>": url } }
--   wa_creatives_sync  the last send to Mindbird: { at, ok, error?, items?: [...] }
--
-- Safe to run repeatedly.

set search_path = excel_to_ai, public;

alter table excel_to_ai.webinar_sessions
  add column if not exists wa_creatives jsonb not null default '{}'::jsonb;
alter table excel_to_ai.webinar_sessions
  add column if not exists wa_creatives_sync jsonb;

notify pgrst, 'reload schema';
