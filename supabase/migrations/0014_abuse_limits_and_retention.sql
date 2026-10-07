-- Abuse protection and data retention.
--  * lookup_order: max 10 wrong guesses per hour per order code and per phone number
--  * create_order: max 5 orders per hour per phone number (on top of the per-IP limit);
--    an order no longer renames an existing customer record
--  * purge_old_data(): clears old attempt logs and anonymises personal details of orders
--    older than 180 days (sales history is kept), scheduled daily with pg_cron

create table public.lookup_attempts (
  id         bigint generated always as identity primary key,
  phone      text not null,
  code       text not null,
  created_at timestamptz not null default now()
);
create index lookup_attempts_phone_idx on public.lookup_attempts (phone, created_at desc);
create index lookup_attempts_code_idx  on public.lookup_attempts (code, created_at desc);
alter table public.lookup_attempts enable row level security;
revoke all on public.lookup_attempts from anon, authenticated;

create or replace function public.lookup_order(p_code text, p_phone text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_code  text := left(upper(trim(coalesce(p_code, ''))), 20);
  v_phone text := left(trim(coalesce(p_phone, '')), 20);
  v_res   jsonb;
begin
  if (select count(*) from public.lookup_attempts
      where created_at > now() - interval '1 hour' and (phone = v_phone or code = v_code)) >= 10 then
    raise exception 'rate_limited';
  end if;

  select jsonb_build_object(
    'code', o.code,
    'name', o.name,
    'status', o.status,
    'paid', o.paid,
    'payment_method', o.payment_method,
    'qr_id', o.qr_id,
    'qr_provider', o.qr_provider,
    'delivery_type', o.delivery_type,
    'delivery_date', o.delivery_date,
    'total', o.total,
    'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.qty, 'price', i.selling_price) order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  ) into v_res
  from public.orders o
  where o.code = v_code and o.phone = v_phone;

  if v_res is null then
    insert into public.lookup_attempts (phone, code) values (v_phone, v_code);
  end if;
  return v_res;
end $function$;

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

  v_batch := public.get_or_create_batch(now());

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
end $function$;;


create sequence public.anon_phone_seq;

create or replace function public.purge_old_data()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  delete from public.order_attempts  where created_at < now() - interval '2 days';
  delete from public.lookup_attempts where created_at < now() - interval '2 days';
  delete from public.page_views      where created_at < now() - interval '90 days';

  -- Personal details of old orders are removed; items, totals and dates stay for sales history.
  update public.orders
     set name = 'Removed', phone = '+639' || lpad(nextval('public.anon_phone_seq')::text, 9, '0'),
         address = 'Removed', landmark = 'Removed', map_url = null, notes = null
   where created_at < now() - interval '180 days' and name <> 'Removed';

  update public.customers
     set name = 'Removed', phone = '+639' || lpad(nextval('public.anon_phone_seq')::text, 9, '0')
   where created_at < now() - interval '180 days' and name <> 'Removed'
     and not exists (select 1 from public.orders o where o.customer_id = customers.id and o.created_at >= now() - interval '180 days');
end $function$;

revoke execute on function public.purge_old_data() from public, anon, authenticated;

-- Run the cleanup every day at 03:30 Philippine time (19:30 UTC). Skipped where pg_cron isn't available.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-old-data', '30 19 * * *', 'select public.purge_old_data()');
exception when others then
  raise notice 'pg_cron not available here: run select public.purge_old_data() daily instead.';
end $$;
