-- Supplier price can be unknown for now. NULL means "not set yet" (not ₱0),
-- so profit stays NULL instead of showing a fake number.
alter table public.products alter column supplier_price drop not null;
alter table public.order_items alter column supplier_price drop not null;
