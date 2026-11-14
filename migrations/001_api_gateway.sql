-- ============================================================
-- MoriSafe 001: route everything through the API server
-- Run in the Supabase SQL editor AFTER 000_existing_schema.sql.
-- Safe to re-run. Never deletes report rows.
--
-- What changes:
--   * reports gains custom_category, severity, town, observed_at,
--     reviewed_by/at, updated_at, reporter_hash, client_ref
--   * statuses: pending | approved | rejected | resolved | archived
--   * photo metadata moves to report_photos (path + MIME + size), backfilled
--   * report_audit (admin actions) and devices (notification preferences)
--   * BREAKING for the old prototypes: anonymous INSERT/SELECT on reports
--     and anonymous upload/read on the photo bucket are removed. The bucket
--     becomes private; the API issues short-lived signed URLs instead.
-- ============================================================
begin;

-- 1. New report columns -------------------------------------------------
alter table public.reports
  add column if not exists custom_category text,
  add column if not exists severity        text,
  add column if not exists town            text,
  add column if not exists observed_at     timestamptz,
  add column if not exists reviewed_by     uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at     timestamptz,
  add column if not exists updated_at      timestamptz not null default now(),
  add column if not exists reporter_hash   text,
  add column if not exists client_ref      uuid;

-- 2. Statuses ------------------------------------------------------------
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'approved', 'rejected', 'resolved', 'archived'));

-- 3. Categories: the prototype stored "Other" text directly in category --
update public.reports
   set custom_category = nullif(left(btrim(category), 60), ''),
       category        = 'Other'
 where category not in ('Falling debris', 'Accident', 'Fire', 'Flooding', 'Other');
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check
  check (category in ('Falling debris', 'Accident', 'Fire', 'Flooding', 'Other'));
alter table public.reports drop constraint if exists reports_custom_category_check;
alter table public.reports add constraint reports_custom_category_check
  check (custom_category is null or char_length(custom_category) between 1 and 60);

-- 4. Severity drives the Urgent / Warning / Information notification options
alter table public.reports alter column severity set default 'info';
update public.reports set severity = case
    when category in ('Fire', 'Accident')           then 'urgent'
    when category in ('Flooding', 'Falling debris') then 'warning'
    else 'info' end
 where severity is null;
alter table public.reports alter column severity set not null;
alter table public.reports drop constraint if exists reports_severity_check;
alter table public.reports add constraint reports_severity_check
  check (severity in ('urgent', 'warning', 'info'));

-- 5. Timestamps -----------------------------------------------------------
update public.reports set approved_at = created_at
 where status = 'approved' and approved_at is null;

-- observed_time was 'HH:MM' Mauritius time: take the latest such moment at or
-- before the submission time (23:59 sent at 00:30 means the previous day).
update public.reports r set observed_at = (
    case when ((r.created_at at time zone 'Indian/Mauritius')::date + r.observed_time::time)
              <= (r.created_at at time zone 'Indian/Mauritius')
         then ((r.created_at at time zone 'Indian/Mauritius')::date + r.observed_time::time)
         else ((r.created_at at time zone 'Indian/Mauritius')::date - 1 + r.observed_time::time)
    end) at time zone 'Indian/Mauritius'
 where r.observed_at is null
   and r.observed_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists reports_touch_updated_at on public.reports;
create trigger reports_touch_updated_at before update on public.reports
  for each row execute function public.touch_updated_at();

-- 6. Photo metadata (objects are referenced by storage path, never by URL)
create table if not exists public.report_photos (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null default 'image/jpeg',
  size_bytes   integer,
  width        integer,
  height       integer,
  sha256       text,
  created_at   timestamptz not null default now()
);
create index if not exists report_photos_report_id_idx on public.report_photos (report_id);

-- Backfill photos the prototype uploaded (public URLs stored in image_url).
-- image_url itself is left untouched but is no longer used by the API.
insert into public.report_photos (report_id, storage_path, created_at)
select r.id,
       substring(r.image_url from '/storage/v1/object/public/report-photos/([^?#]+)'),
       r.created_at
  from public.reports r
 where r.image_url ~ '/storage/v1/object/public/report-photos/[^?#]+'
   and not exists (select 1 from public.report_photos p where p.report_id = r.id)
on conflict (storage_path) do nothing;

-- 7. Audit log. No foreign key, so history survives report deletion. ------
create table if not exists public.report_audit (
  id          bigint generated always as identity primary key,
  report_id   uuid,
  admin_id    uuid,
  admin_email text,
  action      text not null,
  old_status  text,
  new_status  text,
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists report_audit_report_idx on public.report_audit (report_id, created_at desc);

-- 8. Anonymous devices for notifications --------------------------------
--    device_hash is an HMAC of a random id the app generates; location is
--    rounded to ~1 km and only stored when "notify me within 10 km" is on.
create table if not exists public.devices (
  device_hash    text primary key,
  push_token     text unique,
  platform       text check (platform in ('android', 'ios', 'web')),
  notify_urgent  boolean not null default true,
  notify_warning boolean not null default true,
  notify_info    boolean not null default false,
  only_nearby    boolean not null default false,
  approx_lat     numeric(5, 2),
  approx_lng     numeric(5, 2),
  language       text,
  updated_at     timestamptz not null default now()
);

-- 9. Indexes --------------------------------------------------------------
create unique index if not exists reports_client_ref_key on public.reports (client_ref);
create index if not exists reports_public_idx   on public.reports (status, approved_at desc);
create index if not exists reports_created_idx  on public.reports (created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_hash, created_at desc);

-- 10. Row level security --------------------------------------------------
-- The API server uses the service role (bypasses RLS) and is the only writer
-- and the only public reader. New tables get RLS with no policies at all.
alter table public.report_photos enable row level security;
alter table public.report_audit  enable row level security;
alter table public.devices       enable row level security;

drop policy if exists "public submits"        on public.reports;
drop policy if exists "public reads approved" on public.reports;
-- Kept: "admins read all", "admins update", "admins delete" (Supabase dashboard use).

-- 11. Private photo bucket -----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 8388608, array['image/jpeg'])
on conflict (id) do update
   set public = false,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "anyone uploads report photos" on storage.objects;
drop policy if exists "public reads report photos"   on storage.objects;
-- Kept: "admins delete report photos".

commit;

-- Ask PostgREST to pick up the new table and columns immediately.
notify pgrst, 'reload schema';
