-- Banco online do Gestão de Lojas
-- Execute este arquivo no Supabase > SQL Editor > New query > Run

create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

revoke all on table public.app_state from anon;
grant select, insert, update, delete on table public.app_state to authenticated;

create policy "Ler apenas os próprios dados"
on public.app_state
for select
to authenticated
using (auth.uid() = user_id);

create policy "Criar apenas os próprios dados"
on public.app_state
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Atualizar apenas os próprios dados"
on public.app_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Excluir apenas os próprios dados"
on public.app_state
for delete
to authenticated
using (auth.uid() = user_id);
