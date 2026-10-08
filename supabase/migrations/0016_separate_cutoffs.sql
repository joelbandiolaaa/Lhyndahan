-- Separate cutoffs per delivery type (default: 3:00 PM, three days before delivery).
--   KUS delivery        Friday   → orders close Tuesday 3:00 PM
--   "My address" delivery Saturday → orders close Wednesday 3:00 PM
-- A batch is still one week (its window ends at the later, "My address", cutoff). KUS orders placed after
-- the KUS cutoff roll over to next week's batch.

alter table public.settings
  add column office_cutoff_dow  int  not null default 2 check (office_cutoff_dow between 0 and 6),
  add column office_cutoff_time time not null default '15:00';

-- cutoff_* is the "My address" cutoff (it ends the batch window); office_cutoff_* is KUS.
update public.settings
   set cutoff_dow = 3, cutoff_time = '15:00',
       office_cutoff_dow = 2, office_cutoff_time = '15:00',
       office_offset_days = 3, outside_offset_days = 3
 where id = 1;

alter table public.batches
  add column office_cutoff_at timestamptz,
  add column office_supplier_ordered_at  timestamptz,
  add column outside_supplier_ordered_at timestamptz;
update public.batches
   set office_cutoff_at = cutoff_at,
       office_supplier_ordered_at = supplier_ordered_at,
       outside_supplier_ordered_at = supplier_ordered_at;
alter table public.batches alter column office_cutoff_at set not null;
alter table public.batches add check (office_cutoff_at <= cutoff_at);

-- Batches nobody has ordered into yet are re-created on demand with the new schedule.
delete from public.batches b
 where b.cutoff_at > now() and not exists (select 1 from public.orders o where o.batch_id = b.id);

-- ---------------------------------------------------------------------
-- plan_batch: the batch covering `ts`. Returns the stored row, or (if none exists yet) the row
-- that would be created (id is null), so the shop can preview without writing anything.
-- ---------------------------------------------------------------------
create or replace function public.plan_batch(ts timestamptz default now())
returns public.batches
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s          public.settings;
  b          public.batches;
  local_ts   timestamp := ts at time zone 'Asia/Manila';
  cutoff_day date;
  cutoff_end timestamptz;
  prev_end   timestamptz;
  v_start    timestamptz;
  office_day date;
  office_end timestamptz;
begin
  select * into b from public.batches where starts_at <= ts and ts < cutoff_at;
  if found then
    return b;
  end if;

  select * into s from public.settings where id = 1;

  cutoff_day := local_ts::date + ((s.cutoff_dow - extract(dow from local_ts)::int + 7) % 7);
  cutoff_end := ((cutoff_day + s.cutoff_time) + interval '1 minute') at time zone 'Asia/Manila';
  if cutoff_end <= ts then
    cutoff_day := cutoff_day + 7;
    cutoff_end := cutoff_end + interval '7 days';
  end if;

  -- never overlap an earlier batch (matters only if the cutoff setting changed)
  select max(cutoff_at) into prev_end from public.batches where cutoff_at <= ts;
  v_start := greatest(cutoff_end - interval '7 days', coalesce(prev_end, '-infinity'::timestamptz));

  -- KUS cutoff: the most recent office-cutoff weekday on/before the batch's cutoff day
  office_day := cutoff_day - ((s.cutoff_dow - s.office_cutoff_dow + 7) % 7);
  office_end := ((office_day + s.office_cutoff_time) + interval '1 minute') at time zone 'Asia/Manila';
  office_end := least(greatest(office_end, v_start + interval '1 minute'), cutoff_end);

  b := null;
  b.code := to_char(cutoff_day, 'YYYY-MM-DD');
  b.starts_at := v_start;
  b.cutoff_at := cutoff_end;
  b.office_cutoff_at := office_end;
  b.office_date := office_day + s.office_offset_days;
  b.outside_date := cutoff_day + s.outside_offset_days;
  return b;
end $$;

