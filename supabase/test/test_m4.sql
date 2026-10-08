-- Assertions for M4: separate cutoffs (KUS Tue 3:00 PM -> Fri, My address Wed 3:00 PM -> Sat).
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if;
end $$;

update public.settings set cutoff_dow = 3, cutoff_time = '15:00', office_cutoff_dow = 2, office_cutoff_time = '15:00',
  office_offset_days = 3, outside_offset_days = 3;

-- 2027-03-01 is a Monday, 03-02 Tuesday, 03-03 Wednesday.
select pg_temp.ok((select office_date from public.order_batch('office', '2027-03-01 10:00+08')) = '2027-03-05', 'Monday KUS order -> this Friday');
select pg_temp.ok((select outside_date from public.order_batch('outside', '2027-03-01 10:00+08')) = '2027-03-06', 'Monday address order -> this Saturday');
select pg_temp.ok((select office_cutoff_at from public.get_or_create_batch('2027-03-01 10:00+08')) = '2027-03-02 15:01+08', 'KUS cutoff is Tuesday 3:00 PM');
select pg_temp.ok((select cutoff_at from public.get_or_create_batch('2027-03-01 10:00+08')) = '2027-03-03 15:01+08', 'Address cutoff is Wednesday 3:00 PM');

select pg_temp.ok((select office_date from public.order_batch('office', '2027-03-02 15:00:30+08')) = '2027-03-05', 'Tuesday 3:00 PM is still in time for KUS');
select pg_temp.ok((select office_date from public.order_batch('office', '2027-03-02 15:01:30+08')) = '2027-03-12', 'Tuesday after 3 PM KUS order -> NEXT Friday');
select pg_temp.ok((select outside_date from public.order_batch('outside', '2027-03-02 15:01:30+08')) = '2027-03-06', 'Tuesday after 3 PM address order -> still this Saturday');
select pg_temp.ok((select outside_date from public.order_batch('outside', '2027-03-03 15:00:30+08')) = '2027-03-06', 'Wednesday 3:00 PM is still in time for address delivery');
select pg_temp.ok((select outside_date from public.order_batch('outside', '2027-03-03 15:01:30+08')) = '2027-03-13', 'Wednesday after 3 PM address order -> NEXT Saturday');
select pg_temp.ok((select office_date from public.order_batch('office', '2027-03-03 15:01:30+08')) = '2027-03-12', 'Wednesday after 3 PM KUS order -> next Friday');
select pg_temp.ok((select count(*) from public.batches where code in ('2027-03-03', '2027-03-10')) = 2, 'Exactly one batch per week, no duplicates');

-- shop preview (read-only): Tuesday 4 PM
select pg_temp.ok((select office_date from public.current_batch_preview('2027-03-02 16:00+08')) = '2027-03-12', 'Preview: KUS shows next Friday after its cutoff');
select pg_temp.ok((select outside_date from public.current_batch_preview('2027-03-02 16:00+08')) = '2027-03-06', 'Preview: address still shows this Saturday');
select pg_temp.ok((select office_cutoff_at from public.current_batch_preview('2027-03-02 16:00+08')) = '2027-03-09 15:01+08', 'Preview: next KUS cutoff is next Tuesday 3 PM');
-- far future: preview works without creating anything
select pg_temp.ok((select count(*) from public.current_batch_preview('2027-09-01 10:00+08')) = 1, 'Preview works for a week with no batch yet');
select pg_temp.ok(not exists (select 1 from public.batches where code like '2027-09%'), 'Preview does not create batches');

-- Option B (one Tuesday cutoff for both) is just a setting change
update public.settings set cutoff_dow = 2, office_cutoff_dow = 2, office_offset_days = 3, outside_offset_days = 4;
select pg_temp.ok((select outside_date from public.order_batch('outside', '2027-04-05 10:00+08')) = '2027-04-10', 'Single-cutoff setup: Saturday delivery, Tuesday cutoff');
select pg_temp.ok((select office_cutoff_at = cutoff_at from public.get_or_create_batch('2027-04-05 10:00+08')), 'Single-cutoff setup: both cutoffs coincide');

select pg_temp.ok(not exists (select 1 from information_schema.routine_privileges
  where routine_name in ('plan_batch','order_batch','get_or_create_batch') and grantee in ('anon','authenticated','PUBLIC')),
  'Batch helpers are not callable by the public');

\o
\echo ALL M4 DATABASE TESTS PASSED
