-- KUS delivery ("office") is delivered on-site: no address, landmark or map pin is collected.
-- The server enforces this (ignores whatever the client sent) and stores 'KUS' as the address
-- so lists and exports still show where the order goes.
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
end $function$;