create or replace function public.get_or_create_batch(ts timestamptz default now())
returns public.batches
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.batches;
begin
  b := public.plan_batch(ts);
  if b.id is not null then
    return b;
  end if;

  insert into public.batches (code, starts_at, cutoff_at, office_cutoff_at, office_date, outside_date)
  values (b.code, b.starts_at, b.cutoff_at, b.office_cutoff_at, b.office_date, b.outside_date)
  on conflict do nothing;

  select * into b from public.batches where starts_at <= ts and ts < cutoff_at;
  if not found then
    raise exception 'Could not resolve batch for %', ts;
  end if;
  return b;
end $$;

-- The batch an order of this delivery type placed at `ts` goes into. "My address" orders use the batch
-- covering `ts`; KUS orders placed after that batch's KUS cutoff go to the next one.
create or replace function public.order_batch(p_delivery public.delivery_type, ts timestamptz default now())
returns public.batches
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.batches := public.get_or_create_batch(ts);
begin
  if p_delivery = 'office' and ts >= b.office_cutoff_at then
    b := public.get_or_create_batch(b.cutoff_at);
  end if;
  return b;
end $$;
revoke execute on function public.plan_batch(timestamptz) from public, anon, authenticated;
revoke execute on function public.order_batch(public.delivery_type, timestamptz) from public, anon, authenticated;
grant  execute on function public.plan_batch(timestamptz) to service_role;
grant  execute on function public.order_batch(public.delivery_type, timestamptz) to service_role;
revoke execute on function public.get_or_create_batch(timestamptz) from public, anon, authenticated;

