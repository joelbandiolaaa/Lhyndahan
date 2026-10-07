-- Minimal stand-in for what Supabase provides, so migrations can be tested
-- on plain Postgres. NOT for use in a real Supabase project.
-- roles anon / authenticated / service_role are created by run.sh
alter role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select auth.jwt() ->> 'role' $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets, name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;
