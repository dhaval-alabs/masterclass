-- 0028_whatsapp_campaign_conversion.sql
-- Per-campaign "unverified → verified" conversion.
--
-- For a campaign that reached unverified people (audience 'unverified' or 'all'),
-- counts how many recipients we actually reached and, of those who were NOT
-- already verified before the send, how many have since completed OTP.
--
-- Attribution rule: a verification counts only when verified_at >= the campaign's
-- sent_at (they verified AFTER receiving it). Recipients already verified before
-- the send are excluded from the denominator so the rate reflects the unverified
-- audience only. The join is an exact phone match — whatsapp_send_log.phone is the
-- unmodified registrations.phone the recipient was built from.
create or replace function excel_to_ai.whatsapp_campaign_conversion(p_campaign_id uuid)
returns table (reached int, unverified_reached int, verified_after int)
language sql
security definer
as $$
  with camp as (
    select sent_at from excel_to_ai.whatsapp_campaigns where id = p_campaign_id
  ),
  -- Distinct phones the campaign actually delivered a message to.
  reached_phones as (
    select distinct l.phone
    from excel_to_ai.whatsapp_send_log l
    where l.campaign_id = p_campaign_id
      and l.status in ('sent', 'delivered', 'read')
  ),
  -- Collapse the (possibly multiple) registration rows per phone into one verdict.
  per_phone as (
    select
      rp.phone,
      bool_or(r.status = 'Verified' and r.verified_at >= (select sent_at from camp)) as verified_after,
      bool_or(r.status = 'Verified' and r.verified_at <  (select sent_at from camp)) as verified_before
    from reached_phones rp
    left join excel_to_ai.registrations r on r.phone = rp.phone
    group by rp.phone
  )
  select
    (select count(*) from reached_phones)::int                                  as reached,
    (select count(*) from per_phone where not coalesce(verified_before, false))::int as unverified_reached,
    (select count(*) from per_phone where coalesce(verified_after, false))::int      as verified_after;
$$;

grant execute on function excel_to_ai.whatsapp_campaign_conversion(uuid)
  to service_role, authenticated, anon;

notify pgrst, 'reload schema';
