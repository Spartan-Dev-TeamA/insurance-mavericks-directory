-- ============================================================
-- Insurance Mavericks — Tier, profile, and messaging hardening
-- Run after 0001_init.sql and 0002_tiers_and_messaging.sql.
-- ============================================================

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create unique index if not exists profiles_stripe_customer_id_unique
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_id_unique
  on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;

-- Browser roles receive only the safe directory shape. Profile changes must
-- go through the SECURITY DEFINER RPCs below.
revoke select, insert, update, delete on public.profiles from anon, authenticated;
grant select (
  id, user_id, first_name, last_name, agency, home_state, states, lobs,
  specs, bio, facebook_url, photo_url, joined_at, updated_at, tier
) on public.profiles to anon, authenticated;

drop function if exists public.search_directory(text, text, text);
create function public.search_directory(q text default '', state_filter text default '', lob_filter text default '')
returns table (
  id uuid, user_id uuid, first_name text, last_name text, agency text,
  home_state text, states text[], lobs text[], specs text[], bio text,
  facebook_url text, photo_url text, joined_at timestamptz,
  updated_at timestamptz, tier text
)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select p.id, p.user_id, p.first_name, p.last_name, p.agency, p.home_state,
    p.states, p.lobs, p.specs, p.bio, p.facebook_url, p.photo_url,
    p.joined_at, p.updated_at, p.tier
  from public.profiles p
  where (q = '' or (p.first_name || ' ' || p.last_name || ' ' || p.agency) ilike '%' || q || '%')
    and (state_filter = '' or state_filter = any(p.states))
    and (lob_filter = '' or lob_filter = any(p.lobs))
  order by p.joined_at desc;
$$;

