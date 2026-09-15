-- ============================================================================
-- 0004_dynamic_phase3.sql
-- Goal: final dynamization sweep — footer links, all form labels/placeholders/
-- options, OTP screen copy, success screen copy, faculty chips, trusted-by alt.
--
-- Same SAFETY GUARANTEES as 0002 / 0003. All new columns nullable, additive only.
-- ============================================================================

-- Footer links (4 × label + URL) -------------------------------------------
alter table excel_to_ai.settings add column if not exists footer_link_1_label text;
alter table excel_to_ai.settings add column if not exists footer_link_1_url   text;
alter table excel_to_ai.settings add column if not exists footer_link_2_label text;
alter table excel_to_ai.settings add column if not exists footer_link_2_url   text;
alter table excel_to_ai.settings add column if not exists footer_link_3_label text;
alter table excel_to_ai.settings add column if not exists footer_link_3_url   text;
alter table excel_to_ai.settings add column if not exists footer_link_4_label text;
alter table excel_to_ai.settings add column if not exists footer_link_4_url   text;

-- Form labels ---------------------------------------------------------------
alter table excel_to_ai.settings add column if not exists form_label_name      text;
alter table excel_to_ai.settings add column if not exists form_label_email     text;
alter table excel_to_ai.settings add column if not exists form_label_phone     text;
alter table excel_to_ai.settings add column if not exists form_label_status    text;
alter table excel_to_ai.settings add column if not exists form_label_city      text;
alter table excel_to_ai.settings add column if not exists form_label_referral  text;

-- Form placeholders ---------------------------------------------------------
alter table excel_to_ai.settings add column if not exists form_placeholder_name     text;
alter table excel_to_ai.settings add column if not exists form_placeholder_email    text;
alter table excel_to_ai.settings add column if not exists form_placeholder_phone    text;
alter table excel_to_ai.settings add column if not exists form_placeholder_select   text;
alter table excel_to_ai.settings add column if not exists form_placeholder_city     text;

-- Form select options (newline-separated) -----------------------------------
alter table excel_to_ai.settings add column if not exists form_status_options       text;
alter table excel_to_ai.settings add column if not exists form_referral_options     text;

-- OTP screen copy -----------------------------------------------------------
alter table excel_to_ai.settings add column if not exists otp_heading               text;
alter table excel_to_ai.settings add column if not exists otp_subtitle_template     text; -- supports {phone} substitution
alter table excel_to_ai.settings add column if not exists otp_edit_details_label    text;
alter table excel_to_ai.settings add column if not exists otp_verify_button_text    text;

-- Success screen copy -------------------------------------------------------
alter table excel_to_ai.settings add column if not exists success_heading           text;
alter table excel_to_ai.settings add column if not exists success_body              text;

-- Faculty section chips (3) -------------------------------------------------
alter table excel_to_ai.settings add column if not exists faculty_chip_1            text;
alter table excel_to_ai.settings add column if not exists faculty_chip_2            text;
alter table excel_to_ai.settings add column if not exists faculty_chip_3            text;

-- Trusted-by image alt text -------------------------------------------------
alter table excel_to_ai.settings add column if not exists partnership_image_alt     text;
