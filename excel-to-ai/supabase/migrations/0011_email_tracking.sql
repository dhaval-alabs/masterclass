-- 0011_email_tracking.sql
-- Per-event open/click tracking for email campaigns.
-- The tracking pixel at /api/track/open/{campaignId} inserts a row here
-- and increments the denormalised counters on email_campaigns.

set search_path = excel_to_ai, public;

-- Add stats counters to the campaigns table.
alter table excel_to_ai.email_campaigns
  add column if not exists open_count        int not null default 0,
  add column if not exists unique_open_count int not null default 0,
  add column if not exists click_count       int not null default 0;

-- Raw event log (one row per open / click).
create table if not exists excel_to_ai.email_events (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references excel_to_ai.email_campaigns(id) on delete cascade,
  -- 'open'  = tracking pixel fired
  -- 'click' = link click (for future use)
  event_type     text not null check (event_type in ('open','click')),
  -- sha-256 hash of the recipient email — lets us count unique opens
  -- without storing raw PII in this table.
  recipient_hash text,
  url            text,    -- populated for click events
  occurred_at    timestamptz not null default now()
);

create index if not exists email_events_campaign_id_idx
  on excel_to_ai.email_events (campaign_id);

create index if not exists email_events_type_hash_idx
  on excel_to_ai.email_events (campaign_id, event_type, recipient_hash);

notify pgrst, 'reload schema';
