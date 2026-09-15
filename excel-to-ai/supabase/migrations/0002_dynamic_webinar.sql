-- ============================================================================
-- 0002_dynamic_webinar.sql
-- Goal: make the landing page content editable from the admin panel so the
-- same codebase can host any future masterclass without a redeploy.
--
-- SAFETY GUARANTEES:
--   • All new columns on excel_to_ai.settings are nullable (no defaults).
--   • Existing columns (speaker_name, speaker_title, speaker_image, speaker_bio)
--     are NOT touched.
--   • Existing rows in settings / registrations / faqs are NOT modified.
--   • New tables (features, agenda_items) start empty.
--   • The LP code falls back to the current hardcoded strings if any column
--     is null — so running this migration alone changes nothing visible.
--
-- Idempotent: safe to re-run.
-- Run as the postgres superuser (Supabase SQL editor).
-- ============================================================================

-- 1. settings — add new columns (nullable) ----------------------------------

alter table excel_to_ai.settings add column if not exists webinar_title           text;
alter table excel_to_ai.settings add column if not exists webinar_subtitle        text;
alter table excel_to_ai.settings add column if not exists eyebrow_text            text;
alter table excel_to_ai.settings add column if not exists webinar_date_label      text;
alter table excel_to_ai.settings add column if not exists webinar_time_label      text;
alter table excel_to_ai.settings add column if not exists webinar_datetime_utc    timestamptz;
alter table excel_to_ai.settings add column if not exists duration_label          text;
alter table excel_to_ai.settings add column if not exists meta_title              text;
alter table excel_to_ai.settings add column if not exists meta_description        text;
alter table excel_to_ai.settings add column if not exists og_image_url            text;
alter table excel_to_ai.settings add column if not exists form_heading            text;
alter table excel_to_ai.settings add column if not exists form_subheading         text;
alter table excel_to_ai.settings add column if not exists sticky_eyebrow          text;
alter table excel_to_ai.settings add column if not exists sticky_main             text;
alter table excel_to_ai.settings add column if not exists cta_button_text         text;
alter table excel_to_ai.settings add column if not exists nav_cta_text            text;
alter table excel_to_ai.settings add column if not exists logo_path               text;
alter table excel_to_ai.settings add column if not exists zoom_webinar_id         text;
alter table excel_to_ai.settings add column if not exists lsq_source_name         text;
alter table excel_to_ai.settings add column if not exists whatsapp_template_name  text;
alter table excel_to_ai.settings add column if not exists hero_stat_1_value       text;
alter table excel_to_ai.settings add column if not exists hero_stat_1_label       text;
alter table excel_to_ai.settings add column if not exists hero_stat_2_value       text;
alter table excel_to_ai.settings add column if not exists hero_stat_2_label       text;
alter table excel_to_ai.settings add column if not exists hero_stat_3_value       text;
alter table excel_to_ai.settings add column if not exists hero_stat_3_label       text;
alter table excel_to_ai.settings add column if not exists show_definition_section boolean;
alter table excel_to_ai.settings add column if not exists definition_section_title text;
alter table excel_to_ai.settings add column if not exists definition_intro        text;
alter table excel_to_ai.settings add column if not exists definition_a_title      text;
alter table excel_to_ai.settings add column if not exists definition_a_body       text;
alter table excel_to_ai.settings add column if not exists definition_b_title      text;
alter table excel_to_ai.settings add column if not exists definition_b_body       text;
alter table excel_to_ai.settings add column if not exists agenda_section_title    text;
alter table excel_to_ai.settings add column if not exists agenda_section_subtitle text;
alter table excel_to_ai.settings add column if not exists faculty_intro           text;
alter table excel_to_ai.settings add column if not exists footer_text             text;

-- 2. features — new table for the "What You'll Master" cards ----------------

create table if not exists excel_to_ai.features (
  id          text primary key,
  icon        text,                                  -- emoji or short label
  title       text not null,
  description text not null,
  accent      text,                                  -- 'gold' for the gold-tinted card, NULL for default
  sort_order  integer not null default 0
);

create index if not exists features_sort_order_idx
  on excel_to_ai.features (sort_order);

alter table excel_to_ai.features owner to lp_excel_to_ai;
alter table excel_to_ai.features enable row level security;

drop policy if exists "anon read features" on excel_to_ai.features;
create policy "anon read features"
  on excel_to_ai.features
  for select
  to anon
  using (true);

-- 3. agenda_items — new table for the "Inside the Session" timeline ---------

create table if not exists excel_to_ai.agenda_items (
  id          text primary key,
  title       text not null,
  description text not null,
  highlight   boolean not null default false,        -- TRUE = dark-blue program-walkthrough card
  sort_order  integer not null default 0
);

create index if not exists agenda_items_sort_order_idx
  on excel_to_ai.agenda_items (sort_order);

alter table excel_to_ai.agenda_items owner to lp_excel_to_ai;
alter table excel_to_ai.agenda_items enable row level security;

drop policy if exists "anon read agenda_items" on excel_to_ai.agenda_items;
create policy "anon read agenda_items"
  on excel_to_ai.agenda_items
  for select
  to anon
  using (true);

-- 4. Standard role grants (matches the pattern in 0001) ---------------------

grant usage on schema excel_to_ai to anon, authenticated, service_role;

grant all on excel_to_ai.features      to service_role;
grant all on excel_to_ai.agenda_items   to service_role;
grant select on excel_to_ai.features    to anon, authenticated;
grant select on excel_to_ai.agenda_items to anon, authenticated;

-- ============================================================================
-- Verify after running:
--
--   select column_name from information_schema.columns
--     where table_schema = 'excel_to_ai' and table_name = 'settings'
--     order by ordinal_position;
--   -- Should now include the new columns above, all NULL on the existing row.
--
--   select count(*) from excel_to_ai.features;       -- 0
--   select count(*) from excel_to_ai.agenda_items;   -- 0
--
-- Then run: npx tsx scripts/seed-dynamic.ts
-- ============================================================================
