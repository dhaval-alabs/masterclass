-- Run in Supabase SQL editor. Read-only. Explains WHY a WhatsApp campaign failed.

-- 1) Failure reasons per campaign (one row per phone, using its best status).
with ranked as (
  select campaign_id, phone, status, error_detail,
         row_number() over (
           partition by campaign_id, right(regexp_replace(phone,'\D','','g'),10)
           order by case status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2 when 'failed' then 1 else 0 end desc,
                    sent_at desc
         ) rn
  from excel_to_ai.whatsapp_send_log
)
select c.template_name as campaign,
       coalesce(substring(r.error_detail from 'code=(\d+)'), left(r.error_detail, 60)) as error_code,
       count(*) as people,
       min(r.error_detail) as sample_message
from ranked r join excel_to_ai.whatsapp_campaigns c on c.id = r.campaign_id
where r.rn = 1 and r.status = 'failed'
group by 1, 2
order by people desc;

-- 2) Queue state per campaign (confirms the queue is drained and what is pending).
select c.template_name, q.status, count(*)
from excel_to_ai.whatsapp_send_queue q
join excel_to_ai.whatsapp_campaigns c on c.id = q.campaign_id
group by 1, 2 order by 1, 2;

-- 3) Failed AFTER Meta accepted (webhook flipped sent -> failed) vs rejected at send time.
select case when meta_message_id is not null then 'accepted, then undeliverable (webhook)'
            else 'rejected at send / cut off' end as how_it_failed,
       count(*)
from excel_to_ai.whatsapp_send_log
where status = 'failed'
group by 1;

-- 4) Sends/failures per hour — shows when failures began (e.g. a streak).
select date_trunc('hour', sent_at at time zone 'Asia/Kolkata') as hour_ist, status, count(*)
from excel_to_ai.whatsapp_send_log
group by 1, 2 order by 1 desc, 2 limit 80;

-- 5) Duplicate attempts: rows vs unique phones per campaign (rows > phones = people messaged repeatedly).
select c.template_name, l.status, count(*) as log_rows,
       count(distinct right(regexp_replace(l.phone,'\D','','g'),10)) as unique_phones
from excel_to_ai.whatsapp_send_log l
join excel_to_ai.whatsapp_campaigns c on c.id = l.campaign_id
where l.sent_at >= '2026-11-13'
group by 1, 2 order by 1, 2;

-- 6) THE ERROR TEXT for the failures since 13 Nov (run this one on its own).
select substring(error_detail from 'code=(\d+)') as code,
       left(error_detail, 140) as message,
       (meta_message_id is not null) as meta_accepted_first,
       count(*) as rows, count(distinct phone) as people
from excel_to_ai.whatsapp_send_log
where status = 'failed' and sent_at >= '2026-11-13'
group by 1, 2, 3 order by rows desc limit 20;
