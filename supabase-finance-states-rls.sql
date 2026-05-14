-- Seguridad para la tabla de nube usada por Finanzas Casa.
-- Esto NO cambia el login de la app. Solo protege los datos cuando usas la seccion Nube con Supabase.
-- Ejecutar en Supabase > SQL Editor.

create table if not exists public.finance_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_states enable row level security;

drop policy if exists "finance_states_select_own" on public.finance_states;
create policy "finance_states_select_own"
on public.finance_states
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance_states_insert_own" on public.finance_states;
create policy "finance_states_insert_own"
on public.finance_states
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "finance_states_update_own" on public.finance_states;
create policy "finance_states_update_own"
on public.finance_states
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update on public.finance_states to authenticated;
