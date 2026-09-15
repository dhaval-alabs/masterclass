-- 0013_email_recipients_autosend.sql
-- Per-recipient delivery log + auto-send columns on campaigns.

set search_path = excel_to_ai, public;

-- Track every individual email delivery so we can find "new" registrations
-- that haven't received a specific campaign yet.
create table if not exists excel_to_ai.email_campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references excel_to_ai.email_campaigns(id) on delete cascade,
  email       text not null,
  full_name   text,
  sent_at     timestamptz not null default now(),

  -- One row per (campaign, email) — re-sends would update sent_at via upsert.
  unique (campaign_id, email)
);

create index if not exists ecr_campaign_id_idx on excel_to_ai.email_campaign_recipients (campaign_id);
create index if not exists ecr_email_idx       on excel_to_ai.email_campaign_recipients (email);

-- Auto-send columns on campaigns.
-- auto_send_enabled = true  → every new registration that matches the audience
--                             automatically gets this campaign email.
-- auto_send_audience        → 'verified' | 'unverified' | 'all'
--                             (null = inherit from campaign audience)
alter table excel_to_ai.email_campaigns
  add column if not exists auto_send_enabled  boolean not null default false,
  add column if not exists auto_send_audience text
    check (auto_send_audience in ('verified','unverified','all'));

notify pgrst, 'reload schema';
