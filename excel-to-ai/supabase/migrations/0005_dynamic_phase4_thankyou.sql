-- ============================================================================
-- 0005_dynamic_phase4_thankyou.sql
-- Goal: dynamize the ThankYouPage internals + generic brochure URL.
-- Same safety guarantees: additive, nullable, idempotent.
-- ============================================================================

-- Main heading + sub-copy (currently passed as props from the route)
alter table excel_to_ai.settings add column if not exists thankyou_heading                text;
alter table excel_to_ai.settings add column if not exists thankyou_subcopy                text;
alter table excel_to_ai.settings add column if not exists thankyou_confirmation_template  text; -- supports {email}

-- Webinar action card (has two variants depending on whether the user has a personal Zoom URL)
alter table excel_to_ai.settings add column if not exists thankyou_webinar_title_personal text;
alter table excel_to_ai.settings add column if not exists thankyou_webinar_title_default  text;
alter table excel_to_ai.settings add column if not exists thankyou_webinar_body_personal  text;
alter table excel_to_ai.settings add column if not exists thankyou_webinar_body_default   text;
alter table excel_to_ai.settings add column if not exists thankyou_webinar_cta_personal   text;
alter table excel_to_ai.settings add column if not exists thankyou_webinar_cta_default    text;

-- Phone action card
alter table excel_to_ai.settings add column if not exists thankyou_phone_title            text;
alter table excel_to_ai.settings add column if not exists thankyou_phone_body             text;
alter table excel_to_ai.settings add column if not exists thankyou_phone_cta              text;
alter table excel_to_ai.settings add column if not exists thankyou_phone_number           text; -- E.164 digits, no '+', no spaces

-- WhatsApp action card
alter table excel_to_ai.settings add column if not exists thankyou_whatsapp_title         text;
alter table excel_to_ai.settings add column if not exists thankyou_whatsapp_body          text;
alter table excel_to_ai.settings add column if not exists thankyou_whatsapp_cta           text;
alter table excel_to_ai.settings add column if not exists thankyou_whatsapp_number        text;
alter table excel_to_ai.settings add column if not exists thankyou_whatsapp_message       text;

-- Footer
alter table excel_to_ai.settings add column if not exists thankyou_footer_text            text;

-- Brochure download (generic — used when no per-course slug match)
alter table excel_to_ai.settings add column if not exists generic_brochure_url            text;
alter table excel_to_ai.settings add column if not exists generic_brochure_cta            text;
