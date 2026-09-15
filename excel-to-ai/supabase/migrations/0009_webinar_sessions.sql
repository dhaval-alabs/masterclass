-- 0009_webinar_sessions.sql
-- First-class webinar sessions. Each LP "cohort" (the W001, W002, ... weekly
-- webinars) becomes a row in this table. One is "active" at a time and the
-- LP renders its date/time/Zoom ID instead of values from `settings`.
--
-- Migration steps:
--   1. Create webinar_sessions table
--   2. Add session_id to registrations + attendance_sync_runs
--   3. Seed ONE session from the current live `settings` row so existing data
--      doesn't lose its parent
--   4. Backfill session_id on every existing registration
--
-- Safe to run multiple times.

set search_path = excel_to_ai, public;

create table if not exists excel_to_ai.webinar_sessions (
  id                     uuid primary key default gen_random_uuid(),
  code                   text unique not null,                -- 'W001', 'W002', ... user-defined
  title                  text not null,
  date_label             text,
  time_label             text,
  datetime_utc           timestamptz,
  duration_label         text,
  zoom_webinar_id        text,
  whatsapp_template_name text,
  lsq_source_name        text,
  -- BOTH event tagging strategies are supported (per user choice):
  --   * meta_event_suffix → if set, event names become "Lead_<suffix>" etc.
  --   * Code is always pushed into custom_data.webinar_session_code
  meta_event_suffix      text,
  status                 text not null default 'upcoming' check (status in ('upcoming','active','completed')),
  created_at             timestamptz not null default now(),
  activated_at           timestamptz,
  ended_at               timestamptz,
  -- Cached counters (refreshed by sync attendance, not authoritative).
  registrations_count    int default 0,
  attendees_count        int default 0
);

create unique index if not exists webinar_sessions_one_active_idx
  on excel_to_ai.webinar_sessions (status) where status = 'active';

-- Add session linkage to existing tables.
alter table excel_to_ai.registrations
  add column if not exists session_id uuid references excel_to_ai.webinar_sessions(id);

create index if not exists registrations_session_id_idx
  on excel_to_ai.registrations (session_id);

alter table excel_to_ai.attendance_sync_runs
  add column if not exists session_id uuid references excel_to_ai.webinar_sessions(id);

-- ── Seed: turn the currently-live `settings` row into session "W001" ───────
-- Only inserts if no sessions exist yet (so re-running this migration is a no-op).
do $$
declare
  s record;
  new_session_id uuid;
begin
  if (select count(*) from excel_to_ai.webinar_sessions) = 0 then
    select * into s from excel_to_ai.settings where id = 'speaker';
    insert into excel_to_ai.webinar_sessions (
      code, title, date_label, time_label, datetime_utc, duration_label,
      zoom_webinar_id, whatsapp_template_name, lsq_source_name,
      meta_event_suffix, status, activated_at
    ) values (
      'W001',
      coalesce(s.webinar_title, 'Webinar 1'),
      s.webinar_date_label,
      s.webinar_time_label,
      s.webinar_datetime_utc,   -- already timestamptz (see 0002 migration)
      s.duration_label,
      s.zoom_webinar_id,
      s.whatsapp_template_name,
      s.lsq_source_name,
      'W001',           -- default suffix matches code
      'active',
      now()
    )
    returning id into new_session_id;

    -- Tag every existing registration with this seeded session.
    update excel_to_ai.registrations
       set session_id = new_session_id
     where session_id is null;

    -- Tag past attendance sync runs too.
    update excel_to_ai.attendance_sync_runs
       set session_id = new_session_id
     where session_id is null;
  end if;
end $$;

-- PostgREST reload.
notify pgrst, 'reload schema';
