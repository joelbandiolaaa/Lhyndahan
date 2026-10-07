-- Managed product categories. The admin adds/renames/reorders them; a product must use one that exists.
--  * "Hopia / Sweets" becomes "Hopia"; "Bread" is new
--  * products.category references categories.name (rename follows automatically, delete is blocked while in use)

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) between 1 and 40),
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_name_ci_key on public.categories (lower(name));

alter table public.categories enable row level security;
create policy categories_read  on public.categories for select to anon, authenticated using (true);
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

insert into public.categories (name, sort_order) values
  ('Hopia', 0), ('Bread', 1), ('Sweet Cassie', 2), ('Crinkles', 3), ('Polvoron', 4), ('Cheesecake', 5), ('Cheese Bulilit', 6);

update public.products set category = 'Hopia' where category = 'Hopia / Sweets';

-- Anything else already in use must stay valid.
insert into public.categories (name, sort_order)
select c, 100 + row_number() over (order by c)
from (select distinct category c from public.products) s
where not exists (select 1 from public.categories k where lower(k.name) = lower(s.c));

alter table public.products alter column category set default 'Hopia';
alter table public.products add constraint products_category_fkey
  foreign key (category) references public.categories (name) on update cascade on delete restrict;
