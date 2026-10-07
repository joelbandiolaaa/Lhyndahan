-- Store renamed to Lhyndahan: order codes are now LH-0001 (was RH-0001).
alter table public.orders alter column code set expression as (
  'LH-' || case when order_no < 10000 then lpad(order_no::text, 4, '0') else order_no::text end
);
