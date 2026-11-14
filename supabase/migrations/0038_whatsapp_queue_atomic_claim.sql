-- 0038_whatsapp_queue_atomic_claim.sql
-- Stop concurrent queue drains from sending the same person twice.
--
-- Before: claimPendingWhatsAppQueue() was a plain SELECT of 'pending' rows, and rows were only
-- marked after the whole chunk had been sent (tens of seconds later). The cron (every 5 min), the
-- inline send request and any overlapping cron tick could all read the SAME pending rows and message
-- the same people again — the 11-13 log shows 937 'sent' rows for 719 unique phones, and ~6,600
-- failed rows for ~4,060 unique failed people.
--
-- Now: claiming flips rows to 'processing' in one statement, using FOR UPDATE SKIP LOCKED, so two
-- drains can never receive the same row. Rows stuck in 'processing' (function killed mid-send) are
-- returned to 'pending' after 15 minutes.

alter table excel_to_ai.whatsapp_send_queue
  add column if not exists claimed_at timestamptz;

alter table excel_to_ai.whatsapp_send_queue
  drop constraint if exists whatsapp_send_queue_status_check;
alter table excel_to_ai.whatsapp_send_queue
  add constraint whatsapp_send_queue_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'skipped', 'cancelled'));

create or replace function excel_to_ai.claim_whatsapp_queue(p_campaign_id uuid, p_limit int)
returns table (id uuid, phone text, recipient_name text)
language plpgsql
security definer
as $$
begin
  -- Recover rows abandoned by a drain that died mid-send.
  update excel_to_ai.whatsapp_send_queue q
     set status = 'pending'
   where q.campaign_id = p_campaign_id
     and q.status = 'processing'
     and q.processed_at is null
     and q.claimed_at < now() - interval '15 minutes';

  return query
  with picked as (
    select q.id
      from excel_to_ai.whatsapp_send_queue q
     where q.campaign_id = p_campaign_id
       and q.status = 'pending'
     order by q.created_at
     limit greatest(p_limit, 0)
     for update skip locked
  )
  update excel_to_ai.whatsapp_send_queue q
     set status = 'processing', claimed_at = now()
    from picked
   where q.id = picked.id
  returning q.id, q.phone, q.recipient_name;
end;
$$;

-- "Which campaigns still have work" must count rows in flight as work too.
create index if not exists wsq_processing
  on excel_to_ai.whatsapp_send_queue (campaign_id)
  where status = 'processing';
