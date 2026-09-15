-- 0010_email_campaigns.sql
-- Email campaign management. Each row is one composed campaign (subject + body +
-- audience filter). Status starts as 'draft'; transitions to 'sent' once an email
-- service dispatches it. 'partial' = some recipients failed.

set search_path = excel_to_ai, public;

create table if not exists excel_to_ai.email_campaigns (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references excel_to_ai.webinar_sessions(id),
  subject           text not null,
  body_text         text not null,
  -- 'verified' | 'unverified' | 'all'
  audience          text not null check (audience in ('verified','unverified','all')),
  -- 'draft' = saved, no email service yet
  -- 'sending' = in-flight
  -- 'sent'    = fully dispatched
  -- 'partial' = sent to some, failed for others
  -- 'failed'  = dispatch attempted but all failed
  status            text not null default 'draft'
                    check (status in ('draft','sending','sent','partial','failed')),
  total_recipients  int not null default 0,
  sent_count        int not null default 0,
  failed_count      int not null default 0,
  error_summary     text,
  banner_url        text,              -- optional uploaded image shown at top of email
  created_at        timestamptz not null default now(),
  sent_at           timestamptz
);

create index if not exists email_campaigns_session_id_idx
  on excel_to_ai.email_campaigns (session_id);

notify pgrst, 'reload schema';
