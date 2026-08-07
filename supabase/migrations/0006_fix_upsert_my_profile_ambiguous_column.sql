-- ============================================================
-- Insurance Mavericks — fix upsert_my_profile ambiguous column
-- Run after 0005_state_coverage_stats.sql.
-- ============================================================

-- 0003_harden_tiers_and_messaging.sql's upsert_my_profile() has been
-- unusable since it was deployed: its RETURNS TABLE(..., user_id uuid, ...)
-- declares an output column/variable named user_id, which collides with
-- the bare `on conflict (user_id)` target inside the function body
-- (ON CONFLICT column targets cannot be table-qualified). Every call
-- fails with "column reference \"user_id\" is ambiguous" (42702) before
-- ever reaching the insert — discovered via a live probe against the
-- production database, where a fresh profile creation attempt failed.
-- This has blocked every new member from completing signup since the
-- migration 0003 build. Fix: add the standard PL/pgSQL
-- #variable_conflict use_column directive so bare identifiers resolve to
-- table columns, not routine variables. No other change.
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
  insert into public.profiles (
    user_id, first_name, last_name, agency, home_state, states, lobs,
    specs, bio, facebook_url
  ) values (
    auth.uid(), p_first_name, p_last_name, coalesce(p_agency, ''),
    p_home_state, p_states, p_lobs, coalesce(p_specs, '{}'),
    coalesce(p_bio, ''), coalesce(p_facebook_url, '')
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
