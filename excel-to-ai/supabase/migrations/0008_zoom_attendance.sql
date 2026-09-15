-- 0008_zoom_attendance.sql
-- Post-webinar attendance tracking. Populated by the admin-triggered
-- "Sync Attendance" action which pulls from Zoom's Reports API and flips
-- these columns + fires Meta CAPI + updates LeadSquared.
--
-- All columns nullable / safe defaults. Idempotent. Safe to run multiple times.

set search_path = excel_to_ai, public;

alter table excel_to_ai.registrations
  add column if not exists attended                  boolean,             -- null = unknown / not synced; true = attended; false = no-show
  add column if not exists attended_at               timestamptz,         -- earliest join time from Zoom report
  add column if not exists attendance_duration_min   integer,             -- total minutes attended (Zoom)
  add column if not exists attendance_synced_at      timestamptz,         -- when we last ran the sync against this row
  add column if not exists meta_attended_event_fired boolean default false; -- idempotency guard so re-running sync doesn't double-fire to Meta

-- Track sync runs across the webinar lifecycle (one row per click of "Sync
-- Attendance" in the admin panel). Useful for audit and for showing the
-- "last synced at" timestamp without scanning every registration row.
create table if not exists excel_to_ai.attendance_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  ran_at        timestamptz not null default now(),
  ran_by        text,                      -- admin email from session
  webinar_id    text,
  attendees_total int,                     -- total participant rows from Zoom
  newly_marked  int,                       -- rows we flipped from null/false to true
  meta_fired    int,                       -- WebinarAttended events sent to Meta CAPI
  lsq_updated   int,                       -- LSQ rows successfully updated
  error_summary text                       -- non-empty if anything went wrong
);

-- Reload PostgREST schema cache so new columns are visible immediately.
notify pgrst, 'reload schema';
