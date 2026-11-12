-- 0037_broadcast_attendance_audiences.sql
-- Adds two broadcast audiences, built from Zoom attendance across every
-- masterclass (used with audience_scope = 'all_sessions'):
--
--   never_attended   — registered (verified or not), never attended any session
--   verified_no_show — verified at least once, never attended any session
--
-- The audience column's CHECK constraint only allowed verified/unverified/all,
-- so saving a campaign with a new audience would fail. This widens it on both
-- campaign tables. Existing rows are untouched. Safe to re-run.

set search_path = excel_to_ai, public;

-- Drop whatever CHECK constraint currently guards each table's audience column
-- (normally <table>_audience_check, but don't rely on the name), then add ours.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'c'
      and a.attname = 'audience'
      and c.conrelid in ('excel_to_ai.whatsapp_campaigns'::regclass, 'excel_to_ai.email_campaigns'::regclass)
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table excel_to_ai.whatsapp_campaigns
  add constraint whatsapp_campaigns_audience_check
    check (audience in ('verified', 'unverified', 'all', 'never_attended', 'verified_no_show'));

alter table excel_to_ai.email_campaigns
  add constraint email_campaigns_audience_check
    check (audience in ('verified', 'unverified', 'all', 'never_attended', 'verified_no_show'));

notify pgrst, 'reload schema';