drop function if exists public.upsert_my_profile(text, text, text, text, text[], text[], text[], text, text);
create function public.upsert_my_profile(
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

drop function if exists public.set_my_photo(text);
create function public.set_my_photo(p_photo_url text)
returns table (
  id uuid, user_id uuid, first_name text, last_name text, agency text,
  home_state text, states text[], lobs text[], specs text[], bio text,
  facebook_url text, photo_url text, joined_at timestamptz,
  updated_at timestamptz, tier text
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.profiles p set photo_url = p_photo_url where p.user_id = auth.uid();
  if not found then raise exception 'No profile to attach a photo to yet'; end if;
  return query
  select p.id, p.user_id, p.first_name, p.last_name, p.agency, p.home_state,
    p.states, p.lobs, p.specs, p.bio, p.facebook_url, p.photo_url,
    p.joined_at, p.updated_at, p.tier
  from public.profiles p where p.user_id = auth.uid();
end;
$$;

drop function if exists public.set_my_tier(text);
create function public.set_my_tier(p_tier text)
returns table (
  id uuid, user_id uuid, first_name text, last_name text, agency text,
  home_state text, states text[], lobs text[], specs text[], bio text,
  facebook_url text, photo_url text, joined_at timestamptz,
  updated_at timestamptz, tier text
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_tier <> 'free' then
    raise exception 'Paid tiers can only be granted after a successful Stripe checkout, not set directly.';
  end if;
  update public.profiles p set tier = p_tier where p.user_id = auth.uid();
  if not found then raise exception 'Create your profile before changing your membership tier'; end if;
  return query
  select p.id, p.user_id, p.first_name, p.last_name, p.agency, p.home_state,
    p.states, p.lobs, p.specs, p.bio, p.facebook_url, p.photo_url,
    p.joined_at, p.updated_at, p.tier
  from public.profiles p where p.user_id = auth.uid();
end;
$$;

-- Defense in depth. This trigger runs with the invoking role's privileges.
create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  tier_function_owner text;
begin
  if tg_op = 'INSERT' then
    if current_user::text <> 'service_role'
       and (new.tier <> 'free'
         or new.stripe_customer_id is not null
         or new.stripe_subscription_id is not null) then
      raise exception 'Protected membership and billing fields may only be set by the service role';
    end if;
    return new;
  end if;

  select pg_get_userbyid(p.proowner) into tier_function_owner
  from pg_proc p where p.oid = 'public.set_my_tier(text)'::regprocedure;

  if (new.tier is distinct from old.tier
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id)
     and current_user::text <> 'service_role'
     and current_user::text <> tier_function_owner then
    raise exception 'Protected membership and billing fields may only be changed by an authorized server role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing_fields on public.profiles;
create trigger profiles_protect_billing_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_billing_fields();

-- New conversations require a Pro recipient. Either participant may reply
-- after the thread exists, regardless of current tier.
create or replace function public.send_message(p_to_user uuid, p_body text)
returns public.messages
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  recipient_tier text;
  tid uuid;
  result public.messages;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_to_user is null or p_to_user = me then raise exception 'Invalid recipient'; end if;
  if trim(coalesce(p_body, '')) = '' then raise exception 'Message cannot be empty'; end if;
  if not exists (select 1 from public.profiles p where p.user_id = me) then
    raise exception 'Create your profile before sending messages';
  end if;

  lo := least(me, p_to_user);
  hi := greatest(me, p_to_user);
  select t.id into tid from public.message_threads t
  where t.user_low = lo and t.user_high = hi;

  if tid is null then
    select p.tier into recipient_tier from public.profiles p where p.user_id = p_to_user;
    if recipient_tier is null then raise exception 'Recipient has no profile'; end if;
    if recipient_tier <> 'pro' then raise exception 'Only Pro members can receive a new conversation'; end if;
    insert into public.message_threads (user_low, user_high) values (lo, hi)
    on conflict (user_low, user_high) do nothing;
    select t.id into tid from public.message_threads t
    where t.user_low = lo and t.user_high = hi;
  end if;

  insert into public.messages (thread_id, sender_id, body)
  values (tid, me, trim(p_body))
  returning id, thread_id, sender_id, body, read, created_at into result;
  return result;
end;
$$;

create or replace function public.list_my_threads()
returns table (
  thread_id uuid, other_user_id uuid, other_first text, other_last text,
  other_photo text, last_body text, last_at timestamptz, unread_count int
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    t.id,
    (case when t.user_low = auth.uid() then t.user_high else t.user_low end),
    coalesce(other.first_name, 'Former'),
    coalesce(other.last_name, 'member'),
    other.photo_url,
    last_msg.body,
    last_msg.created_at,
    (select count(*)::int from public.messages m
     where m.thread_id = t.id and m.sender_id <> auth.uid() and m.read = false)
  from public.message_threads t
  left join public.profiles other
    on other.user_id = (case when t.user_low = auth.uid() then t.user_high else t.user_low end)
  left join lateral (
    select m.body, m.created_at from public.messages m
    where m.thread_id = t.id order by m.created_at desc limit 1
  ) last_msg on true
  where auth.uid() = t.user_low or auth.uid() = t.user_high
  order by coalesce(last_msg.created_at, t.created_at) desc;
$$;

-- PostgreSQL grants execute to PUBLIC by default; replace those defaults with
-- the intended browser-role grants only.
revoke execute on function public.get_directory_stats() from public;
revoke execute on function public.search_directory(text, text, text) from public;
revoke execute on function public.upsert_my_profile(text, text, text, text, text[], text[], text[], text, text) from public;
revoke execute on function public.set_my_photo(text) from public;
revoke execute on function public.set_my_tier(text) from public;
revoke execute on function public.delete_my_profile() from public;
revoke execute on function public.send_message(uuid, text) from public;
revoke execute on function public.list_my_threads() from public;
revoke execute on function public.mark_thread_read(uuid) from public;
revoke execute on function public.protect_profile_billing_fields() from public;

grant execute on function public.get_directory_stats() to anon, authenticated;
grant execute on function public.search_directory(text, text, text) to authenticated;
grant execute on function public.upsert_my_profile(text, text, text, text, text[], text[], text[], text, text) to authenticated;
grant execute on function public.set_my_photo(text) to authenticated;
grant execute on function public.set_my_tier(text) to authenticated;
grant execute on function public.delete_my_profile() to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.list_my_threads() to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
