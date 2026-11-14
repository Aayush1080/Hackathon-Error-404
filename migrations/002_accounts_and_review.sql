-- ============================================================
-- MoriSafe 002: citizen accounts (NID sign-in), police reports, duplicate
-- merging, "is it still there?" feedback, translation cache.
-- Run in the Supabase SQL editor AFTER 001_api_gateway.sql. Safe to re-run.
-- Never deletes report rows.
-- ============================================================
begin;

-- 1. Citizen accounts ------------------------------------------------------
--    The NID is never stored in plain text: nid_hash is an HMAC of it (for sign-in
--    lookup) and nid_masked shows only the first and last characters to admins.
--    password_hash is a salted scrypt hash produced by the API server.
create table if not exists public.users (
  id             uuid primary key default gen_random_uuid(),
  nid_hash       text not null unique,
  nid_masked     text not null,
  full_name      text not null check (char_length(full_name) between 2 and 80),
  phone          text,
  password_hash  text not null check (password_hash like 'scrypt$%'),
  role           text not null default 'citizen' check (role in ('citizen', 'police')),
  disabled       boolean not null default false,
  failed_logins  integer not null default 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.users enable row level security;  -- API server only (service role)

-- 2. Reports: author, source, duplicate group -------------------------------
alter table public.reports
  add column if not exists user_id      uuid references public.users(id) on delete set null,
  add column if not exists source       text not null default 'citizen',
  add column if not exists duplicate_of uuid references public.reports(id) on delete set null;
alter table public.reports drop constraint if exists reports_source_check;
alter table public.reports add constraint reports_source_check check (source in ('citizen', 'police'));
create index if not exists reports_duplicate_of_idx on public.reports (duplicate_of);
create index if not exists reports_user_idx on public.reports (user_id, created_at desc);

-- 3. Severity is no longer used (kept, nullable, so old rows are untouched) --
alter table public.reports alter column severity drop not null;
alter table public.reports alter column severity drop default;

-- 4. "Is it still there?" answers from people passing nearby -----------------
create table if not exists public.report_feedback (
  report_id   uuid not null references public.reports(id) on delete cascade,
  voter       text not null,              -- 'u:<user id>' or 'd:<device hash>'
  still_there boolean not null,
  created_at  timestamptz not null default now(),
  primary key (report_id, voter)
);
alter table public.report_feedback enable row level security;

-- 5. Machine-translation cache for report descriptions ------------------------
create table if not exists public.translations (
  key        text primary key,             -- sha256 of target language + source text
  lang       text not null,
  text       text not null,
  created_at timestamptz not null default now()
);
alter table public.translations enable row level security;

-- 6. Notification choices per incident type ----------------------------------
alter table public.devices add column if not exists notify_categories text[];

commit;

notify pgrst, 'reload schema';
