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
select pg_temp.ok(pg_temp.err($q$select count(*) from public.orders$q$) is not null, 'anon cannot list orders (no privilege)');

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


-- per-phone cap: a 6th order for one number within an hour is refused even from a fresh IP
select public.create_order(pg_temp.payload('+639175555555'), 'pip' || g, (select secret from t)) from generate_series(1, 5) g;
select pg_temp.ok(pg_temp.err($q$select public.create_order(pg_temp.payload('+639175555555'), 'pip-new', (select secret from t))$q$) = 'rate_limited',
  '6th order for the same phone in an hour is blocked even from a new IP');

-- lookup brute-force guard: after 10 wrong guesses the code is locked for an hour
select public.lookup_order('LH-9999', '+639170009999') from generate_series(1, 10);
select pg_temp.ok(pg_temp.err($q$select public.lookup_order('LH-9999', '+639170009999')$q$) = 'rate_limited',
  'Lookup is rate limited after 10 wrong guesses');
select pg_temp.ok(pg_temp.err($q$select public.lookup_order('LH-0002', '+639171111111')$q$) is null
  or pg_temp.err($q$select public.lookup_order('LH-0002', '+639171111111')$q$) = 'rate_limited',
  'Lookup guard does not crash for other codes');

-- preview
select pg_temp.ok((select office_date - (cutoff_at at time zone 'Asia/Manila')::date from public.current_batch_preview()) = 1,
  'Office delivery is the 2nd day after cutoff day (cutoff_at is the next midnight)');
reset role;

select pg_temp.ok((select count(*) from public.customers where phone = '+639171111111') = 1, 'Repeat customer stored once');
select pg_temp.ok((select bool_and(supplier_price is null) from public.order_items where product_name = 'Cheese Cake x1'), 'Unknown supplier price stays NULL on the order');
select pg_temp.ok(not exists (select 1 from information_schema.role_table_grants
                              where table_schema = 'private' and grantee in ('anon','authenticated')),
  'Secret table not granted to the public');

-- admin can permanently delete a CANCELLED order; its items go with it, other orders stay
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
create temp table gone as
  select id from public.orders where phone = '+639175555555' order by order_no limit 1;
update public.orders set status = 'cancelled' where id in (select id from gone);
delete from public.orders where id in (select id from gone) and status = 'cancelled';
select pg_temp.ok((select count(*) from public.order_items where order_id in (select id from gone)) = 0, 'Deleting an order removes its items');
select pg_temp.ok((select count(*) from public.orders where phone = '+639175555555') = 4, 'Only the cancelled order was deleted');
reset role;
set role anon;
select pg_temp.ok(pg_temp.err($q$delete from public.orders$q$) is not null, 'anon cannot delete orders');
reset role;

-- categories: anyone can read; only the admin can change; a product must use an existing one
set role anon;
select pg_temp.ok((select count(*) from public.categories) >= 7, 'anon can read categories');
select pg_temp.ok(pg_temp.err($q$insert into public.categories (name) values ('Hack')$q$) is not null, 'anon cannot add a category');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.com"}', false);
select pg_temp.ok(pg_temp.err($q$insert into public.categories (name) values ('Hack')$q$) is not null, 'non-admin cannot add a category');
select set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
insert into public.categories (name, sort_order) values ('Cakes', 50);
select pg_temp.ok(pg_temp.err($q$insert into public.categories (name) values ('cakes')$q$) is not null, 'category names are unique ignoring case');
select pg_temp.ok(pg_temp.err($q$update public.products set category = 'Nope' where slug = 'hopia-monggo-x10'$q$) is not null, 'product cannot use a category that does not exist');
update public.categories set name = 'Pastries' where name = 'Cakes';
update public.products set category = 'Pastries' where slug = 'cheese-cake-x1';
update public.categories set name = 'Bakes' where name = 'Pastries';
select pg_temp.ok((select category from public.products where slug = 'cheese-cake-x1') = 'Bakes', 'renaming a category renames it on its products');
select pg_temp.ok(pg_temp.err($q$delete from public.categories where name = 'Bakes'$q$) is not null, 'a category in use cannot be deleted');
update public.products set category = 'Hopia' where slug = 'cheese-cake-x1';
delete from public.categories where name = 'Bakes';
select pg_temp.ok(not exists (select 1 from public.categories where name = 'Bakes'), 'an unused category can be deleted');
reset role;

-- promo banners: customers see only live ones; only the admin can read the rest or change anything
reset role;
insert into public.promo_banners (headline, is_active) values ('Live now', true);
insert into public.promo_banners (headline, is_active) values ('Switched off', false);
insert into public.promo_banners (headline, ends_at) values ('Expired', now() - interval '1 hour');
insert into public.promo_banners (headline, starts_at) values ('Not yet', now() + interval '1 day');
set role anon;
select pg_temp.ok((select count(*) from public.promo_banners) = 1, 'anon only sees the live promo banner');
select pg_temp.ok(pg_temp.err($q$insert into public.promo_banners (headline) values ('Hack')$q$) is not null, 'anon cannot add a banner');
select pg_temp.ok(pg_temp.err($q$delete from public.promo_banners$q$) is not null, 'anon cannot delete banners');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
select pg_temp.ok((select count(*) from public.promo_banners) = 4, 'admin sees every banner');
select pg_temp.ok(pg_temp.err($q$insert into public.promo_banners (badge) values ('No content')$q$) is not null, 'a banner needs a headline or an image');
select pg_temp.ok(pg_temp.err($q$insert into public.promo_banners (headline, image_path) values ('x', '../secret.png')$q$) is not null, 'image path must stay inside banners/');
select pg_temp.ok(pg_temp.err($q$insert into public.promo_banners (headline, link_kind) values ('x', 'product')$q$) is not null, 'a link needs a target');
select pg_temp.ok(pg_temp.err($q$insert into public.promo_banners (headline, starts_at, ends_at) values ('x', now(), now() - interval '1 day')$q$) is not null, 'end must be after start');
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.com"}', false);
select pg_temp.ok((select count(*) from public.promo_banners) = 1, 'a non-admin login only sees the live banner');
select pg_temp.ok(pg_temp.err($q$update public.promo_banners set headline = 'Hacked'$q$) is null and not exists (select 1 from public.promo_banners where headline = 'Hacked'), 'a non-admin cannot edit banners');
reset role;

-- retention: personal details of old orders are anonymised, totals and items stay
update public.orders set created_at = now() - interval '200 days' where phone = '+639173333333';
update public.customers set created_at = now() - interval '200 days' where phone = '+639173333333';
select public.purge_old_data();
select pg_temp.ok((select count(*) from public.orders where name = 'Removed' and address = 'Removed' and total > 0) = 1,
  'Orders older than 180 days are anonymised but keep their total');
select pg_temp.ok((select count(*) from public.order_items i join public.orders o on o.id = i.order_id where o.name = 'Removed') > 0,
  'Items of anonymised orders are kept for sales history');
select pg_temp.ok(not exists (select 1 from public.orders where phone = '+639173333333'), 'The old phone number is gone');
select pg_temp.ok(not exists (select 1 from public.customers where phone = '+639173333333'), 'The old customer phone is gone');
select pg_temp.ok(not has_function_privilege('anon', 'public.purge_old_data()', 'execute'), 'anon cannot run purge_old_data');

\echo 'ALL M2 DATABASE TESTS PASSED'
