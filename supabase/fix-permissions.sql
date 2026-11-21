-- Run this once in Supabase → SQL Editor if the app says
-- "Couldn't load your budget" right after signing in.
-- It lets logged-in users reach the tables; the privacy rules in
-- schema.sql still limit them to their own household's data.

grant usage on schema public to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.receipts to authenticated;
grant execute on function public.is_member(uuid) to authenticated;

-- Quick health check: you should see 3 rows, one per table.
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('households', 'household_members', 'receipts');
