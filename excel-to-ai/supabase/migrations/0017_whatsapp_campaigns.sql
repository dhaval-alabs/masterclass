-- WhatsApp template campaigns
create table if not exists excel_to_ai.whatsapp_campaigns (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references excel_to_ai.webinar_sessions(id) on delete set null,
  template_name    text not null,
  language_code    text not null default 'en_US',
  audience         text not null check (audience in ('verified','unverified','all')),
  -- JSON array of variable values: ["Hello {{name}}", "June 6"] maps to {{1}}, {{2}} ...
  variables        jsonb not null default '[]',
  status           text not null default 'draft' check (status in ('draft','sending','sent','partial','failed')),
  total_recipients integer not null default 0,
  sent_count       integer not null default 0,
  failed_count     integer not null default 0,
  error_summary    text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

alter table excel_to_ai.whatsapp_campaigns enable row level security;
create policy "service role full access" on excel_to_ai.whatsapp_campaigns
  using (true) with check (true);
