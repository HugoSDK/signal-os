-- Versioned writes for ledger_state.
--
-- The board is one JSON row per user, and any client used to be able to
-- overwrite it wholesale — including a tab still running an earlier build,
-- which upserted its (stale) copy on every change. From now on a save must
-- assert the row's next version: UPDATE … SET version = old + 1 WHERE
-- version = old. The trigger refuses anything else with HTTP 409 (PostgREST
-- maps SQLSTATE PTxxx to status xxx), so a client that doesn't speak the
-- protocol can't clobber the row; it has to reload into a build that does.
--
-- The guard only engages once the row has been saved by a versioned client
-- (version >= 1), so this migration can be applied before or after that
-- client is deployed without breaking saves in between. updated_at is
-- stamped by the server from here on.

alter table public.ledger_state
  add column if not exists version bigint not null default 0;

comment on column public.ledger_state.version is
  'Write token: a save must send exactly old.version + 1 (trigger ledger_state_guard, once version >= 1).';

create or replace function public.ledger_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version = old.version + 1 then
    -- Versioned save: the server stamps the time, so device clocks never matter.
    new.updated_at := now();
    return new;
  end if;
  if old.version = 0 and new.version = 0 then
    -- No versioned client has saved this row yet: let earlier builds through.
    new.updated_at := now();
    return new;
  end if;
  raise sqlstate 'PT409' using
    message = 'ledger_state: stale write rejected',
    detail  = format('row is at version %s, write asserted %s', old.version, new.version),
    hint    = 'Reload the app to get the current build, then retry.';
end
$$;

create or replace trigger ledger_state_guard
  before update on public.ledger_state
  for each row execute function public.ledger_state_guard();

-- Let PostgREST pick up the new column right away.
notify pgrst, 'reload schema';
