-- ============================================================
-- Insurance Mavericks — Member Directory Database
-- Run this once in the Supabase SQL Editor (or via `supabase db push`)
-- against a fresh project. See ../../SUPABASE_SETUP.md for the full
-- setup walkthrough.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ────────────────────────────────────────────────────────────
-- Reference / taxonomy tables
-- Mirrors the STATES / LOBS / SPECS constants used on the client.
-- Kept as real tables (not just client-side arrays) so new values
-- can be added from the dashboard and so home_state can be a real FK.
-- ────────────────────────────────────────────────────────────
create table if not exists public.states (
  code text primary key,
  name text not null
);

create table if not exists public.lines_of_business (
  name text primary key
);

create table if not exists public.specializations (
  name text primary key
);

insert into public.states (code, name) values
  ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),('CA','California'),
  ('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),('FL','Florida'),('GA','Georgia'),
  ('HI','Hawaii'),('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
  ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),('MD','Maryland'),
  ('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),('MS','Mississippi'),('MO','Missouri'),
  ('MT','Montana'),('NE','Nebraska'),('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),
  ('NM','New Mexico'),('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
  ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),('SC','South Carolina'),
  ('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),('UT','Utah'),('VT','Vermont'),
  ('VA','Virginia'),('WA','Washington'),('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming'),
  ('DC','District of Columbia')
on conflict (code) do nothing;

insert into public.lines_of_business (name) values
  ('Commercial P&C'),('Workers Comp'),('General Liability'),('Commercial Auto'),('BOP'),
  ('Cyber'),('E&O / D&O'),('Surety & Bonds'),('Personal Auto'),('Homeowners'),
  ('Renters'),('Umbrella'),('Life Insurance'),('Disability'),('Group Benefits'),
  ('Health'),('Medicare'),('Annuities')
on conflict (name) do nothing;

insert into public.specializations (name) values
  ('Contractors'),('Restaurants'),('Trucking'),('Healthcare'),('Real Estate'),
  ('Construction'),('Retail'),('Hospitality'),('Technology'),('Nonprofits'),
  ('Agriculture'),('Manufacturing'),('Professional Services'),('High Value Homes'),
  ('High Net Worth'),('Small Business'),('Veteran-Owned Biz'),('Franchise')
on conflict (name) do nothing;

alter table public.states enable row level security;
alter table public.lines_of_business enable row level security;
alter table public.specializations enable row level security;

create policy "Anyone can read states" on public.states for select using (true);
create policy "Anyone can read lines_of_business" on public.lines_of_business for select using (true);
create policy "Anyone can read specializations" on public.specializations for select using (true);

-- ────────────────────────────────────────────────────────────
-- Member profiles — one row per signed-up member, one per user
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  agency        text not null default '',
  home_state    text not null references public.states(code),
  states        text[] not null default '{}',
  lobs          text[] not null default '{}',
  specs         text[] not null default '{}',
  bio           text not null default '',
  facebook_url  text not null default '',
  photo_url     text,
  joined_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_states_not_empty check (array_length(states, 1) > 0),
  constraint profiles_lobs_not_empty   check (array_length(lobs, 1) > 0)
);

create index if not exists profiles_states_gin on public.profiles using gin (states);
create index if not exists profiles_lobs_gin   on public.profiles using gin (lobs);
create index if not exists profiles_name_trgm  on public.profiles
  using gin ((first_name || ' ' || last_name || ' ' || agency) gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Directory is members-only: any authenticated (signed-in) user can browse it.
create policy "Authenticated members can read the directory"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own profile"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- Database functions (RPC) backing the site's capabilities
-- ────────────────────────────────────────────────────────────

-- Public teaser stats shown on the logged-out welcome page, and the
-- stats bar inside the directory. Runs as security definer so it can
-- aggregate across all profiles regardless of the caller's RLS grant.
create or replace function public.get_directory_stats()
returns table(members_count int, states_count int, lobs_count int, specs_count int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from profiles)::int,
    (select count(distinct s) from profiles, unnest(states) s)::int,
    (select count(distinct l) from profiles, unnest(lobs) l)::int,
    (select count(distinct sp) from profiles, unnest(specs) sp)::int;
$$;
grant execute on function public.get_directory_stats() to anon, authenticated;

-- Server-side search/filter for the directory grid (name/agency text
-- search + exact state/LOB match), so filtering isn't limited to
-- whatever page of members the client happens to have cached.
create or replace function public.search_directory(q text default '', state_filter text default '', lob_filter text default '')
returns setof public.profiles
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from profiles
  where (q = '' or (first_name || ' ' || last_name || ' ' || agency) ilike '%' || q || '%')
    and (state_filter = '' or state_filter = any(states))
    and (lob_filter = '' or lob_filter = any(lobs))
  order by joined_at desc;
$$;
grant execute on function public.search_directory(text, text, text) to authenticated;

-- Create-or-update the caller's own profile in one round trip. Table
-- constraints (states/lobs non-empty, home_state FK) still apply.
create or replace function public.upsert_my_profile(
  p_first_name text,
  p_last_name text,
  p_agency text,
  p_home_state text,
  p_states text[],
  p_lobs text[],
  p_specs text[],
  p_bio text,
  p_facebook_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into profiles (user_id, first_name, last_name, agency, home_state, states, lobs, specs, bio, facebook_url)
  values (
    auth.uid(), p_first_name, p_last_name, coalesce(p_agency, ''), p_home_state,
    p_states, p_lobs, coalesce(p_specs, '{}'), coalesce(p_bio, ''), coalesce(p_facebook_url, '')
  )
  on conflict (user_id) do update set
    first_name   = excluded.first_name,
    last_name    = excluded.last_name,
    agency       = excluded.agency,
    home_state   = excluded.home_state,
    states       = excluded.states,
    lobs         = excluded.lobs,
    specs        = excluded.specs,
    bio          = excluded.bio,
    facebook_url = excluded.facebook_url
  returning * into result;

  return result;
end;
$$;
grant execute on function public.upsert_my_profile(text, text, text, text, text[], text[], text[], text, text) to authenticated;

-- Update just the photo URL after a Storage upload.
create or replace function public.set_my_photo(p_photo_url text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update profiles set photo_url = p_photo_url
  where user_id = auth.uid()
  returning * into result;

  if result is null then
    raise exception 'No profile to attach a photo to yet';
  end if;

  return result;
end;
$$;
grant execute on function public.set_my_photo(text) to authenticated;

-- Removes the caller's directory listing (keeps their auth account —
-- full account deletion requires the service role and is documented
-- in SUPABASE_SETUP.md as an Edge Function / admin API call).
create or replace function public.delete_my_profile()
returns void
language sql
security definer
set search_path = public
as $$
  delete from profiles where user_id = auth.uid();
$$;
grant execute on function public.delete_my_profile() to authenticated;

-- ────────────────────────────────────────────────────────────
-- Storage — profile photos
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
