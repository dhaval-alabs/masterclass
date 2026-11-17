-- One-time recovery for nov_22_retarget (Nov 2026). Run in the Supabase SQL editor.
-- Puts back in the send queue everyone who did NOT actually receive the message:
--   * best status 'failed' with a recoverable error (e.g. 131042 payment block), or
--   * best status 'sent' from before 17 Nov 09:00 IST — accepted by Meta but never delivered
--     (14-16 Nov: 2,305 'sent', 1 delivered).
-- Skips anyone delivered/read, and anyone with a permanent error (not on WhatsApp / Meta-filtered).
-- The cron then sends them within the daily limit, oldest first.

-- STEP 1 — PREVIEW (changes nothing). Check the numbers look right before step 2.
with best as (
  select l.campaign_id,
         right(regexp_replace(l.phone,'\D','','g'),10) as k,
         max(case l.status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2 when 'failed' then 1 else 0 end) as r,
         max(l.sent_at) as last_at,
         bool_or(l.status = 'failed' and l.error_detail ~ 'code=(131026|131021|131030|1013|131049|130472)\\D') as permanent
  from excel_to_ai.whatsapp_send_log l
  join excel_to_ai.whatsapp_campaigns c on c.id = l.campaign_id
  where c.template_name = 'nov_22_retarget'
  group by 1, 2
)
select case when permanent then 'skip: permanent error'
            when r >= 3 then 'skip: already delivered/read'
            when r = 2 and last_at >= '2026-11-17 03:30:00+00' then 'skip: sent today, may still deliver'
            when r = 2 then 'REQUEUE: sent but never delivered'
            when r = 1 then 'REQUEUE: failed, recoverable'
            else 'skip: other' end as outcome,
       count(*) as people
from best group by 1 order by 1;

-- STEP 2 — REQUEUE. Run only after step 1 looks right.
with best as (
  select l.campaign_id,
         right(regexp_replace(l.phone,'\D','','g'),10) as k,
         max(case l.status when 'read' then 4 when 'delivered' then 3 when 'sent' then 2 when 'failed' then 1 else 0 end) as r,
         max(l.sent_at) as last_at,
         bool_or(l.status = 'failed' and l.error_detail ~ 'code=(131026|131021|131030|1013|131049|130472)\\D') as permanent
  from excel_to_ai.whatsapp_send_log l
  join excel_to_ai.whatsapp_campaigns c on c.id = l.campaign_id
  where c.template_name = 'nov_22_retarget'
  group by 1, 2
)
update excel_to_ai.whatsapp_send_queue q
   set status = 'pending', processed_at = null, claimed_at = null, error = null
  from best b
 where q.campaign_id = b.campaign_id
   and right(regexp_replace(q.phone,'\D','','g'),10) = b.k
   and q.status in ('sent', 'failed', 'skipped')
   and not b.permanent
   and (b.r = 1 or (b.r = 2 and b.last_at < '2026-11-17 03:30:00+00'));

update excel_to_ai.whatsapp_campaigns
   set status = 'sending', error_summary = 'Re-queued people who never received it — sending within the daily limit.'
 where template_name = 'nov_22_retarget';
