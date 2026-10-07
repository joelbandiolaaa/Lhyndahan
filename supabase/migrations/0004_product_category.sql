-- Product category (Hopia / Sweets, Crinkles, Polvoron, …) for grouping in the shop.
alter table public.products
  add column category text not null default 'Hopia / Sweets'
  check (length(trim(category)) between 1 and 40);
create index products_category_idx on public.products (category, sort_order);
