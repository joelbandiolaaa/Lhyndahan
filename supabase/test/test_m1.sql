-- Assertions for M1. Run with: supabase/test/run.sh
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label;
  else raise exception 'FAIL  %', label; end if;
end $$;

-- helper: does this statement throw?
create or replace function pg_temp.throws(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;

update public.settings set admin_email = 'april@example.com';

-- ---------------- Batch math (Asia/Manila) ----------------
-- 2026-10-06 is a Tuesday.
select pg_temp.ok((select code from public.get_or_create_batch('2026-10-06 12:00+08')) = '2026-10-07',
  'Tuesday order → batch with Wed 2026-10-07 cutoff');
select pg_temp.ok((select office_date from public.batches where code='2026-10-07') = '2026-10-09',
  'Office delivery = Friday 2026-10-09');
select pg_temp.ok((select outside_date from public.batches where code='2026-10-07') = '2026-10-10',
  'Outside delivery = Saturday 2026-10-10');
select pg_temp.ok((select code from public.get_or_create_batch('2026-10-07 23:59:59+08')) = '2026-10-07',
  'Wed 11:59:59 PM → still current batch');
select pg_temp.ok((select code from public.get_or_create_batch('2026-10-08 00:00:00+08')) = '2026-10-14',
  'Thu 12:00 AM → next batch');
select pg_temp.ok((select code from public.get_or_create_batch('2026-10-07 16:30:00+00')) = '2026-10-14',
  'UTC 16:30 Wed = Thu 00:30 Manila → next batch');
select pg_temp.ok((select count(*) from public.batches) = 2, 'Repeated calls do not duplicate batches');
select pg_temp.ok((select starts_at from public.batches where code='2026-10-14')
                = (select cutoff_at from public.batches where code='2026-10-07'),
  'Batches are contiguous (no gap, no overlap)');

-- Changing cutoff to Tuesday must not touch existing batches or overlap them
update public.settings set cutoff_dow = 2;
select pg_temp.ok((select code from public.get_or_create_batch('2026-10-10 10:00+08')) = '2026-10-14',
  'Existing batch kept after cutoff setting change');
select pg_temp.ok((select code from public.get_or_create_batch('2026-10-15 10:00+08')) = '2026-10-20',
  'Future batch uses new Tuesday cutoff');
select pg_temp.ok((select starts_at from public.batches where code='2026-10-20')
                = (select cutoff_at from public.batches where code='2026-10-14'),
  'New-rule batch starts exactly where the old one ended');
select pg_temp.ok((select office_date from public.batches where code='2026-10-20') = '2026-10-22',
  'Delivery offsets follow the cutoff (Tue + 2 = Thu)');
update public.settings set cutoff_dow = 3;

-- ---------------- Order code ----------------
insert into public.customers (phone, name) values ('+639171234567', 'Test');
insert into public.orders (batch_id, customer_id, name, phone, delivery_type, address, landmark,
  delivery_date, payment_method, total)
select b.id, c.id, 'Test', '+639171234567', 'office', 'Unit 1, Some Bldg', 'Near 7-11', b.office_date, 'cod', 100
from public.batches b, public.customers c where b.code='2026-10-07';
select pg_temp.ok((select code from public.orders limit 1) = 'LH-0001', 'First order code is LH-0001');
select pg_temp.ok(pg_temp.throws($q$insert into public.customers (phone, name) values ('09171234567','x')$q$),
  'Un-normalized phone rejected by DB');

-- Seed products
\ir ../seed.sql
select pg_temp.ok((select count(*) from public.products) = 29, 'Seed loads the 29 products');
select pg_temp.ok((select count(*) from public.products where supplier_price is null) = 29, 'Supplier price left unset');
select pg_temp.ok((select profit_per_piece from public.products where slug='hopia-monggo-x10') is null,
  'No supplier price -> profit is NULL, not a fake number');
-- For the visibility tests below: only one product live
update public.products set is_active = false;
update public.products set is_active = true, supplier_price = 30 where slug = 'hopia-monggo-x10';
select pg_temp.ok((select profit_per_piece from public.products where slug='hopia-monggo-x10') = 50,
  'profit = 90 - 10 markup - 30 supplier = 50');
insert into public.product_images (product_id, path, is_primary)
  select id, 'a.webp', true from public.products where slug='hopia-monggo-x10';
insert into public.product_images (product_id, path, is_primary)
  select id, 'hidden.webp', true from public.products where slug='hopia-baboy-x10';
select pg_temp.ok(pg_temp.throws($q$insert into public.product_images (product_id, path, is_primary)
  select id, 'b.webp', true from public.products where slug='hopia-monggo-x10'$q$),
  'Only one primary image per product');

-- ---------------- Anonymous visitor ----------------
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.ok((select count(*) from public.products) = 1, 'anon sees only the active product');
select pg_temp.ok((select count(*) from public.product_images) = 1, 'anon sees only images of active products');
select pg_temp.ok((select count(*) from public.orders) = 0, 'anon cannot read orders');
select pg_temp.ok((select count(*) from public.customers) = 0, 'anon cannot read customers');
select pg_temp.ok((select count(*) from public.settings) = 0, 'anon cannot read settings table');
select pg_temp.ok((select gcash_qr_path is null from public.get_public_settings()), 'anon can read public settings');
select pg_temp.ok(pg_temp.throws($q$insert into public.products (slug,name,supplier_price,selling_price) values ('x','x',1,1)$q$),
  'anon cannot create products');
select pg_temp.ok(pg_temp.throws($q$select public.get_or_create_batch(now())$q$),
  'anon cannot call get_or_create_batch');
update public.products set selling_price = 1;  -- silently affects 0 rows under RLS
reset role;
select pg_temp.ok((select selling_price from public.products where slug='hopia-monggo-x10') = 90,
  'anon update had no effect');

-- ---------------- Logged-in stranger ----------------
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"hacker@example.com"}', false);
select pg_temp.ok(not public.is_admin(), 'stranger is not admin');
select pg_temp.ok((select count(*) from public.orders) = 0, 'stranger cannot read orders');
select pg_temp.ok((select count(*) from public.products) = 1, 'stranger sees only active products');
select pg_temp.ok(pg_temp.throws($q$insert into storage.objects (bucket_id, name) values ('product-images','x.webp')$q$),
  'stranger cannot upload images');
reset role;

-- ---------------- Admin ----------------
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"APRIL@example.com"}', false);
select pg_temp.ok(public.is_admin(), 'admin recognized (email case-insensitive)');
select pg_temp.ok((select count(*) from public.products) = 29, 'admin sees all products incl. hidden');
select pg_temp.ok((select count(*) from public.orders) = 1, 'admin reads orders');
insert into storage.objects (bucket_id, name) values ('product-images', 'p/1.webp');
select pg_temp.ok(true, 'admin can upload images');
update public.settings set gcash_name = 'April';
select pg_temp.ok((select gcash_name from public.settings) = 'April', 'admin can edit settings');
select pg_temp.ok(pg_temp.throws($q$update public.settings set admin_email = 'hacker@example.com'$q$),
  'admin cannot change admin_email from the app');
reset role;

-- empty admin_email must never match an anonymous/empty email
update public.settings set admin_email = '';
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', false);
select pg_temp.ok(not public.is_admin(), 'empty admin_email grants nobody admin');
reset role;

\echo 'ALL M1 DATABASE TESTS PASSED'
