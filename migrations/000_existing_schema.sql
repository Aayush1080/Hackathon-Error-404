-- Original MoriSafe schema (morisafe-admin/supabase.sql), kept verbatim as the baseline.
-- Already applied to the live project. Apply 001_api_gateway.sql on top of it.
-- ============================================================
-- MoriSafe: full database setup (safe to re-run)
-- ============================================================

-- 1. Reports table
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null,
  description   text,
  latitude      numeric not null,
  longitude     numeric not null,
  location_name text,
  image_url     text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  rejection_reason text,
  approved_at   timestamptz,
  observed_time text
);

-- 2. Admins table (user_id = the admin's login id in auth.users)
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  phone      text,
  location   text,
  role       text not null default 'admin',
  created_at timestamptz not null default now()
);

-- If the table already existed with only user_id, add the new columns
alter table public.admins
  add column if not exists full_name  text,
  add column if not exists email      text,
  add column if not exists phone      text,
  add column if not exists location   text,
  add column if not exists role       text not null default 'admin',
  add column if not exists created_at timestamptz not null default now();

-- Fill in email for any existing admins
update public.admins a
set email = u.email
from auth.users u
where u.id = a.user_id and a.email is null;

alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select to authenticated using (public.is_admin());

-- 3. Row level security on reports
alter table public.reports enable row level security;
drop policy if exists "public reads approved" on public.reports;
drop policy if exists "admins read all"       on public.reports;
drop policy if exists "public submits"        on public.reports;
drop policy if exists "admins update"         on public.reports;
drop policy if exists "admins delete"         on public.reports;
create policy "public reads approved" on public.reports for select using (status = 'approved');
create policy "admins read all"       on public.reports for select to authenticated using (public.is_admin());
create policy "public submits"        on public.reports for insert to anon, authenticated with check (status = 'pending');
create policy "admins update"         on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete"         on public.reports for delete to authenticated using (public.is_admin());

-- 4. Only accept locations inside Mauritius
alter table public.reports drop constraint if exists reports_in_mauritius;
alter table public.reports add constraint reports_in_mauritius
  check (latitude between -20.65 and -19.85 and longitude between 57.18 and 58.1);

-- 5. Photo bucket
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true) on conflict do nothing;
drop policy if exists "anyone uploads report photos" on storage.objects;
drop policy if exists "public reads report photos"   on storage.objects;
drop policy if exists "admins delete report photos"  on storage.objects;
create policy "anyone uploads report photos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'report-photos');
create policy "public reads report photos"   on storage.objects for select using (bucket_id = 'report-photos');
create policy "admins delete report photos"  on storage.objects for delete to authenticated using (bucket_id = 'report-photos' and public.is_admin());