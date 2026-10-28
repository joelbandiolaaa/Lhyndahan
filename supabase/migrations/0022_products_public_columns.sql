-- The shop only needs a product's public fields. Cost, profit, markup and bakery are admin-only:
-- anonymous visitors (anyone with the public key) can no longer read them through the API.
-- is_active / deleted_at stay readable because the row-level policies use them.
revoke select on public.products from anon;
grant select (id, slug, name, description, selling_price, category, sort_order, is_active, deleted_at) on public.products to anon;
