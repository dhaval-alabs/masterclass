-- ============================================================================
-- excel_to_ai — initial schema + role + tables
-- Pattern: schema-per-app isolation (see docs/supabase-multi-project-guide.md)
-- Idempotent: safe to re-run.
--
-- Before applying:
--   - Replace <LP_PASSWORD> with the value of EXCEL_TO_AI_DB_PASSWORD from .env.local
--   - Run as the postgres superuser (Supabase SQL editor or psql with admin URL)
-- ============================================================================

-- 1. Schema -----------------------------------------------------------------
create schema if not exists excel_to_ai;

-- 2. Dedicated role with safety defaults ------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lp_excel_to_ai') then
    create role lp_excel_to_ai login password '<LP_PASSWORD>' noinherit;
  end if;
end$$;

-- Supabase's `postgres` role isn't a full superuser. To run
-- `alter table ... owner to lp_excel_to_ai` below, the executor must be a
-- member of lp_excel_to_ai. Grant membership (idempotent).
grant lp_excel_to_ai to postgres;

alter role lp_excel_to_ai set statement_timeout = '5s';
alter role lp_excel_to_ai set idle_in_transaction_session_timeout = '30s';
alter role lp_excel_to_ai set search_path = excel_to_ai;
alter role lp_excel_to_ai connection limit 20;

-- 3. Grants on own schema ---------------------------------------------------
grant usage, create on schema excel_to_ai to lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant all on tables    to lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant all on sequences to lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant execute on functions to lp_excel_to_ai;

-- 4. Revoke on other schemas (defense in depth) -----------------------------
revoke all on schema public  from lp_excel_to_ai;
revoke all on schema auth    from lp_excel_to_ai;
revoke all on schema storage from lp_excel_to_ai;
revoke all privileges on all tables in schema public  from lp_excel_to_ai;
revoke all privileges on all tables in schema auth    from lp_excel_to_ai;
revoke all privileges on all tables in schema storage from lp_excel_to_ai;

-- 5. Tables -----------------------------------------------------------------

-- 5a. settings (singleton row keyed by id = 'speaker')
create table if not exists excel_to_ai.settings (
  id            text primary key,
  speaker_name  text not null,
  speaker_title text not null,
  speaker_image text not null,
  speaker_bio   text not null,
  updated_at    timestamptz not null default now()
);
alter table excel_to_ai.settings owner to lp_excel_to_ai;
alter table excel_to_ai.settings enable row level security;

-- 5b. registrations
create table if not exists excel_to_ai.registrations (
  id          text primary key,
  full_name   text not null,
  email       text not null,
  phone       text not null,
  status      text not null,
  city        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists registrations_created_at_idx
  on excel_to_ai.registrations (created_at desc);
create index if not exists registrations_email_idx
  on excel_to_ai.registrations (email);
alter table excel_to_ai.registrations owner to lp_excel_to_ai;
alter table excel_to_ai.registrations enable row level security;

-- 5c. faqs
create table if not exists excel_to_ai.faqs (
  id          text primary key,
  question    text not null,
  answer      text not null,
  sort_order  integer not null default 0
);
create index if not exists faqs_sort_order_idx
  on excel_to_ai.faqs (sort_order);
alter table excel_to_ai.faqs owner to lp_excel_to_ai;
alter table excel_to_ai.faqs enable row level security;

-- 6. RLS policies -----------------------------------------------------------
-- Owner (lp_excel_to_ai) bypasses RLS automatically.
-- The anon / authenticated roles need explicit allow policies via PostgREST.

drop policy if exists "anon read faqs" on excel_to_ai.faqs;
create policy "anon read faqs"
  on excel_to_ai.faqs
  for select
  to anon
  using (true);

drop policy if exists "anon read settings" on excel_to_ai.settings;
create policy "anon read settings"
  on excel_to_ai.settings
  for select
  to anon
  using (true);

-- registrations stays locked — writes only via the app's pg pool (LP role bypasses RLS).

-- ============================================================================
-- After running this migration:
--   1. Supabase Dashboard → Settings → API → Exposed schemas → add 'excel_to_ai'
--   2. Supabase Dashboard → Settings → Database → Session pooler → copy host
--   3. Build EXCEL_TO_AI_DB_URL in .env.local:
--      postgres://lp_excel_to_ai:<LP_PASSWORD>@<POOLER_HOST>:6543/postgres
--   4. Run `npx tsx scripts/seed-supabase.ts` to import data/db.json
-- ============================================================================

-- 🚨 KILL SWITCH (uncomment to drop everything for this app)
-- begin;
--   drop schema excel_to_ai cascade;
--   drop role if exists lp_excel_to_ai;
-- commit;
