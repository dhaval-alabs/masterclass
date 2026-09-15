-- 0025_registration_meta_click_ids.sql
-- Persist Meta click identifiers on the registration so we can (a) forward them
-- to LeadSquared as mx_FBCLID for CRM→Meta event matching, and (b) include
-- fbc/fbp on the server-side WebinarAttended CAPI event to raise its match
-- quality. Mirrors how gclid is already captured (gclid lives only in LSQ as
-- mx_GCLID; these we also keep locally so server CAPI can reuse them).
--
-- fbc  = the formatted _fbc cookie value (fb.1.<ts>.<fbclid>) — what Meta CAPI wants.
-- fbp  = the _fbp browser cookie (Meta's browser id).
-- fbclid = the raw click id from the ad URL (?fbclid=...), kept for completeness.

ALTER TABLE excel_to_ai.registrations
  ADD COLUMN IF NOT EXISTS fbc    text,
  ADD COLUMN IF NOT EXISTS fbp    text,
  ADD COLUMN IF NOT EXISTS fbclid text;
