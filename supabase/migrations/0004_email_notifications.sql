-- ============================================================
-- Insurance Mavericks — Email notifications
-- Run after 0001_init.sql, 0002_tiers_and_messaging.sql, and
-- 0003_harden_tiers_and_messaging.sql.
-- ============================================================

alter table public.profiles
  add column if not exists email_notifications boolean not null default true,
  add column if not exists welcomed_at timestamptz;

alter table public.message_threads
  add column if not exists notify_claimed_low boolean not null default false,
  add column if not exists notify_claimed_high boolean not null default false;

-- 0002 used a table-level SELECT grant, which would expose future columns.
-- Replace it with a fixed browser-safe projection.
revoke select on public.message_threads from anon, authenticated;
grant select (id, user_low, user_high, created_at)
  on public.message_threads to anon, authenticated;

create or replace function public.get_my_email_prefs()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select p.email_notifications into result
  from public.profiles p where p.user_id = auth.uid();
  if not found then raise exception 'Create your profile before managing email preferences'; end if;
  return result;
end;
$$;

create or replace function public.set_my_email_prefs(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result boolean;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_enabled is null then raise exception 'Email preference must be true or false'; end if;

  update public.profiles p
  set email_notifications = p_enabled
  where p.user_id = auth.uid()
  returning p.email_notifications into result;

  if not found then raise exception 'Create your profile before managing email preferences'; end if;
  return result;
end;
$$;

-- Mark the other participant's messages read and re-arm this participant's
-- first-unread notification latch for the next unread cycle.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not exists (
    select 1 from public.message_threads t
    where t.id = p_thread_id and (me = t.user_low or me = t.user_high)
  ) then
    raise exception 'Not a participant in this thread';
  end if;

  update public.messages
  set read = true
  where thread_id = p_thread_id and sender_id <> me and read = false;

  update public.message_threads
  set notify_claimed_low = case when me = user_low then false else notify_claimed_low end,
      notify_claimed_high = case when me = user_high then false else notify_claimed_high end
  where id = p_thread_id;
end;
$$;

-- Service-only atomic latch claim. The unread predicate and latch transition
-- occur in the same statement, so concurrent webhook deliveries have one winner.
create or replace function public.claim_message_notification(
  p_message_id uuid,
  p_thread_id uuid,
  p_recipient_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  won boolean := false;
begin
  update public.message_threads t
  set notify_claimed_low = case when p_recipient_id = t.user_low then true else t.notify_claimed_low end,
      notify_claimed_high = case when p_recipient_id = t.user_high then true else t.notify_claimed_high end
  where t.id = p_thread_id
    and (
      (p_recipient_id = t.user_low and t.notify_claimed_low = false)
      or (p_recipient_id = t.user_high and t.notify_claimed_high = false)
    )
    and exists (
      select 1 from public.messages m
      where m.id = p_message_id
        and m.thread_id = p_thread_id
        and m.read = false
    )
  returning true into won;

  return coalesce(won, false);
end;
$$;

revoke execute on function public.claim_message_notification(uuid, uuid, uuid) from public;
grant execute on function public.claim_message_notification(uuid, uuid, uuid) to service_role;

revoke execute on function public.get_my_email_prefs() from public;
revoke execute on function public.set_my_email_prefs(boolean) from public;
revoke execute on function public.mark_thread_read(uuid) from public;

grant execute on function public.get_my_email_prefs() to authenticated;
grant execute on function public.set_my_email_prefs(boolean) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- The 0003 protection trigger intentionally watches only tier and stripe_*.
-- email_notifications is browser-writable only through set_my_email_prefs();
-- welcomed_at has no browser-callable write path.