-- What the shop shows right now: both cutoffs and the delivery date each type would get.
drop function public.current_batch_preview(timestamptz);
create function public.current_batch_preview(ts timestamptz default now())
returns table (code text, cutoff_at timestamptz, office_cutoff_at timestamptz, office_date date, outside_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.batches := public.plan_batch(ts);
  o public.batches := b;
begin
  if ts >= b.office_cutoff_at then
    o := public.plan_batch(b.cutoff_at);
  end if;
  return query select b.code, b.cutoff_at, o.office_cutoff_at, o.office_date, b.outside_date;
end $$;
revoke execute on function public.current_batch_preview(timestamptz) from public;
grant  execute on function public.current_batch_preview(timestamptz) to anon, authenticated, service_role;

-- Supplier totals for one batch, optionally for one delivery type (= one supplier order / pickup).
drop function public.batch_summary(uuid);
create function public.batch_summary(p_batch_id uuid, p_delivery public.delivery_type default null)
returns table (product_name text, qty bigint, supplier_price numeric, supplier_cost numeric, sales numeric)
language sql
stable
security definer
set search_path = public
as $$
  select i.product_name, sum(i.qty), max(i.supplier_price),
         sum(i.supplier_price * i.qty), sum(i.selling_price * i.qty)
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where public.is_admin() and o.batch_id = p_batch_id and o.status <> 'cancelled'
    and (p_delivery is null or o.delivery_type = p_delivery)
  group by i.product_name
  order by i.product_name;
$$;
revoke execute on function public.batch_summary(uuid, public.delivery_type) from public, anon;
grant  execute on function public.batch_summary(uuid, public.delivery_type) to authenticated;

-- Orders go into the batch for their delivery type.
create or replace function public.create_order(p jsonb, p_ip_hash text, p_secret text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_secret   text;
  v_batch    public.batches;
  v_customer uuid;
  v_order    public.orders;
  v_item     jsonb;
  v_product  public.products;
  v_total    numeric(10,2) := 0;
  v_count    int;
  v_name     text := trim(coalesce(p->>'name', ''));
  v_phone    text := trim(coalesce(p->>'phone', ''));
  v_address  text := trim(coalesce(p->>'address', ''));
  v_landmark text := trim(coalesce(p->>'landmark', ''));
  v_map      text := nullif(trim(coalesce(p->>'map_url', '')), '');
  v_notes    text := nullif(trim(coalesce(p->>'notes', '')), '');
  v_delivery public.delivery_type;
  v_payment  public.payment_method;
  v_qr_id    uuid;
  v_qr_label text;
  v_qr_ref   uuid;
  v_items    jsonb := coalesce(p->'items', '[]'::jsonb);
begin
  select value into v_secret from private.app_secrets where key = 'order_api_secret';
  if p_secret is null or v_secret is null or p_secret <> v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_count from public.order_attempts
  where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into public.order_attempts (ip_hash) values (p_ip_hash);

  -- Also cap per phone number, so rotating IPs can't flood one person's number with orders.
  if (select count(*) from public.orders where phone = trim(coalesce(p->>'phone', '')) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if v_phone !~ '^\+639[0-9]{9}$' then raise exception 'invalid_phone'; end if;
  if v_notes is not null and length(v_notes) > 500 then raise exception 'invalid_notes'; end if;
  begin
    v_delivery := (p->>'delivery_type')::public.delivery_type;
    v_payment  := (p->>'payment_method')::public.payment_method;
  exception when others then
    raise exception 'invalid_choice';
  end;
  if v_delivery is null or v_payment is null then raise exception 'invalid_choice'; end if;

  if v_payment = 'gcash' then raise exception 'invalid_choice'; end if; -- legacy value, not accepted for new orders
  if v_payment = 'qr' then
    begin
      v_qr_id := (p->>'qr_id')::uuid;
    exception when others then
      raise exception 'invalid_choice';
    end;
    select id, label into v_qr_ref, v_qr_label from public.payment_qrs where id = v_qr_id and is_active;
    if v_qr_ref is null then raise exception 'invalid_choice'; end if;
  end if;

  if v_delivery = 'office' then
    v_address := 'KUS';
    v_landmark := '';
    v_map := null;
  else
    if length(v_address) < 5 or length(v_address) > 300 then raise exception 'invalid_address'; end if;
    if length(v_landmark) < 2 or length(v_landmark) > 200 then raise exception 'invalid_landmark'; end if;
    if v_map is not null and (length(v_map) > 500 or v_map !~ '^https://') then raise exception 'invalid_map_url'; end if;
  end if;

  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 40 then
    raise exception 'empty_cart';
  end if;

  v_batch := public.order_batch(v_delivery, now());

  insert into public.customers (phone, name) values (v_phone, v_name)
  on conflict (phone) do update set phone = excluded.phone
  returning id into v_customer;

  insert into public.orders (batch_id, customer_id, name, phone, delivery_type, address, landmark,
                             map_url, notes, delivery_date, payment_method, qr_id, qr_provider, total)
  values (v_batch.id, v_customer, v_name, v_phone, v_delivery, v_address, v_landmark, v_map, v_notes,
          case when v_delivery = 'office' then v_batch.office_date else v_batch.outside_date end,
          v_payment, v_qr_ref, v_qr_label, 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_items) loop
    if (v_item->>'qty') !~ '^[0-9]{1,2}$' or (v_item->>'qty')::int < 1 then
      raise exception 'invalid_qty';
    end if;
    select * into v_product from public.products
    where id = (v_item->>'product_id')::uuid and is_active and deleted_at is null;
    if not found then
      raise exception 'product_unavailable';
    end if;
    insert into public.order_items (order_id, product_id, product_name, qty, selling_price, supplier_price, delivery_markup)
    values (v_order.id, v_product.id, v_product.name, (v_item->>'qty')::int,
            v_product.selling_price, v_product.supplier_price, v_product.delivery_markup);
    v_total := v_total + v_product.selling_price * (v_item->>'qty')::int;
  end loop;

  update public.orders set total = v_total where id = v_order.id;

  return jsonb_build_object(
    'code', v_order.code,
    'total', v_total,
    'delivery_date', v_order.delivery_date,
    'delivery_type', v_delivery,
    'payment_method', v_payment,
    'qr_provider', v_qr_label
  );
end $function$;
