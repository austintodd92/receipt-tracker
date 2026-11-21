-- =====================================================================
-- Dining Tracker — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.
-- =====================================================================

-- One shared budget ("household") that both parents belong to.
create table if not exists public.households (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default 'Home',
  monthly_budget  numeric(10,2) not null default 400,
  created_at      timestamptz not null default now()
);

-- Who is in the household (the two parent logins).
create table if not exists public.household_members (
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  display_name  text not null default '',
  primary key (household_id, user_id)
);

-- Every eating-out receipt. "total" already includes the tip.
create table if not exists public.receipts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id),
  restaurant    text not null default '',
  total         numeric(10,2) not null check (total >= 0),
  spent_on      date not null default current_date,
  created_at    timestamptz not null default now()
);

create index if not exists receipts_household_date_idx
  on public.receipts (household_id, spent_on);

-- ---------------------------------------------------------------------
-- Access rules (Row Level Security): a logged-in user can only see and
-- change data for households they are a member of. Nobody else can.
-- ---------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.receipts          enable row level security;

-- Helper: is the current user a member of this household?
-- (security definer avoids a policy loop on household_members)
create or replace function public.is_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;

-- households: members can read and update (to change the budget)
drop policy if exists "members read household"   on public.households;
drop policy if exists "members update household" on public.households;
create policy "members read household" on public.households
  for select to authenticated using (public.is_member(id));
create policy "members update household" on public.households
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

-- household_members: members can see who else is in their household
drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select to authenticated using (public.is_member(household_id));

-- receipts: members can read, add, edit and delete their household's receipts
drop policy if exists "members read receipts"   on public.receipts;
drop policy if exists "members add receipts"    on public.receipts;
drop policy if exists "members edit receipts"   on public.receipts;
drop policy if exists "members delete receipts" on public.receipts;
create policy "members read receipts" on public.receipts
  for select to authenticated using (public.is_member(household_id));
create policy "members add receipts" on public.receipts
  for insert to authenticated
  with check (public.is_member(household_id) and user_id = auth.uid());
create policy "members edit receipts" on public.receipts
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "members delete receipts" on public.receipts
  for delete to authenticated using (public.is_member(household_id));

-- No access at all for logged-out visitors.
revoke all on public.households, public.household_members, public.receipts from anon;
