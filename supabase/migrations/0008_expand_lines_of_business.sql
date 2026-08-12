-- ============================================================
-- Insurance Mavericks — expanded commercial lines of business
-- Run after 0007_message_notification_webhook_trigger.sql.
-- ============================================================

-- This transaction prevents profiles_set_updated_at from remaining disabled if a statement fails midway;
-- the disable/enable trigger statements require table ownership, which postgres has.
begin;

delete from public.lines_of_business
where name = 'Commercial P&C';

insert into public.lines_of_business (name) values
  ('Commercial Property'),('Commercial Umbrella / Excess'),('Product Liability'),
  ('Liquor Liability'),('EPLI'),('Fiduciary Liability'),('Crime & Fidelity'),
  ('Inland Marine'),('Ocean Marine & Cargo'),('Builders Risk'),('Equipment Breakdown'),
  ('Trucking & Motor Carrier'),('Garage & Dealers'),('Farm & Ranch'),
  ('Environmental & Pollution'),('Aviation'),('Commercial Flood'),
  ('Commercial Earthquake'),('Special Events'),('Excess & Surplus (E&S)'),('Terrorism')
on conflict (name) do nothing;

alter table public.profiles disable trigger profiles_set_updated_at;

update public.profiles p
   set lobs = (
     select array_agg(v order by ord)
       from (
         select distinct on (v) v, ord
           from unnest(array_replace(p.lobs, 'Commercial P&C', 'Commercial Property'))
                with ordinality as t(v, ord)
          order by v, ord
       ) d
   )
 where 'Commercial P&C' = any(p.lobs);

alter table public.profiles enable trigger profiles_set_updated_at;

commit;
