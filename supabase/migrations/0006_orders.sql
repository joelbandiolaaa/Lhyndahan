-- =====================================================================
-- M2: placing and looking up orders
-- =====================================================================

-- Server-only secret: only our /api/orders route knows it, so nobody can
-- call create_order() directly and skip the rate limit. Lives in a schema
-- the public API does not expose.
-- A new schema grants nothing to anon/authenticated, so it stays private.
create schema if not exists private;
create table private.app_secrets (
  key   text primary key,
  value text not null
);
insert into private.app_secrets (key, value)
values ('order_api_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Which batch / delivery dates apply right now (read-only, for the shop)
-- ---------------------------------------------------------------------
create or replace function public.current_batch_preview(ts timestamptz default now())
returns table (code text, cutoff_at timestamptz, office_date date, outside_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s          public.settings;
  local_ts   timestamp := ts at time zone 'Asia/Manila';
  cutoff_day date;
  cutoff_end timestamptz;
begin
  return query
    select b.code, b.cutoff_at, b.office_date, b.outside_date
    from public.batches b where b.starts_at <= ts and ts < b.cutoff_at;
  if found then return; end if;

  select * into s from public.settings where id = 1;
  cutoff_day := local_ts::date + ((s.cutoff_dow - extract(dow from local_ts)::int + 7) % 7);
  cutoff_end := ((cutoff_day + s.cutoff_time) + interval '1 minute') at time zone 'Asia/Manila';
  if cutoff_end <= ts then
    cutoff_day := cutoff_day + 7;
    cutoff_end := cutoff_end + interval '7 days';
  end if;
  return query select to_char(cutoff_day, 'YYYY-MM-DD'), cutoff_end,
                      cutoff_day + s.office_offset_days, cutoff_day + s.outside_offset_days;
end $$;

-- ---------------------------------------------------------------------
-- Place an order. Prices always come from the database, never the cart.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb, p_ip_hash text, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  v_items    jsonb := coalesce(p->'items', '[]'::jsonb);
begin
  select value into v_secret from private.app_secrets where key = 'order_api_secret';
  if p_secret is null or v_secret is null or p_secret <> v_secret then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Spam protection: max 5 orders per device/IP per hour.
  select count(*) into v_count from public.order_attempts
  where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  if v_count >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into public.order_attempts (ip_hash) values (p_ip_hash);

  -- Validation (the app validates too; this is the last line of defence)
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if v_phone !~ '^\+639[0-9]{9}$' then raise exception 'invalid_phone'; end if;
  if length(v_address) < 5 or length(v_address) > 300 then raise exception 'invalid_address'; end if;
  if length(v_landmark) < 2 or length(v_landmark) > 200 then raise exception 'invalid_landmark'; end if;
  if v_map is not null and (length(v_map) > 500 or v_map !~ '^https://') then raise exception 'invalid_map_url'; end if;
  if v_notes is not null and length(v_notes) > 500 then raise exception 'invalid_notes'; end if;
  begin
    v_delivery := (p->>'delivery_type')::public.delivery_type;
    v_payment  := (p->>'payment_method')::public.payment_method;
  exception when others then
    raise exception 'invalid_choice';
  end;
  if v_delivery is null or v_payment is null then raise exception 'invalid_choice'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 40 then
    raise exception 'empty_cart';
  end if;

  v_batch := public.get_or_create_batch(now());

  insert into public.customers (phone, name) values (v_phone, v_name)
  on conflict (phone) do update set name = excluded.name
  returning id into v_customer;

  insert into public.orders (batch_id, customer_id, name, phone, delivery_type, address, landmark,
                             map_url, notes, delivery_date, payment_method, total)
  values (v_batch.id, v_customer, v_name, v_phone, v_delivery, v_address, v_landmark, v_map, v_notes,
          case when v_delivery = 'office' then v_batch.office_date else v_batch.outside_date end,
          v_payment, 0)
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
    'payment_method', v_payment
  );
end $$;

-- ---------------------------------------------------------------------
-- Customer order lookup: needs BOTH the order code and the phone number.
-- Returns no address or notes on purpose.
-- ---------------------------------------------------------------------
create or replace function public.lookup_order(p_code text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', o.code,
    'name', o.name,
    'status', o.status,
    'paid', o.paid,
    'payment_method', o.payment_method,
    'delivery_type', o.delivery_type,
    'delivery_date', o.delivery_date,
    'total', o.total,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.qty, 'price', i.selling_price) order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  where o.code = upper(trim(p_code)) and o.phone = p_phone;
$$;

revoke execute on function public.current_batch_preview(timestamptz) from public;
grant  execute on function public.current_batch_preview(timestamptz) to anon, authenticated, service_role;
revoke execute on function public.create_order(jsonb, text, text) from public;
grant  execute on function public.create_order(jsonb, text, text) to anon, authenticated, service_role;
revoke execute on function public.lookup_order(text, text) from public;
grant  execute on function public.lookup_order(text, text) to anon, authenticated, service_role;
