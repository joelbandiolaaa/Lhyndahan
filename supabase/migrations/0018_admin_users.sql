-- More than one admin login. The owner stays in settings.admin_email (only changeable in the SQL editor);
-- extra admins (e.g. a spouse) live in admin_users and are added/removed by the owner from Settings.
-- Everyone has their OWN login, so a person can be removed without changing anyone else's password.

create table public.admin_users (
  email      text primary key check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+$' and length(email) <= 120),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Admins can see who the admins are; nobody can write from the browser (only the server's service role).
create policy admin_users_read on public.admin_users for select to authenticated using (public.is_admin());
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

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
  ) or exists (
    select 1 from public.admin_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
