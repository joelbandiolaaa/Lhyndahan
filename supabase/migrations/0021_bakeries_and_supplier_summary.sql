-- Each bakery is a separate supplier order, so the supplier summary is split per bakery.
-- Two more bakeries joined the list (products pick one on the product form).
alter type public.bakery add value if not exists 'Sweet Cassie''s';
alter type public.bakery add value if not exists 'Momsue';

-- Same totals as batch_summary_by_status, one block per bakery (bakery comes from the product; unknown = 'Other').
create or replace function public.batch_supplier_summary(p_batch_id uuid, p_statuses text[])
returns table (bakery text, product_name text, qty bigint, supplier_price numeric, supplier_cost numeric, sales numeric)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.bakery::text, 'Other'), i.product_name, sum(i.qty), max(i.supplier_price),
         sum(i.supplier_price * i.qty), sum(i.selling_price * i.qty)
  from public.order_items i
  join public.orders o on o.id = i.order_id
  left join public.products p on p.id = i.product_id
  where public.is_admin() and o.batch_id = p_batch_id
    and o.status <> 'cancelled'
    and o.status::text = any (p_statuses)
  group by 1, i.product_name
  order by 1, i.product_name;
$$;
revoke execute on function public.batch_supplier_summary(uuid, text[]) from public, anon;
grant  execute on function public.batch_supplier_summary(uuid, text[]) to authenticated;
