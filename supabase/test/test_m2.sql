-- Assertions for M2 (ordering). Runs after test_m1.sql on the same DB.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if;
end $$;
create or replace function pg_temp.err(stmt text) returns text language plpgsql as $$
begin execute stmt; return null; exception when others then return sqlerrm; end $$;

update public.settings set admin_email = 'april@example.com' where id = 1;
update public.products set is_active = true, deleted_at = null where slug in ('hopia-monggo-x10', 'cheese-cake-x1');

insert into public.payment_qrs (label, image_path) values ('GCash', 'qr/test.png');
create temp table t as select value as secret from private.app_secrets where key = 'order_api_secret';
grant select on t to anon;

-- order payload helper
create or replace function pg_temp.payload(phone text, qty int default 2) returns jsonb language sql as $$
  select jsonb_build_object(
    'name', 'Juan Dela Cruz', 'phone', phone, 'delivery_type', 'office',
    'address', 'Unit 5, Some Tower, Taguig', 'landmark', 'Tabi ng 7-Eleven',
    'map_url', 'https://maps.google.com/?q=14.5,121.0', 'payment_method', 'qr', 'qr_id', (select id from public.payment_qrs limit 1),
    'items', jsonb_build_array(
      jsonb_build_object('product_id', (select id from public.products where slug='hopia-monggo-x10'), 'qty', qty, 'price', 1),
      jsonb_build_object('product_id', (select id from public.products where slug='cheese-cake-x1'), 'qty', 1)))
$$;

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);

select pg_temp.ok(pg_temp.err($q$select public.create_order(pg_temp.payload('+639171111111'), 'ip1', 'wrong')$q$) = 'forbidden',
  'create_order rejects a wrong secret');

select pg_temp.ok((select (public.create_order(pg_temp.payload('+639171111111'), 'ip1', (select secret from t)))->>'total') = '195.00',
  'Total computed from DB prices (2 x 90 + 1 x 15 = 195), cart price ignored');

select pg_temp.ok(pg_temp.err($q$select public.create_order(pg_temp.payload('09171111111'), 'ip1', (select secret from t))$q$) = 'invalid_phone',
  'Un-normalized phone rejected');
select pg_temp.ok(pg_temp.err($q$select public.create_order(pg_temp.payload('+639171111111', 0), 'ip1', (select secret from t))$q$) = 'invalid_qty',
  'Quantity 0 rejected');
select pg_temp.ok(pg_temp.err($q$select public.create_order(jsonb_set(pg_temp.payload('+639171111111'), '{delivery_type}', '"outside"') - 'landmark', 'ip1', (select secret from t))$q$) = 'invalid_landmark',
  'Missing landmark rejected for outside delivery');

-- anon still cannot read orders directly
select pg_temp.ok((select count(*) from public.orders) = 0, 'anon cannot list orders');

-- lookup
select pg_temp.ok((public.lookup_order('lh-0002', '+639171111111'))->>'status' = 'pending',
  'Lookup works with code (any case) + phone');
select pg_temp.ok(public.lookup_order('LH-0002', '+639999999999') is null, 'Lookup with wrong phone returns nothing');
select pg_temp.ok(((public.lookup_order('LH-0002', '+639171111111')) ? 'address') = false, 'Lookup hides the address');

-- rate limit: 4 more succeed (5 total), the 6th is blocked
select public.create_order(pg_temp.payload('+639171111111'), 'ip1', (select secret from t)) from generate_series(1, 4);
select pg_temp.ok(pg_temp.err($q$select public.create_order(pg_temp.payload('+639171111111'), 'ip1', (select secret from t))$q$) = 'rate_limited',
  '6th order in an hour from the same IP is blocked');
select pg_temp.ok((public.create_order(pg_temp.payload('+639172222222'), 'ip2', (select secret from t))) ? 'code',
  'A different IP can still order');

-- KUS (office) delivery collects no address; QR payment must name an active QR
select public.create_order(pg_temp.payload('+639173333333'), 'ip3', (select secret from t));
reset role;
select pg_temp.ok((select address = 'KUS' and landmark = '' and map_url is null from public.orders where phone = '+639173333333'),
  'KUS orders ignore any address/landmark/map sent and store KUS');
select pg_temp.ok((select qr_provider = 'GCash' and qr_id is not null from public.orders where phone = '+639173333333'),
  'QR order remembers which QR was chosen');
select pg_temp.ok(((public.lookup_order((select code from public.orders where phone = '+639173333333'), '+639173333333'))->>'qr_provider') = 'GCash',
  'Lookup returns the chosen QR');
set role anon;
select pg_temp.ok(pg_temp.err($q$select public.create_order(pg_temp.payload('+639174444444') - 'qr_id', 'ip3', (select secret from t))$q$) = 'invalid_choice',
  'QR payment without a QR is rejected');
select pg_temp.ok(pg_temp.err($q$select public.create_order(jsonb_set(pg_temp.payload('+639174444444'), '{payment_method}', '"gcash"'), 'ip3', (select secret from t))$q$) = 'invalid_choice',
  'Legacy gcash payment is not accepted for new orders');


-- preview
select pg_temp.ok((select office_date - (cutoff_at at time zone 'Asia/Manila')::date from public.current_batch_preview()) = 1,
  'Office delivery is the 2nd day after cutoff day (cutoff_at is the next midnight)');
reset role;

select pg_temp.ok((select count(*) from public.customers where phone = '+639171111111') = 1, 'Repeat customer stored once');
select pg_temp.ok((select bool_and(supplier_price is null) from public.order_items where product_name = 'Cheese Cake x1'), 'Unknown supplier price stays NULL on the order');
select pg_temp.ok(not exists (select 1 from information_schema.role_table_grants
                              where table_schema = 'private' and grantee in ('anon','authenticated')),
  'Secret table not granted to the public');

\echo 'ALL M2 DATABASE TESTS PASSED'
