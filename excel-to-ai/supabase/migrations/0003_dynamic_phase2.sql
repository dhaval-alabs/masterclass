-- ============================================================================
-- 0003_dynamic_phase2.sql
-- Goal: extend the dynamic content surface to cover every visible piece of
-- copy on the landing page (hero H1, definition section bullets, features
-- intro, agenda section intro, session objectives, faculty heading, etc.)
--
-- SAFETY GUARANTEES (same as 0002):
--   • All new columns are nullable.
--   • Existing columns are NOT touched.
--   • LP code falls back to hardcoded values when columns are NULL.
--
-- Idempotent. Run as postgres superuser.
-- ============================================================================

-- Hero (left column) --------------------------------------------------------
alter table excel_to_ai.settings add column if not exists hero_eyebrow_pill          text;
alter table excel_to_ai.settings add column if not exists hero_h1_markup             text; -- supports *green* markup
alter table excel_to_ai.settings add column if not exists hero_subtitle              text;
alter table excel_to_ai.settings add column if not exists countdown_label            text;
alter table excel_to_ai.settings add column if not exists urgency_badge_text         text;
alter table excel_to_ai.settings add column if not exists save_spot_cta_text         text;

-- Form card (right column) --------------------------------------------------
alter table excel_to_ai.settings add column if not exists form_pill_date_label       text;
alter table excel_to_ai.settings add column if not exists form_pill_seats_label      text;
alter table excel_to_ai.settings add column if not exists form_otp_footer_label      text;
alter table excel_to_ai.settings add column if not exists form_bottom_stat_1_value   text;
alter table excel_to_ai.settings add column if not exists form_bottom_stat_1_label   text;
alter table excel_to_ai.settings add column if not exists form_bottom_stat_2_value   text;
alter table excel_to_ai.settings add column if not exists form_bottom_stat_2_label   text;
alter table excel_to_ai.settings add column if not exists form_bottom_stat_3_value   text;
alter table excel_to_ai.settings add column if not exists form_bottom_stat_3_label   text;
alter table excel_to_ai.settings add column if not exists stats_disclaimer           text;
alter table excel_to_ai.settings add column if not exists partnership_caption        text;
alter table excel_to_ai.settings add column if not exists partnership_image_path     text;

-- Definition section --------------------------------------------------------
alter table excel_to_ai.settings add column if not exists definition_eyebrow         text;
alter table excel_to_ai.settings add column if not exists definition_a_bullets       text; -- newline-separated
alter table excel_to_ai.settings add column if not exists definition_b_bullets       text; -- newline-separated

-- Features section ----------------------------------------------------------
alter table excel_to_ai.settings add column if not exists features_section_title     text; -- supports *green* markup
alter table excel_to_ai.settings add column if not exists features_section_subtitle  text;
alter table excel_to_ai.settings add column if not exists features_image_path        text;

-- Inside the Session (agenda) ----------------------------------------------
alter table excel_to_ai.settings add column if not exists session_inside_pill        text;
alter table excel_to_ai.settings add column if not exists session_badge_1            text;
alter table excel_to_ai.settings add column if not exists session_badge_2            text;
alter table excel_to_ai.settings add column if not exists session_badge_3            text;
alter table excel_to_ai.settings add column if not exists session_obj_eyebrow        text;
alter table excel_to_ai.settings add column if not exists session_obj_title          text;
alter table excel_to_ai.settings add column if not exists session_obj_1_num          text;
alter table excel_to_ai.settings add column if not exists session_obj_1_title        text;
alter table excel_to_ai.settings add column if not exists session_obj_1_desc         text;
alter table excel_to_ai.settings add column if not exists session_obj_2_num          text;
alter table excel_to_ai.settings add column if not exists session_obj_2_title        text;
alter table excel_to_ai.settings add column if not exists session_obj_2_desc         text;
alter table excel_to_ai.settings add column if not exists session_walkthrough_eyebrow text;
alter table excel_to_ai.settings add column if not exists session_walkthrough_title  text;

-- Faculty section -----------------------------------------------------------
alter table excel_to_ai.settings add column if not exists faculty_heading_prefix     text;

-- FAQ section ---------------------------------------------------------------
alter table excel_to_ai.settings add column if not exists faq_section_title          text;

-- ============================================================================
-- After running:
--   select count(*) from information_schema.columns where table_schema='excel_to_ai' and table_name='settings';
--   -- Should be ~75+ columns now.
--   Then: npx tsx scripts/seed-dynamic-phase2.ts
-- ============================================================================
