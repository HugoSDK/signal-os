-- Signal Ledger schema: per-user state blob + period history archive.
-- All tables are RLS-protected so each user can only touch their own rows.

-- ledger_state: one row per user holding the entire app state (mirrors the
-- localStorage blob). Includes the `days` map, so streak history is durable.
create table if not exists public.ledger_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ledger_state enable row level security;

create policy "ledger_state_select" on public.ledger_state
  for select using (auth.uid() = user_id);
create policy "ledger_state_insert" on public.ledger_state
  for insert with check (auth.uid() = user_id);
create policy "ledger_state_update" on public.ledger_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ledger_state_delete" on public.ledger_state
  for delete using (auth.uid() = user_id);

-- period_archive: snapshots of past weeks/months for rollover history.
create table if not exists public.period_archive (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  period_tag  text not null,            -- e.g. '2026-W27' or '2026-07'
  snapshot    jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default now(),
  unique (user_id, period_type, period_tag)
);

alter table public.period_archive enable row level security;

create policy "period_archive_select" on public.period_archive
  for select using (auth.uid() = user_id);
create policy "period_archive_insert" on public.period_archive
  for insert with check (auth.uid() = user_id);
create policy "period_archive_update" on public.period_archive
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "period_archive_delete" on public.period_archive
  for delete using (auth.uid() = user_id);

create index if not exists period_archive_user_type_idx
  on public.period_archive (user_id, period_type, archived_at desc);
