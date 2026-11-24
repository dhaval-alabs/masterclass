-- 0039_whatsapp_aggregates.sql
-- Count in the database instead of shipping every log row to the app.
--
-- Why: the free plan allows 5 GB of egress a month and the old project used 13-14 GB and was
-- shut off. Every queue drain (the cron every 5 min, plus the admin page asking every 2 s while
-- a campaign was "sending") downloaded the campaign's ENTIRE send log — 10,000+ rows, several MB —
-- just to compute three counts, and again for the failure breakdown and the daily-limit check.
-- These functions return a handful of numbers instead.

create index if not exists whatsapp_send_log_sent_at_idx
  on excel_to_ai.whatsapp_send_log (sent_at);

-- Deduped per phone (last 10 digits), keeping each person's furthest-along status.
create or replace function excel_to_ai.whatsapp_campaign_log_counts(p_campaign_id uuid)
returns table (sent int, failed int, skipped int)
language sql stable security definer set search_path = excel_to_ai, public
as $$
  with best as (
    select coalesce(nullif(right(regexp_replace(phone, '\D', '', 'g'), 10), ''), id::text) as k,
           max(case status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2
                           when 'failed' then 1 else 0 end) as r
      from whatsapp_send_log
     where campaign_id = p_campaign_id
     group by 1
  )
  select (count(*) filter (where r >= 2))::int,
         (count(*) filter (where r = 1))::int,
         (count(*) filter (where r = 0))::int
    from best;
$$;

-- Unique people successfully messaged since p_since (the daily-limit check).
create or replace function excel_to_ai.whatsapp_daily_sent_count(p_since timestamptz)
returns int
language sql stable security definer set search_path = excel_to_ai, public
as $$
  select count(distinct right(regexp_replace(phone, '\D', '', 'g'), 10))::int
    from whatsapp_send_log
   where status in ('sent', 'delivered', 'read')
     and sent_at >= p_since;
$$;

-- People whose best status is 'failed', grouped by their latest error (code, or text when no code).
create or replace function excel_to_ai.whatsapp_failure_groups(p_campaign_id uuid)
returns table (error_key text, sample text, people int)
language sql stable security definer set search_path = excel_to_ai, public
as $$
  with per as (
    select right(regexp_replace(phone, '\D', '', 'g'), 10) as k,
           max(case status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2
                           when 'failed' then 1 else 0 end) as r,
           (array_agg(error_detail order by sent_at desc) filter (where status = 'failed'))[1] as err
      from whatsapp_send_log
     where campaign_id = p_campaign_id
     group by 1
  )
  select coalesce(substring(err from 'code=(\d+)'), left(coalesce(err, ''), 80)) as error_key,
         min(err) as sample,
         count(*)::int as people
    from per
   where r = 1 and k <> ''
   group by 1
   order by 3 desc
   limit 50;
$$;

grant execute on function excel_to_ai.whatsapp_campaign_log_counts(uuid) to service_role;
grant execute on function excel_to_ai.whatsapp_daily_sent_count(timestamptz) to service_role;
grant execute on function excel_to_ai.whatsapp_failure_groups(uuid) to service_role;
grant execute on function excel_to_ai.claim_whatsapp_queue(uuid, int) to service_role;
