-- 0036_broadcast_audience_scope.sql
-- Lets a broadcast reach everyone who EVER registered — across every past
-- masterclass — instead of only the active session's registrants.
--
-- audience_scope
--   'session'      — the active session's registrants (every campaign until now)
--   'all_sessions' — one row per person across all sessions; "verified" means
--                    they verified in ANY session, "unverified" means never
--
-- exclude_session_registrants
--   Only meaningful with 'all_sessions'. Drops anyone who already has a
--   registration in the campaign's own session — the masterclass being
--   promoted — so a "register for the new masterclass" message never reaches
--   someone who already did.
--
-- Both are stored on the campaign rather than passed per request because a
-- campaign's audience is RECOMPUTED later — when a scheduled send fires, and on
-- "Send to new" / "Retry". Without the scope persisted, those would silently
-- shrink a 6,000-person broadcast back to the active session's few hundred.
--
-- Defaults keep every existing campaign exactly as it was. Safe to re-run.

set search_path = excel_to_ai, public;

alter table excel_to_ai.whatsapp_campaigns
  add column if not exists audience_scope text not null default 'session'
    check (audience_scope in ('session', 'all_sessions')),
  add column if not exists exclude_session_registrants boolean not null default false;

alter table excel_to_ai.email_campaigns
  add column if not exists audience_scope text not null default 'session'
    check (audience_scope in ('session', 'all_sessions')),
  add column if not exists exclude_session_registrants boolean not null default false;

notify pgrst, 'reload schema';
