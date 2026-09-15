-- Per-recipient WhatsApp send log
create table if not exists excel_to_ai.whatsapp_send_log (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references excel_to_ai.whatsapp_campaigns(id) on delete cascade,
  phone            text not null,
  recipient_name   text,
  status           text not null check (status in ('sent', 'failed', 'delivered', 'read', 'skipped')),
  error_detail     text,
  meta_message_id  text,   -- message ID returned by Meta API, used to match webhook updates
  sent_at          timestamptz default now(),
  delivered_at     timestamptz,
  read_at          timestamptz
);

alter table excel_to_ai.whatsapp_send_log enable row level security;
create policy "service role full access" on excel_to_ai.whatsapp_send_log
  using (true) with check (true);
create policy "authenticated select" on excel_to_ai.whatsapp_send_log
  for select using (auth.role() = 'authenticated');

create index if not exists whatsapp_send_log_campaign_id_idx
  on excel_to_ai.whatsapp_send_log (campaign_id);

create index if not exists whatsapp_send_log_meta_message_id_idx
  on excel_to_ai.whatsapp_send_log (meta_message_id);

-- Opt-out / DND list
create table if not exists excel_to_ai.whatsapp_optouts (
  id       uuid primary key default gen_random_uuid(),
  phone    text not null unique,
  reason   text,
  added_at timestamptz default now()
);

alter table excel_to_ai.whatsapp_optouts enable row level security;
create policy "service role full access" on excel_to_ai.whatsapp_optouts
  using (true) with check (true);
create policy "authenticated select" on excel_to_ai.whatsapp_optouts
  for select using (auth.role() = 'authenticated');
