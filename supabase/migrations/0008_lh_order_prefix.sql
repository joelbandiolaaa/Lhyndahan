-- Store renamed to Lhyndahan: order codes are now LH-0001 (was RH-0001).
-- Fresh databases already get LH- from 0001; this only converts a database created before the rename.
do $$
declare cur text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into cur
  from pg_attrdef d join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.orders'::regclass and a.attname = 'code';
  if cur like '%RH-%' then
    execute $q$alter table public.orders alter column code set expression as (
      'LH-' || case when order_no < 10000 then lpad(order_no::text, 4, '0') else order_no::text end
    )$q$;
  end if;
end $$;
