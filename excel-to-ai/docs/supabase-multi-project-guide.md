# Running Multiple Apps on a Single Supabase Project

**A practical guide to isolating multiple independent applications inside one Supabase project without them affecting each other.**

---

## Table of Contents

1. [TL;DR](#tldr)
2. [The Core Problem](#the-core-problem)
3. [The Three Patterns](#the-three-patterns)
4. [Recommended Architecture: Schema-per-App](#recommended-architecture-schema-per-app)
5. [Setup Playbook](#setup-playbook)
6. [Connecting Each App](#connecting-each-app)
7. [Safety Guarantees — What Each Mitigation Protects](#safety-guarantees--what-each-mitigation-protects)
8. [Operational Practices](#operational-practices)
9. [Plan Limits & Monitoring](#plan-limits--monitoring)
10. [Disaster Recovery & Rollback](#disaster-recovery--rollback)
11. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
12. [Pre-Flight Checklist](#pre-flight-checklist)
13. [When to Stop and Use Separate Projects](#when-to-stop-and-use-separate-projects)
14. [Appendix: Full Setup SQL Template](#appendix-full-setup-sql-template)

---

## TL;DR

You can safely run multiple independent applications on one Supabase project by giving each app:

1. Its own Postgres **schema** (not just a table prefix)
2. Its own dedicated Postgres **role** with restricted permissions
3. Statement timeouts and connection limits on that role
4. Row Level Security as defense in depth

The "kill switch" if anything goes wrong: `DROP SCHEMA <app_name> CASCADE;` — atomic, fast, and does not touch other apps.

**This guide covers what to do, what NOT to do, and where this approach breaks down.**

---

## The Core Problem

A Supabase project is a unit of:
- One Postgres database
- One Auth instance (`auth.users` table)
- One Storage backend (buckets)
- One project URL (`https://xxx.supabase.co`)
- One set of API keys (`anon`, `service_role`)
- One billing line item

You can't create "sub-projects" inside it. So when you have multiple apps that want to share infrastructure, you need to decide *how* they share — and how isolated they are from each other.

The risks of mixing apps in one project, ranked by impact:

| Risk | Severity | Mitigation source |
|---|---|---|
| App A's bad migration drops App B's tables | 🔴 Catastrophic | Schema isolation |
| App A's leaked API key exposes App B's data | 🔴 Catastrophic | Role isolation + RLS |
| App A's runaway query takes down the DB | 🔴 High | Statement timeouts, connection limits |
| App A's traffic spike exhausts the connection pool | 🟠 High | Per-role connection limit |
| App A's storage bucket fills up disk | 🟠 Medium | Per-bucket size limits |
| Auth user from App A gets access to App B | 🟠 Medium | Don't use shared Supabase Auth across apps, OR use RLS by `app_origin` claim |
| Backups intermingle — can't restore just App A | 🟡 Low | Logical backups per-schema (`pg_dump --schema=...`) |

The schema-per-app pattern below handles all of the 🔴 and most 🟠 risks.

---

## The Three Patterns

### Pattern 1 — Schema-per-App ⭐ (recommended)

```
Supabase Project
├── public/              ← legacy / shared / convenience
├── app_one/             ← schema owned by role lp_app_one
│   ├── users
│   ├── orders
│   └── settings
├── app_two/             ← schema owned by role lp_app_two
│   ├── registrations
│   ├── faqs
│   └── settings
└── auth/, storage/      ← Supabase-managed (shared)
```

**Pros:**
- True namespace isolation — table names can't collide
- Permissions can be granted per-schema, per-role
- Drop one schema → other schemas untouched
- One billing line, one dashboard
- Cross-schema queries possible when needed (but require explicit grants)

**Cons:**
- Auth and Storage are still shared at the project level
- Resource limits (CPU, RAM, connections) are still shared
- Backups are project-wide (workaround: logical per-schema dumps)

### Pattern 2 — Table Prefixes (avoid)

```
Supabase Project
└── public/
    ├── app_one_users
    ├── app_one_orders
    ├── app_two_registrations
    └── app_two_faqs
```

**Why not:** No real isolation. Anyone with the project's `anon` or `service_role` key can read/write any table. You're trusting application code to never query the wrong prefix. One typo and you've leaked data across apps.

The *only* time this is acceptable: throwaway prototypes that will never see production data.

### Pattern 3 — Separate Supabase Projects

```
Supabase Account
├── Project A (its own DB, auth, storage, URL, keys, billing)
└── Project B (its own DB, auth, storage, URL, keys, billing)
```

**Pros:**
- Total isolation — no shared anything
- Independent backups, regions, plan tiers
- Failure domain is bounded to one project

**Cons:**
- ~$25/mo per Pro project (free tier projects auto-pause after 1 week of inactivity)
- More dashboards, more keys to manage
- Cross-app data sharing requires external integration

**Use this when** the apps have meaningfully different risk profiles, compliance requirements, or scale needs. See [When to Stop and Use Separate Projects](#when-to-stop-and-use-separate-projects).

---

## Recommended Architecture: Schema-per-App

Each app gets:

| Resource | Naming convention | Example |
|---|---|---|
| Schema | `<app_short_name>` | `excel_to_ai` |
| DB role | `lp_<app_short_name>` | `lp_excel_to_ai` |
| Storage bucket (if needed) | `<app_short_name>-uploads` | `excel-to-ai-uploads` |
| Connection string env var | `<APP>_DB_URL` | `EXCEL_TO_AI_DB_URL` |

**Naming rule:** schemas and roles should make it impossible to confuse one app's resources for another's. Use the project's full short name, not generic words like `app_1` or `lp` alone.

---

## Setup Playbook

### Step 1 — Create the schema and role

```sql
-- Replace <STRONG_PASSWORD>. Generate one: openssl rand -base64 24
create schema if not exists excel_to_ai;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lp_excel_to_ai') then
    create role lp_excel_to_ai login password '<STRONG_PASSWORD>' noinherit;
  end if;
end$$;
```

### Step 2 — Apply per-role safety defaults

These are set once and apply to every connection by this role.

```sql
-- Kill any query that runs longer than 5s
alter role lp_excel_to_ai set statement_timeout = '5s';

-- Kill idle transactions after 30s (prevents leaked connections)
alter role lp_excel_to_ai set idle_in_transaction_session_timeout = '30s';

-- Default schema = this app's schema (no need to prefix in queries)
alter role lp_excel_to_ai set search_path = excel_to_ai;

-- Hard cap on concurrent connections from this app
-- (Total project connection pool is ~500 on Pro tier; leave headroom for other apps)
alter role lp_excel_to_ai connection limit 20;
```

### Step 3 — Grant access to own schema, revoke everything else

```sql
-- Grant access to own schema
grant usage, create on schema excel_to_ai to lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant all on tables to lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant all on sequences to lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant execute on functions to lp_excel_to_ai;

-- Defense in depth: revoke from other schemas (mostly redundant since Postgres denies by default,
-- but explicit revokes protect against future GRANT mistakes by superusers)
revoke all on schema public  from lp_excel_to_ai;
revoke all on schema auth    from lp_excel_to_ai;
revoke all on schema storage from lp_excel_to_ai;
revoke all privileges on all tables in schema public  from lp_excel_to_ai;
revoke all privileges on all tables in schema auth    from lp_excel_to_ai;
revoke all privileges on all tables in schema storage from lp_excel_to_ai;
```

### Step 4 — Create tables and transfer ownership

```sql
create table excel_to_ai.registrations (
  id text primary key,
  full_name text not null,
  -- ... other columns
  created_at timestamptz not null default now()
);

-- IMPORTANT: transfer ownership so the LP role can read/write without
-- being blocked by RLS policies it didn't create.
alter table excel_to_ai.registrations owner to lp_excel_to_ai;
```

### Step 5 — Enable RLS as defense in depth

Even if the role isolation does its job, enable RLS so a leaked Supabase `anon` or `service_role` key can't read this app's data through the REST API.

```sql
alter table excel_to_ai.registrations enable row level security;
-- Owner (lp_excel_to_ai) bypasses RLS automatically.
-- All other roles (anon, authenticated, service_role) are blocked by default — no policies = no access.

-- Explicit exception: allow anonymous reads if the app needs it (e.g., public FAQ)
create policy "anon read faqs"
  on excel_to_ai.faqs
  for select
  to anon
  using (true);
```

### Step 6 — Expose the schema to the Supabase API (Dashboard step)

This cannot be done via SQL. In the Supabase dashboard:

**Settings → API → Exposed schemas → Add `excel_to_ai`**

This is only needed if the app uses the Supabase JS client. If the app connects via direct Postgres URL (recommended for backend apps), skip this step.

---

## Connecting Each App

There are two ways to connect, and the choice has security implications.

### Option A — Direct Postgres connection with the dedicated role ⭐ (recommended for backends)

```env
EXCEL_TO_AI_DB_URL=postgres://lp_excel_to_ai.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Use this for any server-side code (Next.js API routes, Express, Python backends, edge functions). Get the URL template from Supabase Dashboard → Settings → Database → Connection string → **Session pooler (port 6543)**, then swap in the LP role and its password.

**Connection example (Node.js with `pg`):**

```ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.EXCEL_TO_AI_DB_URL,
  max: 10, // never exceed the role's connection limit
});

const { rows } = await pool.query('select * from registrations limit 10');
// search_path is already set to excel_to_ai for this role
```

**Why this is more secure:**
- The connection string is scoped to one role with restricted permissions
- If this app's keys leak, the blast radius is *only* this schema
- RLS still applies to other roles using the project's anon/service_role keys

### Option B — Supabase JS client with project-shared keys

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'excel_to_ai' } }
);

const { data } = await supabase.from('registrations').select('*').limit(10);
```

**Trade-offs:**
- Easier to set up (no Postgres driver needed)
- But: if your `service_role` key leaks, an attacker can access **every schema** in the project (the key bypasses RLS and is not schema-scoped)
- Acceptable for browser-side code using only `anon` + RLS

**Rule of thumb:** Use Option A for server-side code. Use Option B only when you specifically need Supabase's Realtime, Auth, or Storage features.

---

## Safety Guarantees — What Each Mitigation Protects

This table maps risks to the specific setup step that protects against them.

| Risk scenario | Mitigation | Where it's set up |
|---|---|---|
| App A drops a table from App B | Schema isolation + revoke on other schemas | Steps 1, 3 |
| App A reads PII from App B | Role isolation + RLS | Steps 1, 5 |
| App A's bug runs `select * from huge_table` and times out the DB | `statement_timeout = 5s` | Step 2 |
| App A leaks an idle transaction holding a row lock | `idle_in_transaction_session_timeout = 30s` | Step 2 |
| App A under traffic spike eats all 500 connections | `connection limit 20` | Step 2 |
| Junior dev forgets to write `where user_id = ?` | RLS policy enforces it | Step 5 |
| App A's leaked anon key | RLS blocks all non-owner reads except whitelisted ones | Step 5 |
| App A's leaked `EXCEL_TO_AI_DB_URL` | Permissions limit damage to App A's schema only | Step 3 |
| Need to remove App A entirely | `DROP SCHEMA excel_to_ai CASCADE` | n/a — atomic operation |

### What is NOT protected and how to handle it

| Risk | Why mitigations don't help | Handle it via |
|---|---|---|
| Project-level CPU/RAM contention | Postgres resources are shared at the project level | Monitor; upgrade plan if needed |
| Storage quota exhaustion | Storage is project-wide | Per-bucket size limits; separate storage provider if needed |
| Auth users colliding between apps | `auth.users` is project-shared | Don't use Supabase Auth across multiple apps, OR partition by JWT `app_metadata` claim |
| Postgres extensions installed for one app break another | Extensions are project-wide | Audit extensions; coordinate before installing |
| API request quota (PostgREST request rate) | Project-wide | Caching at app level; rate limiting at edge |

---

## Operational Practices

### Migrations

- **Each app keeps its migrations in its own repo.** Don't put App A's migrations in App B's repo or vice versa.
- **Migrations only touch the app's own schema.** Never `alter table public.something` from App A's migration.
- **Use a migrations tool that supports schema scoping** (Drizzle, Knex, Sqitch all do; Prisma is more awkward — see below).
- **Test migrations against a clone first.** Run them in a staging schema (`excel_to_ai_staging`) and verify nothing in `public` is touched.

### Backups

- Supabase Pro includes daily backups at the **project level**. Restoring overwrites everything.
- For per-schema backups, run nightly logical dumps:
  ```bash
  pg_dump --schema=excel_to_ai --no-owner --no-acl \
    "$EXCEL_TO_AI_DB_URL" > excel_to_ai_$(date +%Y%m%d).sql
  ```
- Store these in S3 or another off-site location. They let you restore one app without touching others.

### Monitoring

For each app:
- Track active connection count via `select count(*) from pg_stat_activity where usename = 'lp_excel_to_ai'`
- Track slow queries via `pg_stat_statements` (enabled by default on Supabase)
- Alert when the connection count exceeds 80% of the role's `connection limit`
- Alert when a query is killed by `statement_timeout` (look in `postgres_logs`)

A simple query for ops dashboards:

```sql
select
  usename as role,
  count(*) as active_conns,
  count(*) filter (where state = 'idle in transaction') as idle_in_tx
from pg_stat_activity
group by usename
order by active_conns desc;
```

### Naming conventions

| Resource | Convention | Example |
|---|---|---|
| Schemas | snake_case, app short name | `excel_to_ai`, `main_app`, `internal_tools` |
| Roles | `lp_<schema>` (or `app_<schema>`) | `lp_excel_to_ai` |
| Buckets | `<schema>-<purpose>` | `excel-to-ai-uploads` |
| Env vars | `<APP>_DB_URL` | `EXCEL_TO_AI_DB_URL` |
| Migration table | `<schema>.schema_migrations` | `excel_to_ai.schema_migrations` |

---

## Plan Limits & Monitoring

Supabase plan limits apply at the **project level**, not per schema. Know them before stacking apps.

| Limit | Free | Pro | What to watch |
|---|---|---|---|
| Database size | 500 MB | 8 GB included, $0.125/GB after | Track via dashboard. Apps with large data should consider separate projects. |
| Bandwidth (egress) | 5 GB/mo | 250 GB included | Each app's API traffic adds up. CDN caching helps. |
| Active connections | 60 | 500 | Sum of all `connection limit` settings should not exceed 80% of this. |
| Daily backups retention | 7 days | 7 days | Project-level. Use per-schema `pg_dump` for app-specific retention. |
| Auth MAUs | 50,000 | 100,000 included | Project-wide. Stacking apps with shared auth doubles your effective MAU. |
| Storage | 1 GB | 100 GB included | Bucket-level quotas can subdivide. |

**Rule of thumb:** if combined usage across apps consistently exceeds 60% of any limit, plan for migration to separate projects before you hit 80%.

---

## Disaster Recovery & Rollback

### The kill switch (atomic, schema-scoped)

```sql
begin;
  drop schema excel_to_ai cascade;
  drop role if exists lp_excel_to_ai;
commit;
```

**This is safe because:**
- `cascade` only follows references inside the schema
- It cannot drop tables outside the schema (Postgres will error first)
- The transaction makes it all-or-nothing — if anything fails, nothing is dropped
- Other schemas (`public`, other apps') are physically separate objects

### How to verify the kill switch is safe before relying on it

Before going live with an app, **test the rollback in your existing project**:

```sql
-- Create a clone of the schema for testing
create schema excel_to_ai_test;
-- ... copy a few test tables ...

-- Pretend it broke
begin;
  drop schema excel_to_ai_test cascade;
commit;

-- Confirm your live app's tables are untouched
select count(*) from public.<live_table>;  -- should still work fine
```

If that succeeds cleanly, your real schema can be dropped the same way with the same confidence.

### Restoring a single app from backup

If you have per-schema `pg_dump` files (see [Backups](#backups)):

```bash
# Drop the broken schema
psql "$EXCEL_TO_AI_DB_URL" -c "drop schema excel_to_ai cascade;"

# Recreate and restore
psql "$DB_ADMIN_URL" -c "create schema excel_to_ai;"
psql "$EXCEL_TO_AI_DB_URL" < excel_to_ai_20260518.sql
```

This restores **only** App A. Other apps continue running uninterrupted.

### What if the whole project's backup is restored?

Project-level backup restore brings back **every schema** to that point in time. This means restoring App A's lost data also rolls back App B's recent changes. To avoid this:

- Always have per-schema `pg_dump` backups in addition to project backups
- For critical apps, set up logical replication to a separate database

---

## Anti-Patterns to Avoid

These will hurt you in production. Avoid even if they seem convenient in dev.

### ❌ Cross-schema foreign keys between apps

```sql
-- DON'T do this
create table excel_to_ai.orders (
  customer_id uuid references main_app.users(id)  -- coupling apps!
);
```

If App A references App B's table via a foreign key:
- Dropping App B's schema fails (the FK blocks it)
- Migrations on App B can break App A
- The two apps are no longer independent

Instead: store the foreign key as a plain `uuid` or `text` column with no constraint, and document the implicit reference.

### ❌ Shared tables in `public`

```sql
-- DON'T do this
create table public.shared_users (...);  -- which app owns this?
```

Anything in `public` is unowned and unprotected. Every app's role would need access, defeating isolation. If two apps truly need to share data, create a dedicated `shared` schema with explicit grants, but treat it as a third "app" with its own role and ownership.

### ❌ Using the same role across multiple apps

```sql
-- DON'T do this
grant usage on schema excel_to_ai to lp_main_app;
grant usage on schema main_app    to lp_main_app;
```

Roles should be 1:1 with apps. Sharing a role means a leaked key compromises multiple apps at once.

### ❌ Forgetting to set table ownership

If you create a table as `postgres` and forget to `alter table ... owner to lp_<app>`, RLS will block the LP role from accessing its own data. The fix is one line per table, but easy to miss.

### ❌ Storing secrets in `auth.users` raw_user_meta_data

`auth.users` is shared. Any app using Supabase Auth can read every user's metadata. Don't put per-app secrets there.

### ❌ Disabling RLS "just for now"

`alter table ... disable row level security;` is a one-way door. Always assume the worst about leaked anon keys.

---

## Pre-Flight Checklist

Before pointing a new app at an existing Supabase project that hosts other live apps, confirm:

- [ ] Schema is named, follows the project's naming convention
- [ ] Dedicated role is created with a strong password (24+ chars, randomly generated)
- [ ] Role has `statement_timeout`, `idle_in_transaction_session_timeout`, `search_path`, and `connection limit` set
- [ ] Role has access to its own schema (grants + default privileges)
- [ ] Role has explicit revokes on `public`, `auth`, `storage` schemas
- [ ] All tables in the new schema have ownership transferred to the new role
- [ ] RLS is enabled on all tables, with explicit policies only for `anon`/`authenticated` reads that are genuinely needed
- [ ] Verified rollback: dropped a test schema in the same project and confirmed live tables untouched
- [ ] Connection string uses the **pooler** URL (port 6543) not direct (5432)
- [ ] App's `max` pool size in code is ≤ role's `connection limit`
- [ ] Per-schema `pg_dump` backup is scheduled
- [ ] Monitoring tracks: active connections per role, query timeouts, RLS denials
- [ ] Documentation updated: connection string format, who owns this schema, where the migrations live

---

## When to Stop and Use Separate Projects

Schema isolation handles most cases, but split into separate Supabase projects when:

| Trigger | Why |
|---|---|
| **Combined DB size > 60% of plan limit** | One app's growth will starve the others |
| **Combined active connections > 60% of plan limit** | Traffic spike on one app will fail others |
| **Apps have different compliance domains** (e.g., one handles HIPAA data, one doesn't) | Audit and access controls don't mix |
| **Different regions needed** (latency or data residency) | Supabase projects are single-region |
| **Different teams with different access permissions** | Dashboard access is project-level, can't be schema-scoped |
| **One app needs Postgres extensions another forbids** | Extensions are project-wide |
| **One app's expected outage rate is much higher** (e.g., experiments) | Don't put production at the mercy of experimental code |
| **Backup retention needs differ significantly** | Project backups are uniform |

**Cost of splitting:** ~$25/mo per additional Pro project. Compare to the cost of an outage on the live app caused by an experimental new one, and the math is usually obvious.

---

## Appendix: Full Setup SQL Template

Copy this template, replace `<APP_NAME>` (snake_case) and `<STRONG_PASSWORD>`, and run in Supabase SQL Editor.

```sql
-- ============================================================================
-- Multi-app Supabase setup — schema + role isolation template
-- Replace <APP_NAME> and <STRONG_PASSWORD> below.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Schema
create schema if not exists <APP_NAME>;

-- 2. Dedicated role with safety defaults
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lp_<APP_NAME>') then
    create role lp_<APP_NAME> login password '<STRONG_PASSWORD>' noinherit;
  end if;
end$$;

alter role lp_<APP_NAME> set statement_timeout = '5s';
alter role lp_<APP_NAME> set idle_in_transaction_session_timeout = '30s';
alter role lp_<APP_NAME> set search_path = <APP_NAME>;
alter role lp_<APP_NAME> connection limit 20;

-- 3. Grants on own schema
grant usage, create on schema <APP_NAME> to lp_<APP_NAME>;
alter default privileges in schema <APP_NAME> grant all on tables    to lp_<APP_NAME>;
alter default privileges in schema <APP_NAME> grant all on sequences to lp_<APP_NAME>;
alter default privileges in schema <APP_NAME> grant execute on functions to lp_<APP_NAME>;

-- 4. Revoke on other schemas (defense in depth)
revoke all on schema public  from lp_<APP_NAME>;
revoke all on schema auth    from lp_<APP_NAME>;
revoke all on schema storage from lp_<APP_NAME>;
revoke all privileges on all tables in schema public  from lp_<APP_NAME>;
revoke all privileges on all tables in schema auth    from lp_<APP_NAME>;
revoke all privileges on all tables in schema storage from lp_<APP_NAME>;

-- 5. Your tables here — example:
-- create table <APP_NAME>.example (...);
-- alter table <APP_NAME>.example owner to lp_<APP_NAME>;
-- alter table <APP_NAME>.example enable row level security;

-- 6. Dashboard step (cannot be SQL):
--    Settings → API → Exposed schemas → add '<APP_NAME>'

-- ============================================================================
-- 🚨 KILL SWITCH 🚨
-- begin;
--   drop schema <APP_NAME> cascade;
--   drop role if exists lp_<APP_NAME>;
-- commit;
-- ============================================================================
```

---

## Further Reading

- [Supabase Docs — Database Roles](https://supabase.com/docs/guides/database/postgres/roles)
- [PostgreSQL Docs — Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [PostgreSQL Docs — Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Docs — Connecting to your database](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Docs — Pricing & Limits](https://supabase.com/pricing)
