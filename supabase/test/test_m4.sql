-- Assertions for M4: the live schedule (cutoff Wednesday 6:00 AM, KUS Friday, My address Saturday).
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', label; else raise exception 'FAIL  %', label; end if;
end $$;

update public.settings set cutoff_dow = 3, cutoff_time = '06:00', office_offset_days = 2, outside_offset_days = 3;

-- 2027-03-02 is a Tuesday, 03-03 a Wednesday.
select pg_temp.ok((select cutoff_at from public.get_or_create_batch('2027-03-02 20:00+08')) = '2027-03-03 06:01+08', 'Cutoff is Wednesday 6:00 AM');
select pg_temp.ok((select office_date from public.get_or_create_batch('2027-03-02 20:00+08')) = '2027-03-05', 'KUS delivery is that Friday');
select pg_temp.ok((select outside_date from public.get_or_create_batch('2027-03-02 20:00+08')) = '2027-03-06', 'My address delivery is that Saturday');
select pg_temp.ok((select code from public.get_or_create_batch('2027-03-03 06:00:30+08')) = '2027-03-03', 'Wednesday 6:00 AM is still in time');
select pg_temp.ok((select code from public.get_or_create_batch('2027-03-03 06:01:30+08')) = '2027-03-10', 'Wednesday after 6 AM goes to the next batch');
select pg_temp.ok((select starts_at from public.batches where code = '2027-03-10') = (select cutoff_at from public.batches where code = '2027-03-03'), 'Batches stay contiguous');

\o
\echo ALL M4 DATABASE TESTS PASSED
