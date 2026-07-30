-- ============================================================
-- Insurance Mavericks — Membership Tiers + Pro-Only Messaging
-- Run after 0001_init.sql.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Membership tier
-- 'free' members are listed in the directory but cannot be messaged.
-- 'pro' members are messageable. There is no real billing wired up
-- yet — set_my_tier() is a self-service stub. Replace with a Stripe
-- webhook (checkout.session.completed → update tier) before launch.
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists tier text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_tier_check;
alter table public.profiles
  add constraint profiles_tier_check check (tier in ('free', 'pro'));

create or replace function public.set_my_tier(p_tier text)
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
  if p_tier not in ('free', 'pro') then
    raise exception 'Invalid tier: %', p_tier;
  end if;

  update profiles set tier = p_tier
  where user_id = auth.uid()
  returning * into result;

  if result is null then
    raise exception 'Create your profile before changing your membership tier';
  end if;

  return result;
end;
$$;
grant execute on function public.set_my_tier(text) to authenticated;

-- ────────────────────────────────────────────────────────────
-- Messaging — Pro members only. A thread is keyed by the two
-- participants (canonicalized so (A,B) and (B,A) collide); writes to
-- both tables only happen through the security-definer functions below
-- — there are no INSERT/UPDATE policies on the base tables, so direct
-- client writes are rejected by RLS.
-- ────────────────────────────────────────────────────────────
create table if not exists public.message_threads (
  id         uuid primary key default gen_random_uuid(),
  user_low   uuid not null references auth.users(id) on delete cascade,
  user_high  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint message_threads_ordered check (user_low < user_high),
  constraint message_threads_unique_pair unique (user_low, user_high)
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.message_threads(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(trim(body)) > 0 and char_length(body) <= 4000),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_created_idx on public.messages (thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

create policy "Participants can read their threads"
  on public.message_threads for select
  to authenticated
  using (auth.uid() = user_low or auth.uid() = user_high);

create policy "Participants can read their messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and (auth.uid() = t.user_low or auth.uid() = t.user_high)
    )
  );

-- Send a message. Enforces the "recipient must be Pro" rule server-side
-- (not just in the UI), creates the thread on first contact, and
-- returns the inserted message row.
create or replace function public.send_message(p_to_user uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  recipient_tier text;
  tid uuid;
  result public.messages;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if p_to_user is null or p_to_user = me then
    raise exception 'Invalid recipient';
  end if;
  if trim(coalesce(p_body, '')) = '' then
    raise exception 'Message cannot be empty';
  end if;

  select tier into recipient_tier from profiles where user_id = p_to_user;
  if recipient_tier is null then
    raise exception 'Recipient has no profile';
  end if;
  if recipient_tier <> 'pro' then
    raise exception 'This member is on the Free tier and cannot be messaged — only Pro members are messageable.';
  end if;

  lo := least(me, p_to_user);
  hi := greatest(me, p_to_user);

  insert into message_threads (user_low, user_high) values (lo, hi)
  on conflict (user_low, user_high) do nothing;

  select id into tid from message_threads where user_low = lo and user_high = hi;

  insert into messages (thread_id, sender_id, body)
  values (tid, me, trim(p_body))
  returning * into result;

  return result;
end;
$$;
grant execute on function public.send_message(uuid, text) to authenticated;

-- List the caller's conversations with the other participant's basic
-- profile info, the last message, and an unread count — one round trip
-- for the thread-list sidebar.
create or replace function public.list_my_threads()
returns table (
  thread_id uuid,
  other_user_id uuid,
  other_first text,
  other_last text,
  other_photo text,
  last_body text,
  last_at timestamptz,
  unread_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    other.user_id,
    other.first_name,
    other.last_name,
    other.photo_url,
    last_msg.body,
    last_msg.created_at,
    (
      select count(*)::int from messages m
      where m.thread_id = t.id and m.sender_id <> auth.uid() and m.read = false
    )
  from message_threads t
  join profiles other
    on other.user_id = (case when t.user_low = auth.uid() then t.user_high else t.user_low end)
  left join lateral (
    select body, created_at from messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) last_msg on true
  where auth.uid() = t.user_low or auth.uid() = t.user_high
  order by coalesce(last_msg.created_at, t.created_at) desc;
$$;
grant execute on function public.list_my_threads() to authenticated;

-- Marks the other participant's messages in a thread as read.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from message_threads t
    where t.id = p_thread_id and (auth.uid() = t.user_low or auth.uid() = t.user_high)
  ) then
    raise exception 'Not a participant in this thread';
  end if;

  update messages set read = true
  where thread_id = p_thread_id and sender_id <> auth.uid() and read = false;
end;
$$;
grant execute on function public.mark_thread_read(uuid) to authenticated;
