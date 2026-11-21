-- =====================================================================
-- Run this AFTER you have created both parent logins in
-- Supabase → Authentication → Users → "Add user" (email + password,
-- tick "Auto confirm user").
--
-- 1. Replace the two emails, names and the budget below.
-- 2. Paste into SQL Editor → Run.
-- =====================================================================

with h as (
  insert into public.households (name, monthly_budget)
  values ('Mom & Dad', 400)          -- ← monthly eating-out budget in dollars
  returning id
)
insert into public.household_members (household_id, user_id, display_name)
select h.id, u.id, v.display_name
from h
cross join (values
  ('mom@example.com', 'Mom'),        -- ← parent 1 email, name
  ('dad@example.com', 'Dad')         -- ← parent 2 email, name
) as v(email, display_name)
join auth.users u on lower(u.email) = lower(v.email);

-- Check: this should list both parents.
select m.display_name, u.email, h.monthly_budget
from public.household_members m
join auth.users u on u.id = m.user_id
join public.households h on h.id = m.household_id;
