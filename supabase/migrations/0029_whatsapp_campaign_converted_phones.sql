-- 0029_whatsapp_campaign_converted_phones.sql
-- Companion to 0028's conversion COUNT: returns the actual phone numbers behind
-- the "verified_after" figure, so the recipients list can flag exactly WHO went
-- from unverified → verified after receiving a campaign.
--
-- Same attribution as 0028: a reached recipient (sent/delivered/read) whose
-- registration is now Verified with verified_at >= the campaign's sent_at. The
-- count of these rows equals whatsapp_campaign_conversion().verified_after.
create or replace function excel_to_ai.whatsapp_campaign_converted_phones(p_campaign_id uuid)
returns table (phone text)
language sql
security definer
as $$
  with camp as (
    select sent_at from excel_to_ai.whatsapp_campaigns where id = p_campaign_id
  ),
  reached_phones as (
    select distinct l.phone
    from excel_to_ai.whatsapp_send_log l
    where l.campaign_id = p_campaign_id
      and l.status in ('sent', 'delivered', 'read')
  )
  select rp.phone
  from reached_phones rp
  where exists (
    select 1
    from excel_to_ai.registrations r
    where r.phone = rp.phone
      and r.status = 'Verified'
      and r.verified_at >= (select sent_at from camp)
  );
$$;

grant execute on function excel_to_ai.whatsapp_campaign_converted_phones(uuid)
  to service_role, authenticated, anon;

notify pgrst, 'reload schema';
