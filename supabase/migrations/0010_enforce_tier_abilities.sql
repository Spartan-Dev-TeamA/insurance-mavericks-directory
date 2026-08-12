-- ============================================================
-- Insurance Mavericks — enforce rebalanced tier abilities
-- Apply only after the client using the 0009 read RPCs is live.
-- ============================================================

-- Directory reads now flow through masked SECURITY DEFINER RPCs. Revoke the
-- specialization column explicitly because a table-level revoke does not
-- remove an existing column grant.
revoke select on public.profiles         from anon, authenticated;
revoke select (specs) on public.profiles from anon, authenticated;
grant select (
  id, user_id, first_name, last_name, agency, home_state, states, lobs,
  bio, facebook_url, photo_url, joined_at, updated_at, tier
) on public.profiles to anon, authenticated;

create or replace function public.search_directory(q text default '', state_filter text default '', lob_filter text default '')
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
    and (q = '' or (p.first_name || ' ' || p.last_name || ' ' || p.agency) ilike '%' || q || '%')
    and (state_filter = '' or state_filter = any(p.states))
    and (lob_filter = '' or lob_filter = any(p.lobs))
  order by p.joined_at desc;
$$;

-- Basic and Pro members may send. Free members retain read access to existing
-- threads, but cannot start conversations or reply after a downgrade.
create or replace function public.send_message(p_to_user uuid, p_body text)
returns public.messages
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  sender_tier text;
  recipient_tier text;
  tid uuid;
  result public.messages;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_to_user is null or p_to_user = me then raise exception 'Invalid recipient'; end if;
  if trim(coalesce(p_body, '')) = '' then raise exception 'Message cannot be empty'; end if;

  select p.tier into sender_tier from public.profiles p where p.user_id = me;
  if sender_tier is null then
    raise exception 'Create your profile before sending messages';
  end if;
  if sender_tier = 'free' then
    raise exception 'Free members cannot send messages. Upgrade to Basic or Pro to start and reply to conversations.';
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
  select tid, me, trim(p_body)
  where exists (
    select 1 from public.profiles p
    where p.user_id = me and p.tier in ('basic', 'pro')
  )
  returning id, thread_id, sender_id, body, read, created_at into result;
  if result.id is null then
    raise exception 'Free members cannot send messages. Upgrade to Basic or Pro to start and reply to conversations.';
  end if;
  return result;
end;
$$;

create or replace function public.get_directory_stats()
returns table(members_count int, states_count int, lobs_count int, specs_count int)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.profiles)::int,
    (select count(distinct s) from public.profiles p, unnest(p.states) s)::int,
    (select count(distinct l) from public.profiles p, unnest(p.lobs) l)::int,
    (select count(distinct sp) from public.profiles p, unnest(p.specs) sp
      where p.tier in ('basic', 'pro'))::int;
$$;

-- No current client subscribes to profile changes. Remove the table from the
-- publication as defense in depth, while remaining compatible with stock
-- PostgreSQL test environments where the publication does not exist.
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime drop table public.profiles';
  end if;
end;
$$;

notify pgrst, 'reload schema';
