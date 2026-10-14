-- The batch summary is the supplier order, so it must only count the orders you still need to order.
-- batch_summary_by_status picks which order statuses are included. Cancelled is never included.
-- batch_summary(uuid) keeps working and now means "what still has to be ordered" (Pending + Ordered).
create or replace function public.batch_summary_by_status(p_batch_id uuid, p_statuses text[])
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
  where public.is_admin() and o.batch_id = p_batch_id
    and o.status <> 'cancelled'
    and o.status::text = any (p_statuses)
  group by i.product_name
  order by i.product_name;
$$;
revoke execute on function public.batch_summary_by_status(uuid, text[]) from public, anon;
grant  execute on function public.batch_summary_by_status(uuid, text[]) to authenticated;

create or replace function public.batch_summary(p_batch_id uuid)
returns table (product_name text, qty bigint, supplier_price numeric, supplier_cost numeric, sales numeric)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.batch_summary_by_status(p_batch_id, array['pending', 'ordered']);
$$;
revoke execute on function public.batch_summary(uuid) from public, anon;
grant  execute on function public.batch_summary(uuid) to authenticated;
