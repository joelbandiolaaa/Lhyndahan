-- Shop schedule: one cutoff for all products and both deliveries.
--   Wednesday 6:00 AM  orders close and the order goes to the supplier
--   Friday    6:00 AM  pickup
--   Friday = KUS delivery, Saturday = "My address" delivery
update public.settings set cutoff_dow = 3, cutoff_time = '06:00', office_offset_days = 2, outside_offset_days = 3 where id = 1;

-- A batch that is still open follows the new cutoff (its code is its cutoff date).
update public.batches
   set cutoff_at = ((code::date + time '06:00') + interval '1 minute') at time zone 'Asia/Manila'
 where cutoff_at > now();
