-- =====================================================================
-- Hopia Store — core schema
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Settings (exactly one row)
-- ---------------------------------------------------------------------
create table public.settings (
  id                  int primary key default 1 check (id = 1),
  admin_email         text not null default '',
  notify_email        text not null default '',
  gcash_qr_path       text,
  gcash_name          text,
  gcash_number        text,
  -- 0 = Sunday … 3 = Wednesday … 6 = Saturday (Asia/Manila)
  cutoff_dow          int  not null default 3 check (cutoff_dow between 0 and 6),
  cutoff_time         time not null default '23:59',
  -- delivery days counted from the cutoff day (Wed + 2 = Fri, Wed + 3 = Sat)
  office_offset_days  int  not null default 2 check (office_offset_days between 1 and 6),
  outside_offset_days int  not null default 3 check (outside_offset_days between 1 and 6),
  updated_at          timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------
create type public.bakery as enum ('Ribbonets', 'RSF Bakery', 'D'' Original', 'Edson Hopia Tipas');

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (length(trim(name)) between 1 and 120),
  bakery           public.bakery not null default 'Ribbonets',
  description      text not null default '',
  supplier_price   numeric(10,2) not null check (supplier_price >= 0),
  selling_price    numeric(10,2) not null check (selling_price >= 0),
  delivery_markup  numeric(10,2) not null default 10 check (delivery_markup >= 0),
  profit_per_piece numeric(10,2) generated always as (selling_price - delivery_markup - supplier_price) stored,
  is_active        boolean not null default false,
  sort_order       int not null default 0,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products on delete cascade,
  path        text not null,           -- object path inside the product-images bucket
  sort_order  int  not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);
create unique index product_images_one_primary on public.product_images (product_id) where is_primary;

-- ---------------------------------------------------------------------
-- Batches (one per weekly cycle; created on demand, never by a cron)
-- A batch covers [starts_at, cutoff_at). cutoff_at is the first instant
-- AFTER the cutoff minute, e.g. Wed 23:59 cutoff → Thu 00:00 Manila.
-- ---------------------------------------------------------------------
create table public.batches (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,      -- cutoff date, e.g. 2026-10-07
  starts_at           timestamptz not null,
  cutoff_at           timestamptz not null unique,
  office_date         date not null,
  outside_date        date not null,
  supplier_ordered_at timestamptz,
  created_at          timestamptz not null default now(),
  check (starts_at < cutoff_at)
);

-- ---------------------------------------------------------------------
-- Customers (built from orders, keyed by normalized phone)
-- ---------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique check (phone ~ '^\+639[0-9]{9}$'),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create type public.order_status   as enum ('pending', 'ordered', 'delivered', 'cancelled');
create type public.delivery_type  as enum ('office', 'outside');
create type public.payment_method as enum ('cod', 'gcash');

create sequence public.order_no_seq;

create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       int  not null unique default nextval('public.order_no_seq'),
  code           text generated always as (
                   'LH-' || case when order_no < 10000 then lpad(order_no::text, 4, '0') else order_no::text end
                 ) stored,
  batch_id       uuid not null references public.batches,
  customer_id    uuid not null references public.customers,
  name           text not null,
  phone          text not null check (phone ~ '^\+639[0-9]{9}$'),
  delivery_type  public.delivery_type not null,
  address        text not null check (length(trim(address)) >= 5),
  landmark       text not null check (length(trim(landmark)) >= 2),
  map_url        text,
  notes          text,
  delivery_date  date not null,
  payment_method public.payment_method not null,
  status         public.order_status not null default 'pending',
  paid           boolean not null default false,
  paid_at        timestamptz,
  ordered_at     timestamptz,
  delivered_at   timestamptz,
  cancelled_at   timestamptz,
  seen_by_admin  boolean not null default false,
  total          numeric(10,2) not null check (total >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter sequence public.order_no_seq owned by public.orders.order_no;
create unique index orders_code_idx on public.orders (code);
create index orders_batch_idx    on public.orders (batch_id, status);
create index orders_customer_idx on public.orders (customer_id, created_at desc);

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders on delete cascade,
  product_id      uuid references public.products on delete set null,
  -- snapshots: editing a product later never changes past orders or profit
  product_name    text not null,
  qty             int  not null check (qty between 1 and 99),
  selling_price   numeric(10,2) not null,
  supplier_price  numeric(10,2) not null,
  delivery_markup numeric(10,2) not null
);
create index order_items_order_idx on public.order_items (order_id);

-- Spam protection for order creation (written only by the server).
create table public.order_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index order_attempts_ip_idx on public.order_attempts (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger orders_touch   before update on public.orders   for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Batch logic
-- ---------------------------------------------------------------------
-- Returns the batch an order placed at `ts` belongs to, creating it if needed.
create or replace function public.get_or_create_batch(ts timestamptz default now())
returns public.batches
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.settings;
  b          public.batches;
  local_ts   timestamp := ts at time zone 'Asia/Manila';
  cutoff_day date;
  cutoff_end timestamptz;
  prev_end   timestamptz;
begin
  select * into b from public.batches where starts_at <= ts and ts < cutoff_at;
  if found then
    return b;
  end if;

  select * into s from public.settings where id = 1;

  -- next cutoff day on/after today (Manila)
  cutoff_day := local_ts::date + ((s.cutoff_dow - extract(dow from local_ts)::int + 7) % 7);
  cutoff_end := ((cutoff_day + s.cutoff_time) + interval '1 minute') at time zone 'Asia/Manila';
  if cutoff_end <= ts then
    cutoff_day := cutoff_day + 7;
    cutoff_end := cutoff_end + interval '7 days';
  end if;

  -- never overlap an earlier batch (matters only if the cutoff setting changed)
  select max(cutoff_at) into prev_end from public.batches where cutoff_at <= ts;

  insert into public.batches (code, starts_at, cutoff_at, office_date, outside_date)
  values (
    to_char(cutoff_day, 'YYYY-MM-DD'),
    greatest(cutoff_end - interval '7 days', coalesce(prev_end, '-infinity'::timestamptz)),
    cutoff_end,
    cutoff_day + s.office_offset_days,
    cutoff_day + s.outside_offset_days
  )
  on conflict do nothing;

  select * into b from public.batches where starts_at <= ts and ts < cutoff_at;
  if not found then
    raise exception 'Could not resolve batch for %', ts;
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------------
-- Admin check: the logged-in email must match settings.admin_email
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.settings
    where admin_email <> ''
      and lower(admin_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Non-secret settings the storefront needs.
create or replace function public.get_public_settings()
returns table (
  gcash_qr_path text, gcash_name text, gcash_number text,
  cutoff_dow int, cutoff_time time, office_offset_days int, outside_offset_days int
)
language sql
stable
security definer
set search_path = public
as $$
  select gcash_qr_path, gcash_name, gcash_number,
         cutoff_dow, cutoff_time, office_offset_days, outside_offset_days
  from public.settings where id = 1;
$$;
