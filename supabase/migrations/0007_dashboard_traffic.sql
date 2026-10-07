-- =====================================================================
-- Traffic tracking (privacy-friendly) + admin dashboard numbers
-- =====================================================================

-- One row per page view. visitor_id is a random id kept in the visitor's
-- browser: no cookies, no IP, no personal data.
create table public.page_views (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  visitor_id   text not null check (visitor_id ~ '^[a-z0-9-]{8,40}$'),
  path         text not null check (length(path) between 1 and 200),
  product_slug text,
  source       text not null default 'direct'
               check (source in ('facebook', 'messenger', 'instagram', 'google', 'direct', 'other'))
);
create index page_views_created_idx on public.page_views (created_at desc);
create index page_views_visitor_idx on public.page_views (visitor_id, path, created_at desc);
alter table public.page_views enable row level security;
create policy page_views_admin_read on public.page_views for select to authenticated using (public.is_admin());
grant select on public.page_views to authenticated;

-- Called by the shop in the browser. Ignores repeats of the same page by the
-- same visitor within 30 minutes, and caps total rows per day so a bot can't
-- fill the free database.
create or replace function public.track_view(p_visitor text, p_path text, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := left(coalesce(p_path, '/'), 200);
  v_slug text;
begin
  if p_visitor !~ '^[a-z0-9-]{8,40}$' then return; end if;
  if p_source not in ('facebook', 'messenger', 'instagram', 'google', 'direct', 'other') then p_source := 'other'; end if;
  if v_path like '/admin%' or v_path like '/api%' then return; end if;

  if exists (select 1 from public.page_views
             where visitor_id = p_visitor and path = v_path and created_at > now() - interval '30 minutes') then
    return;
  end if;
  if (select count(*) from public.page_views where visitor_id = p_visitor and created_at > now() - interval '1 day') >= 300 then
    return;
  end if;
  if (select count(*) from public.page_views where created_at > now() - interval '1 day') >= 20000 then
    return;
  end if;

  if v_path like '/p/%' then v_slug := split_part(substr(v_path, 4), '/', 1); end if;
  insert into public.page_views (visitor_id, path, product_slug, source) values (p_visitor, v_path, v_slug, p_source);
end $$;

-- ---------------------------------------------------------------------
-- Admin-only dashboard numbers for one batch (default: current batch)
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard(p_batch_id uuid default null, p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_batch public.batches;
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 90)));
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  out jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_batch_id is not null then
    select * into v_batch from public.batches where id = p_batch_id;
  else
    select * into v_batch from public.batches where starts_at <= now() and now() < cutoff_at;
  end if;

  with o as (
    select * from public.orders where batch_id = v_batch.id and status <> 'cancelled'
  ), i as (
    select i.* from public.order_items i join o on o.id = i.order_id
  )
  select jsonb_build_object(
    'batch', case when v_batch.id is null then null else to_jsonb(v_batch) end,
    'orders',            (select count(*) from o),
    'sales',             coalesce((select sum(total) from o), 0),
    'unpaid',            coalesce((select sum(total) from o where not paid), 0),
    'unpaid_orders',     (select count(*) from o where not paid),
    'profit_known',      coalesce((select sum((selling_price - delivery_markup - supplier_price) * qty) from i where supplier_price is not null), 0),
    'items_no_supplier', (select count(*) from i where supplier_price is null),
    'delivery_fund',     coalesce((select sum(delivery_markup * qty) from i), 0),
    'supplier_cost',     coalesce((select sum(supplier_price * qty) from i where supplier_price is not null), 0),
    'pieces',            coalesce((select sum(qty) from i), 0),
    'by_status',   (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.orders where batch_id = v_batch.id group by status) s),
    'by_delivery', (select coalesce(jsonb_object_agg(delivery_type, n), '{}') from (select delivery_type, count(*) n from o group by delivery_type) s),
    'by_payment',  (select coalesce(jsonb_object_agg(payment_method, n), '{}') from (select payment_method, count(*) n from o group by payment_method) s),
    'top_products', (select coalesce(jsonb_agg(t order by t.qty desc), '[]') from (
                       select product_name as name, sum(qty) as qty, sum(selling_price * qty) as sales
                       from i group by product_name order by sum(qty) desc limit 5) t),
    'new_orders',  (select count(*) from public.orders where not seen_by_admin),
    'repeat_customers', (select count(*) from (select customer_id from public.orders where status <> 'cancelled'
                                               group by customer_id having count(*) > 1) r),
    'traffic', jsonb_build_object(
      'days', greatest(1, least(p_days, 90)),
      'visitors_today', (select count(distinct visitor_id) from public.page_views where created_at >= v_today),
      'visitors',       (select count(distinct visitor_id) from public.page_views where created_at >= v_since),
      'views',          (select count(*) from public.page_views where created_at >= v_since),
      'orders',         (select count(*) from public.orders where created_at >= v_since and status <> 'cancelled'),
      'sources', (select coalesce(jsonb_agg(s order by s.visitors desc), '[]') from (
                    select source, count(distinct visitor_id) as visitors from public.page_views
                    where created_at >= v_since group by source) s),
      'top_viewed', (select coalesce(jsonb_agg(t order by t.views desc), '[]') from (
                       select pv.product_slug as slug, coalesce(p.name, pv.product_slug) as name, count(*) as views
                       from public.page_views pv left join public.products p on p.slug = pv.product_slug
                       where pv.created_at >= v_since and pv.product_slug is not null
                       group by pv.product_slug, p.name order by count(*) desc limit 5) t),
      'daily', (select coalesce(jsonb_agg(d order by d.day), '[]') from (
                  select to_char(gs.day, 'YYYY-MM-DD') as day,
                         (select count(distinct visitor_id) from public.page_views
                          where (created_at at time zone 'Asia/Manila')::date = gs.day) as visitors
                  from generate_series((now() at time zone 'Asia/Manila')::date - (greatest(1, least(p_days, 90)) - 1),
                                       (now() at time zone 'Asia/Manila')::date, interval '1 day') as gs(day)) d)
    )
  ) into out;
  return out;
end $$;

-- Per-product totals for the supplier order (non-cancelled orders only).
create or replace function public.batch_summary(p_batch_id uuid)
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
  group by i.product_name
  order by i.product_name;
$$;
