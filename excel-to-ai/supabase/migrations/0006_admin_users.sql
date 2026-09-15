-- 0006_admin_users.sql
-- Multi-admin support: replaces single env-based auth with a managed table.
-- Env vars (ADMIN_USER / ADMIN_PASSWORD / ADMIN_CREDENTIALS) remain a fallback
-- so you can never lock yourself out if this table is empty or corrupted.
--
-- Safe to run multiple times.

set search_path = excel_to_ai, public;

create table if not exists excel_to_ai.admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    text,
  last_login_at timestamptz
);

create index if not exists admin_users_email_idx on excel_to_ai.admin_users (lower(email));

-- Service role needs full access (PostgREST will use it server-side).
grant usage on schema excel_to_ai to service_role;
grant all on excel_to_ai.admin_users to service_role;

-- Reload PostgREST schema cache so the table is visible immediately.
notify pgrst, 'reload schema';
