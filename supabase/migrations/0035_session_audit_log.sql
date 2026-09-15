-- 0035_session_audit_log.sql
-- Who changed a webinar session, when, and what actually changed.
--
-- Added after otp_required was found flipped off on the live launch session
-- for ~3 hours with no way to tell who did it or why — the PATCH route wrote
-- the column but logged nothing. Generic by design (activate / end / update),
-- not otp_required-specific, so it covers the next unexplained flip too,
-- whatever field it's on.
--
-- Safe to run repeatedly.

set search_path = excel_to_ai, public;

create table if not exists excel_to_ai.session_audit_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  session_id    uuid not null references excel_to_ai.webinar_sessions(id) on delete cascade,
  admin_email   text not null,
  action        text not null,              -- 'activate' | 'end' | 'update'
  changes       jsonb not null default '{}', -- { field: { from, to }, ... } — only fields that actually changed
  ip            text
);

create index if not exists session_audit_log_session_idx on excel_to_ai.session_audit_log (session_id, created_at desc);

-- Service role needs full access (PostgREST will use it server-side).
grant usage on schema excel_to_ai to service_role;
grant all on excel_to_ai.session_audit_log to service_role;

notify pgrst, 'reload schema';
