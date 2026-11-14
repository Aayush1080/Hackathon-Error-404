-- ============================================================
-- LOCAL TEST STACK ONLY. Never run this against Supabase.
-- Recreates the parts of a Supabase project that MoriSafe touches, so the
-- real migrations can be applied and tested with PostgreSQL + PostgREST:
--   roles anon / authenticated / service_role (BYPASSRLS),
--   Supabase's default grants on schema public,
--   auth.users + auth.uid(), storage.buckets + storage.objects.
-- ============================================================
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit password 'authenticator-local-only'; end if;
end $$;
grant anon, authenticated, service_role to authenticator;

-- Supabase grants everything in public to the API roles and relies on RLS.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema if not exists auth;
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz default now(),
  created_at         timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema if not exists storage;
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now()
);
create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
