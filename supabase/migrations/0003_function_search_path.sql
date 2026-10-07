-- Hardening flagged by the Supabase security advisor: pin search_path on
-- trigger functions so they can't be tricked by a malicious schema.
alter function public.touch_updated_at() set search_path = public;
alter function public.protect_admin_email() set search_path = public;
