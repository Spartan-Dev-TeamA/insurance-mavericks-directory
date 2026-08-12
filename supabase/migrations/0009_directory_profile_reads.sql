-- ============================================================
-- Insurance Mavericks — additive directory/profile read RPCs
-- Run after 0008_expand_lines_of_business.sql.
-- ============================================================

create or replace function public.list_directory()
returns table (
  id uuid, user_id uuid, first_name text, last_name text, agency text,
  home_state text, states text[], lobs text[], specs text[], bio text,
  facebook_url text, photo_url text, joined_at timestamptz,
  updated_at timestamptz, tier text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.user_id, p.first_name, p.last_name, p.agency, p.home_state,
    p.states, p.lobs,
    case when p.tier in ('basic', 'pro') then p.specs else '{}'::text[] end,
    p.bio, p.facebook_url, p.photo_url, p.joined_at, p.updated_at, p.tier
  from public.profiles p
  where auth.uid() is not null
  order by p.joined_at desc;
$$;

create or replace function public.get_my_profile()
returns table (
  id uuid, user_id uuid, first_name text, last_name text, agency text,
  home_state text, states text[], lobs text[], specs text[], bio text,
  facebook_url text, photo_url text, joined_at timestamptz,
  updated_at timestamptz, tier text
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.user_id, p.first_name, p.last_name, p.agency, p.home_state,
    p.states, p.lobs, p.specs, p.bio, p.facebook_url, p.photo_url,
    p.joined_at, p.updated_at, p.tier
  from public.profiles p
  where p.user_id = auth.uid();
$$;

revoke execute on function public.list_directory() from public;
revoke execute on function public.get_my_profile() from public;

grant execute on function public.list_directory() to authenticated;
grant execute on function public.get_my_profile() to authenticated;
