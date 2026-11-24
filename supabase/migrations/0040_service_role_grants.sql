-- 0040_service_role_grants.sql
-- The app's server code talks to Supabase with the SECRET key, i.e. as `service_role`. No earlier
-- migration granted that role anything on excel_to_ai — on the original project the grants were
-- added by hand, so a fresh project (Nov 2026 move) got "permission denied" on 16 of 20 tables.
-- Only service_role is granted; anon/authenticated (the public key) get nothing new.

grant usage on schema excel_to_ai to service_role;
grant all on all tables    in schema excel_to_ai to service_role;
grant all on all sequences in schema excel_to_ai to service_role;
grant execute on all functions in schema excel_to_ai to service_role;

-- Tables/functions created by later migrations (run as postgres) get the same automatically.
alter default privileges for role postgres in schema excel_to_ai grant all on tables    to service_role;
alter default privileges for role postgres in schema excel_to_ai grant all on sequences to service_role;
alter default privileges for role postgres in schema excel_to_ai grant execute on functions to service_role;
