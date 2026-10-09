-- Promo banners: the sliding cards at the top of the shop (an image, a text card, or both).
-- The owner adds/edits them in /admin/promos; customers only ever see the live ones.

create table public.promo_banners (
  id         uuid primary key default gen_random_uuid(),
  badge      text check (badge is null or length(trim(badge)) between 1 and 24),
  headline   text check (headline is null or length(trim(headline)) between 1 and 60),
  subtext    text check (subtext is null or length(trim(subtext)) between 1 and 140),
  image_path text check (image_path is null or (image_path like 'banners/%' and image_path !~ '\.\.' and length(image_path) <= 200)),
  bg         text not null default 'red' check (bg in ('red', 'dark', 'cream', 'green')),
  link_kind  text not null default 'none' check (link_kind in ('none', 'category', 'product')),
  link_value text check (link_value is null or length(link_value) between 1 and 120),
  starts_at  timestamptz,
  ends_at    timestamptz,
  is_active  boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  check (headline is not null or image_path is not null),
  check (link_kind = 'none' or link_value is not null),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

alter table public.promo_banners enable row level security;
-- Anyone can read a banner only while it is switched on and inside its dates.
create policy promo_banners_public_read on public.promo_banners for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy promo_banners_admin on public.promo_banners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.promo_banners from anon, authenticated;
grant select on public.promo_banners to anon, authenticated;
grant insert, update, delete on public.promo_banners to authenticated;
