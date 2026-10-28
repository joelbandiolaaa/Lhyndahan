-- Assertions for traffic + dashboard. Runs after test_m2.sql.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if; end $$;
create or replace function pg_temp.err(stmt text) returns text language plpgsql as $$
begin execute stmt; return null; exception when others then return sqlerrm; end $$;

update public.settings set admin_email = 'april@example.com' where id = 1;

set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select public.track_view('visitor-aaaa1111', '/', 'facebook');
select public.track_view('visitor-aaaa1111', '/', 'facebook');          -- duplicate, ignored
select public.track_view('visitor-aaaa1111', '/p/hopia-monggo-x10', 'facebook');
select public.track_view('visitor-bbbb2222', '/p/hopia-monggo-x10', 'direct');
select public.track_view('visitor-bbbb2222', '/admin', 'direct');      -- admin pages ignored
select public.track_view('BAD ID!', '/', 'direct');                    -- invalid id ignored
select pg_temp.ok(pg_temp.err($q$select count(*) from public.page_views$q$) is not null, 'anon cannot read page views (no privilege)');
select pg_temp.ok(pg_temp.err($q$select public.admin_dashboard()$q$) = 'forbidden', 'anon cannot read the dashboard');
reset role;
select pg_temp.ok((select count(*) from public.page_views) = 3, 'Views recorded, duplicates/admin/invalid ignored');

set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
create temp table d as select public.admin_dashboard() as j;
select pg_temp.ok((select (j->>'orders')::int from d) >= 1, 'Dashboard counts this batch''s orders');
select pg_temp.ok((select (j->'traffic'->>'visitors')::int from d) = 2, 'Dashboard counts unique visitors');
select pg_temp.ok((select j->'traffic'->'top_viewed'->0->>'name' from d) = 'Hopia Monggo x10', 'Top viewed product has its name');
select pg_temp.ok((select (j->>'unpaid')::numeric from d) = (select (j->>'sales')::numeric from d), 'Nothing paid yet: unpaid = sales');
select pg_temp.ok((select count(*) from public.batch_summary((select (j->'batch'->>'id')::uuid from d))) >= 1, 'Batch summary returns product totals');
-- each order status against the supplier summary: only what still has to be ordered is counted
create temp table sumb as select coalesce(sum(qty), 0) as q from public.batch_summary((select (j->'batch'->>'id')::uuid from d));
create or replace function pg_temp.sum_for(st text, picks text[] default null) returns bigint language plpgsql as $f$
declare bid uuid; r bigint;
begin
  select (j->'batch'->>'id')::uuid into bid from d;
  reset role;
  update public.orders set status = st::public.order_status where batch_id = bid;
  set role authenticated;
  perform set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
  if picks is null then select coalesce(sum(qty), 0) into r from public.batch_summary(bid);
  else select coalesce(sum(qty), 0) into r from public.batch_summary_by_status(bid, picks); end if;
  return r;
end $f$;
select pg_temp.ok(pg_temp.sum_for('pending') = (select q from sumb), 'Pending orders are on the supplier summary');
select pg_temp.ok(pg_temp.sum_for('ordered') = (select q from sumb), 'Ordered orders are on it by default');
select pg_temp.ok(pg_temp.sum_for('delivered') = 0, 'Completed orders are left off by default');
select pg_temp.ok(pg_temp.sum_for('cancelled') = 0, 'Cancelled orders are left off by default');
select pg_temp.ok(pg_temp.sum_for('cancelled', array['pending','ordered','delivered','cancelled']) = 0, 'Cancelled orders are never counted, even if asked');
select pg_temp.ok(pg_temp.sum_for('delivered', array['delivered']) = (select q from sumb), 'Completed can be shown on its own');
select pg_temp.ok(pg_temp.sum_for('ordered', array['pending']) = 0, 'Pending-only leaves out Ordered orders');
select pg_temp.ok(pg_temp.sum_for('pending', array['pending']) = (select q from sumb), 'Pending-only counts Pending orders');
reset role;
update public.orders set status = 'pending' where batch_id = (select (j->'batch'->>'id')::uuid from d);

-- supplier summary split per bakery adds up to the same totals
select pg_temp.ok((select coalesce(sum(qty), 0) from public.batch_supplier_summary((select (j->'batch'->>'id')::uuid from d), array['pending','ordered'])) =
                  (select coalesce(sum(qty), 0) from public.batch_summary_by_status((select (j->'batch'->>'id')::uuid from d), array['pending','ordered'])), 'Per-bakery supplier summary adds up to the same pieces');
select pg_temp.ok((select count(*) from public.batch_supplier_summary((select (j->'batch'->>'id')::uuid from d), array['pending','ordered']) where bakery is null) = 0, 'Every line has a bakery');

-- moving an order into another batch (late order squeezed into the batch that just closed)
reset role;
create temp table mv as
  select o.id as oid, o.batch_id as home, o.delivery_type as dt, o.delivery_date as d0,
         (select id from public.batches where id <> o.batch_id order by cutoff_at limit 1) as other
  from public.orders o order by o.created_at limit 1;
grant select on mv to authenticated, anon;
update mv set other = (select (public.get_or_create_batch(now() + interval '8 days')).id) where other is null;
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
select public.move_order_to_batch((select oid from mv), (select other from mv));
select pg_temp.ok((select batch_id from public.orders where id = (select oid from mv)) = (select other from mv), 'Order moved into the other batch');
select pg_temp.ok((select delivery_date from public.orders o where o.id = (select oid from mv)) =
  (select case when (select dt from mv) = 'office' then b.office_date else b.outside_date end from public.batches b where b.id = (select other from mv)), 'Delivery date follows the new batch and the order''s delivery type');
select pg_temp.ok((select moved_from_batch_id from public.orders where id = (select oid from mv)) = (select home from mv), 'Remembers the batch it came from');
select pg_temp.ok((select count(*) from public.batch_summary_by_status((select other from mv), array['pending'])) >= 1, 'Moved order counts in the new batch summary');
select public.move_order_to_batch((select oid from mv), (select home from mv));
select pg_temp.ok((select moved_from_batch_id from public.orders where id = (select oid from mv)) is null, 'Moving it back home clears the moved flag');
select pg_temp.ok((select delivery_date from public.orders where id = (select oid from mv)) = (select d0 from mv), 'Moving it back restores the original delivery date');
reset role;
update public.orders set status = 'delivered' where id = (select oid from mv);
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"april@example.com"}', false);
select pg_temp.ok(pg_temp.err(format('select public.move_order_to_batch(%L, %L)', (select oid from mv), (select other from mv))) = 'not_movable', 'Completed orders cannot be moved');
reset role;
update public.orders set status = 'pending' where id = (select oid from mv);

set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.com"}', false);
select pg_temp.ok(pg_temp.err($q$select public.admin_dashboard()$q$) = 'forbidden', 'stranger cannot read the dashboard');
select pg_temp.ok((select count(*) from public.batch_summary(gen_random_uuid())) = 0, 'stranger gets no batch summary');
select pg_temp.ok(pg_temp.err(format('select public.move_order_to_batch(%L, %L)', (select oid from mv), (select other from mv))) = 'forbidden', 'stranger cannot move orders');
reset role;
\echo 'ALL M3 DATABASE TESTS PASSED'
