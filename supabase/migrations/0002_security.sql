-- =====================================================================
-- Row Level Security + Storage
-- Default stance: nobody can do anything unless a policy says so.
-- The server (service role) bypasses RLS and is only used server-side.
-- =====================================================================

alter table public.settings       enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.batches        enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_attempts enable row level security;

-- Explicit table grants (newer Supabase projects don't add these automatically).
-- RLS below still decides which ROWS each role can see or change.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.products, public.product_images to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on public.order_attempts from authenticated;

-- Public storefront: only visible products and their images.
create policy products_public_read on public.products
  for select to anon, authenticated
  using (is_active and deleted_at is null);

create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.is_active and p.deleted_at is null
  ));

-- Admin: full access everywhere.
create policy settings_admin       on public.settings       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin       on public.products       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_admin on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy batches_admin        on public.batches        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy customers_admin      on public.customers      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_admin         on public.orders         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy order_items_admin    on public.order_items    for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- order_attempts: no policies → only the service role can touch it.

-- The admin may not change who the admin is from the app (prevents lock-out
-- and takeover); that is done in the SQL editor only.
create or replace function public.protect_admin_email() returns trigger
language plpgsql as $$
begin
  if new.admin_email is distinct from old.admin_email
     and current_user in ('authenticated', 'anon') then
    raise exception 'admin_email can only be changed in the Supabase SQL editor';
  end if;
  return new;
end $$;
create trigger settings_protect_admin before update on public.settings
  for each row execute function public.protect_admin_email();

-- Functions: lock down who may call what.
revoke execute on function public.get_or_create_batch(timestamptz) from public, anon, authenticated;
grant  execute on function public.get_or_create_batch(timestamptz) to service_role;
revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to anon, authenticated, service_role;
revoke execute on function public.get_public_settings() from public;
grant  execute on function public.get_public_settings() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Storage buckets (public read; only the admin can write)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('site',           'site',           true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Storage needs SELECT as well for delete/overwrite to work.
create policy storage_admin_select on storage.objects for select to authenticated
  using (bucket_id in ('product-images', 'site') and public.is_admin());
create policy storage_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('product-images', 'site') and public.is_admin());
create policy storage_admin_update on storage.objects for update to authenticated
  using (bucket_id in ('product-images', 'site') and public.is_admin());
create policy storage_admin_delete on storage.objects for delete to authenticated
  using (bucket_id in ('product-images', 'site') and public.is_admin());
