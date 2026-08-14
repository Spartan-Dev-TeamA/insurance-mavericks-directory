-- ============================================================
-- Insurance Mavericks — incomplete-profile onboarding nudges
-- Run after 0010_enforce_tier_abilities.sql.
-- ============================================================

-- Service-role-only state for the capped onboarding reminder sequence.
-- RLS is intentionally enabled with no policies, and browser roles have no
-- table privileges, so neither anon nor authenticated callers can access it.
create table if not exists public.onboarding_nudges (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nudge_count int not null default 0 check (nudge_count between 0 and 2),
  nudged_at   timestamptz,
  opted_out   boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.onboarding_nudges enable row level security;
revoke all on public.onboarding_nudges from anon, authenticated;

-- A profiles row is the completion marker for onboarding. The original
-- array_length(..., 1) CHECKs on profiles are inert for empty arrays because
-- array_length('{}', 1) is NULL, so enforce completeness in the write RPC.
create or replace function public.upsert_my_profile(
  p_first_name text, p_last_name text, p_agency text, p_home_state text,
  p_states text[], p_lobs text[], p_specs text[], p_bio text,
  p_facebook_url text
)
returns table (
  id uuid, user_id uuid, first_name text, last_name text, agency text,
  home_state text, states text[], lobs text[], specs text[], bio text,
  facebook_url text, photo_url text, joined_at timestamptz,
  updated_at timestamptz, tier text
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  p_first_name := trim(coalesce(p_first_name, ''));
  p_last_name := trim(coalesce(p_last_name, ''));
  p_agency := trim(coalesce(p_agency, ''));
  p_home_state := trim(coalesce(p_home_state, ''));
  p_bio := trim(coalesce(p_bio, ''));
  p_facebook_url := trim(coalesce(p_facebook_url, ''));

  if p_first_name = '' then raise exception 'First name is required' using errcode = '22023'; end if;
  if p_last_name = '' then raise exception 'Last name is required' using errcode = '22023'; end if;
  if p_home_state = '' or not exists (
    select 1 from public.states s where s.code = p_home_state
  ) then
    raise exception 'Home state is required and must be valid' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_states), 0) = 0 then
    raise exception 'At least one licensed state is required' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_lobs), 0) = 0 then
    raise exception 'At least one line of business is required' using errcode = '22023';
  end if;

  insert into public.profiles (
    user_id, first_name, last_name, agency, home_state, states, lobs,
    specs, bio, facebook_url
  ) values (
    auth.uid(), p_first_name, p_last_name, p_agency,
    p_home_state, p_states, p_lobs, coalesce(p_specs, '{}'),
    p_bio, p_facebook_url
  )
  on conflict (user_id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name,
    agency = excluded.agency, home_state = excluded.home_state,
    states = excluded.states, lobs = excluded.lobs, specs = excluded.specs,
    bio = excluded.bio, facebook_url = excluded.facebook_url;

  return query
  select p.id, p.user_id, p.first_name, p.last_name, p.agency, p.home_state,
    p.states, p.lobs, p.specs, p.bio, p.facebook_url, p.photo_url,
    p.joined_at, p.updated_at, p.tier
  from public.profiles p where p.user_id = auth.uid();
end;
$$;

notify pgrst, 'reload schema';
