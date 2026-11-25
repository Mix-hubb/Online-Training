-- Supabase (2026-11-25): Supabase's Data API (PostgREST) exposes the "public" schema to its
-- "anon" and "authenticated" roles. This app never uses it (only the API server reads the database),
-- so nothing may be reachable that way:
--  1. Row level security ON for every table, with no policies: other roles see no rows.
--     The app connects as the table owner (postgres), which RLS does not apply to.
--  2. On Supabase only (the roles exist): take away their rights on current AND future tables,
--     so tables added by later migrations are closed too.
-- On local Docker / Railway Postgres the roles do not exist; step 2 is skipped and step 1 changes nothing for the app.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon, authenticated', current_schema());
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon, authenticated', current_schema());
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM anon, authenticated', current_schema());
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM anon, authenticated', current_schema());
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM anon, authenticated', current_schema());
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM anon, authenticated', current_schema());
  END IF;
END $$;
