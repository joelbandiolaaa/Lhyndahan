-- Late orders: an order placed just after a cutoff lands in the next batch. If the owner can still
-- squeeze it into the batch that just closed, this moves it there (and to that batch's delivery date).
-- moved_from_batch_id remembers where it came from (null = never moved, or moved back home).
alter table public.orders add column moved_from_batch_id uuid references public.batches;

create or replace function public.move_order_to_batch(p_order_id uuid, p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_batch public.batches;
  v_date date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.status not in ('pending', 'ordered') then raise exception 'not_movable'; end if;

  select * into v_batch from public.batches where id = p_batch_id;
  if not found then raise exception 'batch_not_found'; end if;

  v_date := case when v_order.delivery_type = 'office' then v_batch.office_date else v_batch.outside_date end;

  update public.orders
  set batch_id = v_batch.id,
      delivery_date = v_date,
      moved_from_batch_id = case
        when v_order.moved_from_batch_id = v_batch.id then null           -- moved back home
        else coalesce(v_order.moved_from_batch_id, v_order.batch_id)      -- remember the first home
      end
  where id = v_order.id;

  return jsonb_build_object('code', v_order.code, 'delivery_date', v_date, 'batch_code', v_batch.code,
                            'supplier_ordered', v_batch.supplier_ordered_at is not null);
end $$;
revoke execute on function public.move_order_to_batch(uuid, uuid) from public, anon;
grant  execute on function public.move_order_to_batch(uuid, uuid) to authenticated;
