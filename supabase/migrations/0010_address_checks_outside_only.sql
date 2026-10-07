-- KUS (office) orders carry no street address or landmark, so only enforce them for outside delivery.
alter table public.orders drop constraint orders_address_check, drop constraint orders_landmark_check;
alter table public.orders
  add constraint orders_address_check check (delivery_type = 'office' or length(trim(address)) >= 5),
  add constraint orders_landmark_check check (delivery_type = 'office' or length(trim(landmark)) >= 2);
