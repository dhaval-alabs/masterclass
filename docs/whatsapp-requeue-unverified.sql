-- One-time recovery for the UNVERIFIED campaign (exceltoai_22nov__otp_unverified). Run in Supabase.
-- Re-queues people who did not receive it, EXCEPT anyone who has since verified (no point nudging
-- them) and anyone with a permanent error. With the priority change deployed, unverified campaigns
-- drain first and keep up to 500/day reserved, so these go out on the next cron tick.

-- STEP 1 — PREVIEW (changes nothing).
with camp as (
  select id from excel_to_ai.whatsapp_campaigns where template_name = 'exceltoai_22nov__otp_unverified'
),
verified as (
  select distinct right(regexp_replace(phone,'\D','','g'),10) as k
  from excel_to_ai.registrations where status = 'Verified'
),
best as (
  select right(regexp_replace(l.phone,'\D','','g'),10) as k,
         max(case l.status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2 when 'failed' then 1 else 0 end) as r,
         max(l.sent_at) as last_at,
         bool_or(l.status = 'failed' and l.error_detail ~ 'code=(131026|131021|131030|1013|131049|130472)\D') as permanent
  from excel_to_ai.whatsapp_send_log l where l.campaign_id in (select id from camp)
  group by 1
),
q as (
  select right(regexp_replace(q.phone,'\D','','g'),10) as k, q.status as queue_status
  from excel_to_ai.whatsapp_send_queue q where q.campaign_id in (select id from camp)
)
select case when q.queue_status in ('pending','processing') then 'already queued'
            when v.k is not null then 'skip: verified since'
            when b.permanent then 'skip: permanent error'
            when b.r >= 3 then 'skip: delivered/read'
            when b.r = 2 and b.last_at >= '2026-11-17 03:30:00+00' then 'skip: sent today'
            when b.r is null then 'REQUEUE: never attempted'
            else 'REQUEUE: failed or never delivered' end as outcome,
       count(*) as people
from q left join best b on b.k = q.k left join verified v on v.k = q.k
group by 1 order by 1;

-- STEP 2 — REQUEUE.
with camp as (
  select id from excel_to_ai.whatsapp_campaigns where template_name = 'exceltoai_22nov__otp_unverified'
),
verified as (
  select distinct right(regexp_replace(phone,'\D','','g'),10) as k
  from excel_to_ai.registrations where status = 'Verified'
),
best as (
  select right(regexp_replace(l.phone,'\D','','g'),10) as k,
         max(case l.status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2 when 'failed' then 1 else 0 end) as r,
         max(l.sent_at) as last_at,
         bool_or(l.status = 'failed' and l.error_detail ~ 'code=(131026|131021|131030|1013|131049|130472)\D') as permanent
  from excel_to_ai.whatsapp_send_log l where l.campaign_id in (select id from camp)
  group by 1
)
update excel_to_ai.whatsapp_send_queue q
   set status = 'pending', processed_at = null, claimed_at = null, error = null
  from camp
 where q.campaign_id = camp.id
   and q.status in ('sent', 'failed', 'skipped')
   and right(regexp_replace(q.phone,'\D','','g'),10) not in (select k from verified)
   and not exists (
     select 1 from best b
      where b.k = right(regexp_replace(q.phone,'\D','','g'),10)
        and (b.permanent or b.r >= 3 or (b.r = 2 and b.last_at >= '2026-11-17 03:30:00+00'))
   );

update excel_to_ai.whatsapp_campaigns set status = 'sending'
 where template_name = 'exceltoai_22nov__otp_unverified';
