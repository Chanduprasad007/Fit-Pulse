create table if not exists public.workout_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_workout_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists workout_states_set_updated_at on public.workout_states;

create trigger workout_states_set_updated_at
before update on public.workout_states
for each row
execute function public.set_workout_states_updated_at();

alter table public.workout_states enable row level security;

drop policy if exists "Users can read their own workout state" on public.workout_states;
create policy "Users can read their own workout state"
on public.workout_states
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can insert their own workout state" on public.workout_states;
create policy "Users can insert their own workout state"
on public.workout_states
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can update their own workout state" on public.workout_states;
create policy "Users can update their own workout state"
on public.workout_states
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can delete their own workout state" on public.workout_states;
create policy "Users can delete their own workout state"
on public.workout_states
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
