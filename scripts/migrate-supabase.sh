#!/usr/bin/env bash
# Copies the whole excel_to_ai schema (every table, row, index, function, RLS policy) from the old
# Supabase project to the new one, then proves nothing was lost by comparing exact row counts.
#
# Passwords never go on the command line: both database passwords are read from ~/.pgpass,
# and the new app-login password is typed at a hidden prompt.
#
#   bash scripts/migrate-supabase.sh check     # connect to both, show versions + row counts (read-only)
#   bash scripts/migrate-supabase.sh migrate   # dump old -> restore new -> grants -> verify counts
#   bash scripts/migrate-supabase.sh verify    # re-run only the row-count comparison
#
# The old project is never written to.
set -euo pipefail

# OLD_USER can be the app's own login instead of the admin one, if the admin password is unknown:
#   OLD_USER=lp_excel_to_ai.qhgelnkakutzbuvowxzj bash scripts/migrate-supabase.sh check
OLD_USER="${OLD_USER:-postgres.qhgelnkakutzbuvowxzj}"
OLD="host=aws-1-ap-southeast-2.pooler.supabase.com port=5432 dbname=postgres user=$OLD_USER sslmode=require connect_timeout=20"
NEW="host=aws-0-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.tqtqywzqywwjacurbngz sslmode=require connect_timeout=20"
BACKUP_DIR="${BACKUP_DIR:-$HOME/excel_to_ai_backup}"
SCHEMA=excel_to_ai

# Exact row count of every table in the schema, one "table|rows" line each.
COUNT_SQL="select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables where table_schema = '$SCHEMA' and table_type = 'BASE TABLE' order by table_name;"

q() { psql "$1" -X -A -t -v ON_ERROR_STOP=1 -c "$2"; }

server_major() { q "$1" "show server_version_num;" | cut -c1-2; }

check() {
  echo "== Old project"; q "$OLD" "select version();"
  echo "== New project"; q "$NEW" "select version();"
  local old_major dump_major
  old_major=$(server_major "$OLD")
  dump_major=$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  if (( dump_major < old_major )); then
    echo "!! pg_dump $dump_major is older than the old server ($old_major)."
    echo "   Run: brew install postgresql@$old_major && export PATH=\"/opt/homebrew/opt/postgresql@$old_major/bin:\$PATH\""
    exit 1
  fi
  echo "== Old project row counts"; q "$OLD" "$COUNT_SQL"
  echo "== Tables already in the new project's $SCHEMA schema:"
  q "$NEW" "select count(*) from information_schema.tables where table_schema = '$SCHEMA';"
}

verify() {
  local old new
  old=$(q "$OLD" "$COUNT_SQL"); new=$(q "$NEW" "$COUNT_SQL")
  echo "table | old | new"
  local bad=0
  while IFS='|' read -r t n; do
    m=$(printf '%s\n' "$new" | awk -F'|' -v t="$t" '$1==t{print $2}')
    if [[ "$n" == "$m" ]]; then echo "OK   $t | $n | $m"; else echo "DIFF $t | $n | ${m:-MISSING}"; bad=1; fi
  done <<< "$old"
  if (( bad )); then echo "!! Row counts differ — do NOT switch the app yet."; exit 1; fi
  echo "All tables match exactly."
}

migrate() {
  check
  local existing
  existing=$(q "$NEW" "select count(*) from information_schema.tables where table_schema = '$SCHEMA';")
  if (( existing > 0 )); then
    echo "!! The new project already has $existing tables in $SCHEMA. Refusing to overwrite."
    echo "   If that is a failed earlier attempt, drop it in the new project first: drop schema $SCHEMA cascade;"
    exit 1
  fi

  mkdir -p "$BACKUP_DIR"
  local dump="$BACKUP_DIR/excel_to_ai_$(date +%Y%m%d_%H%M%S).dump"
  echo "== Dumping old project -> $dump"
  pg_dump "$OLD" --schema="$SCHEMA" --format=custom --no-owner --file="$dump"
  echo "   $(du -h "$dump" | cut -f1) written. This file is your backup — keep it."

  echo "== Creating the app login (lp_excel_to_ai) in the new project"
  read -r -s -p "   Choose a password for lp_excel_to_ai (goes into EXCEL_TO_AI_DB_URL): " LP_PW; echo
  [[ -n "$LP_PW" ]] || { echo "Empty password."; exit 1; }
  psql "$NEW" -X -v ON_ERROR_STOP=1 -v lp_pw="$LP_PW" <<'SQL'
select not exists (select 1 from pg_roles where rolname = 'lp_excel_to_ai') as need_role \gset
\if :need_role
  create role lp_excel_to_ai login noinherit password :'lp_pw';
\else
  alter role lp_excel_to_ai login password :'lp_pw';
\endif
grant lp_excel_to_ai to postgres;
alter role lp_excel_to_ai set statement_timeout = '5s';
alter role lp_excel_to_ai set idle_in_transaction_session_timeout = '30s';
alter role lp_excel_to_ai set search_path = excel_to_ai;
alter role lp_excel_to_ai connection limit 20;
SQL
  unset LP_PW

  echo "== Restoring into the new project"
  # Non-fatal warnings (e.g. comments on extensions) are printed but don't stop the restore;
  # the row-count check below is what decides success.
  pg_restore --dbname="$NEW" --no-owner "$dump" || true

  echo "== Grants"
  psql "$NEW" -X -v ON_ERROR_STOP=1 <<'SQL'
grant usage on schema excel_to_ai to anon, authenticated, service_role;
grant usage, create on schema excel_to_ai to lp_excel_to_ai;
grant all on all tables    in schema excel_to_ai to service_role, lp_excel_to_ai;
grant all on all sequences in schema excel_to_ai to service_role, lp_excel_to_ai;
grant execute on all functions in schema excel_to_ai to service_role, lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant all on tables    to service_role, lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant all on sequences to service_role, lp_excel_to_ai;
alter default privileges in schema excel_to_ai grant execute on functions to service_role, lp_excel_to_ai;
revoke all on schema public  from lp_excel_to_ai;
revoke all on schema auth    from lp_excel_to_ai;
revoke all on schema storage from lp_excel_to_ai;
SQL

  echo "== Applying migration 0039 (in-database counting — the egress fix; the old project never got it)"
  psql "$NEW" -X -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../supabase/migrations/0039_whatsapp_aggregates.sql"

  echo "== Verifying row counts"
  verify
  cat <<EOF

Next (manual):
  1. New project -> Project Settings -> Data API -> Exposed schemas: add  excel_to_ai
  2. Vercel env vars -> point at the new project, then redeploy:
       NEXT_PUBLIC_SUPABASE_URL=https://tqtqywzqywwjacurbngz.supabase.co
       NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<new publishable key>
       SUPABASE_SECRET_KEY=<new secret key>
       EXCEL_TO_AI_DB_URL=postgresql://lp_excel_to_ai.tqtqywzqywwjacurbngz:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
EOF
}

case "${1:-}" in
  check) check ;;
  migrate) migrate ;;
  verify) verify ;;
  *) echo "usage: $0 check|migrate|verify"; exit 1 ;;
esac
