-- 0019_email_open_atomic_increment.sql
-- Atomic counter increment for email open tracking.
-- Replaces the non-atomic read-modify-write in recordEmailOpen().

create or replace function excel_to_ai.increment_email_open_counts(
  p_campaign_id uuid,
  p_open_inc    int default 1,
  p_unique_inc  int default 0
)
returns void
language sql
security definer
as $$
  update excel_to_ai.email_campaigns
  set
    open_count        = open_count        + p_open_inc,
    unique_open_count = unique_open_count + p_unique_inc
  where id = p_campaign_id;
$$;

-- Allow the anon/service role to call this function.
grant execute on function excel_to_ai.increment_email_open_counts(uuid, int, int)
  to service_role, authenticated, anon;

notify pgrst, 'reload schema';
