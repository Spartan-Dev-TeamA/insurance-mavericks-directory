-- ============================================================
-- Insurance Mavericks — public licensed-state coverage stats
-- Run after 0003_harden_tiers_and_messaging.sql.
-- ============================================================

-- Public aggregate used by the Map. SECURITY DEFINER intentionally bypasses
-- the authenticated-only profiles SELECT policy without exposing profile rows.
create or replace function public.get_state_coverage_counts()
returns table(state_code text, member_count int)
language sql
stable
security definer
set search_path = public
as $$
  select licensed.state_code, count(distinct p.id)::int as member_count
  from profiles p
  cross join lateral unnest(p.states) as licensed(state_code)
  group by licensed.state_code
  having count(distinct p.id) > 0
  order by licensed.state_code;
$$;

revoke execute on function public.get_state_coverage_counts() from public;
grant execute on function public.get_state_coverage_counts() to anon, authenticated;
