create table if not exists public.finance_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_states enable row level security;

drop policy if exists "Users can read own finance state" on public.finance_states;
create policy "Users can read own finance state"
on public.finance_states
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own finance state" on public.finance_states;
create policy "Users can insert own finance state"
on public.finance_states
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own finance state" on public.finance_states;
create policy "Users can update own finance state"
on public.finance_states
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

