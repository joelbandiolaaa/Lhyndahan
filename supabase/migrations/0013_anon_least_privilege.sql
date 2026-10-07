-- The public (anon) role only needs to read the storefront tables. Everything else goes
-- through SECURITY DEFINER functions, so remove every other privilege as a second lock
-- behind row level security.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.products, public.product_images, public.payment_qrs to anon;
