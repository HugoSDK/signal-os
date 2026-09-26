# Signal Ledger

A personal daily/weekly/monthly planning app — daily reps with streaks, a
revenue tracker, weekly focus + review, and monthly milestones + check-in.
Data syncs across browsers/devices via Supabase.

> Rebuilt from a single-file visual-builder export into maintainable
> Vite + React + TypeScript source. The original export is kept at
> [`reference/signal-ledger.export.html`](reference/signal-ledger.export.html)
> for visual parity.

## Features

- **Cross-device sync** — sign in with a magic link; your ledger is stored in
  Supabase and loads on any browser/device. Saves are versioned and merged, so
  two open devices never overwrite each other (see [Sync](#sync)).
- **Forever streaks** — daily "One Lead / One Post" history lives server-side,
  so streaks are never lost when a browser is cleared. (The streak count itself
  is unbounded; the dot row shows the last 14 days.)
- **Shopping list** — panel 05 on Today, under MONTH. Items stay across days
  (they're not cleared by the daily rollover or archived with the month);
  tick them off as you buy them and **CLEAR BOUGHT** removes the ticked ones.
  Syncs and merges by item like the other lists.
- **Period rollover** — at the start of a new week/month, a prompt offers to
  **archive** the previous period (kept in history) and start fresh, or carry it
  over.

## Local development

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + publishable key
npm run dev            # http://localhost:5173
npm test               # merge + loss-check unit tests (node --test)
```

The app also has safe public fallbacks for the Supabase config in
`src/lib/supabase.ts`, so it runs even without a `.env`.

### Environment variables

| Variable | Notes |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key — safe in the browser; **RLS** protects data |

## Database

Supabase project **`signal-ledger`** (`tpodyjdynyexcgnlcsts`).
Schema is in [`supabase/migrations/`](supabase/migrations/), applied in order
through the Supabase MCP / SQL editor:

- `0001_init.sql` — `ledger_state`: one row per user (`user_id`, `data jsonb`,
  `updated_at`); the full app state, including daily history. `period_archive`:
  snapshots of past weeks/months (`period_type`, `period_tag`, `snapshot jsonb`).
- `0002_ledger_state_version.sql` — adds `ledger_state.version` and the
  `ledger_state_guard` trigger (see [Sync](#sync)).

Both tables have **Row-Level Security**: every row is scoped to `auth.uid()`.

## Sync

The whole board is one JSON row per user, so two open devices race to
overwrite each other. `src/lib/sync.ts` keeps them consistent:

- **Versioned writes.** Every save asserts the row's next version
  (`UPDATE … SET version = base + 1 WHERE version = base AND updated_at = …`).
  A save that matches nothing lost the race: the engine pulls the newer board,
  three-way merges it with this device's edits (`src/lib/merge.ts`: per day,
  per month, by item id for lists) and retries. `updated_at` is stamped by the
  server, so device clocks never decide anything.
- **Server guard.** The `ledger_state_guard` trigger refuses any update that
  doesn't assert `old.version + 1` with HTTP 409, so a client that doesn't
  speak the protocol — a tab still running an earlier build, which used to
  upsert its whole (stale) copy on any change — can no longer overwrite the
  row. The guard engages the first time a versioned client saves the row, so
  the migration can be applied before or after that client is deployed.
  **After deploying, reload every open Ledger tab on every device once**;
  until then an old tab's saves are rejected (its edits stay in that tab's
  localStorage and are merged in when it reloads).
- **Another device's save is folded into the open page.** When a tab is shown
  or focused it pulls the row; a newer board is merged into the page in place
  (edits made here meanwhile are kept), so nothing remounts and open modals or
  drafts survive. The tab that is open and the drafts being typed never
  follow another device.
- **Stale tabs retire themselves.** When a tab is shown or focused it checks
  (at most once a minute) whether the site is serving a newer build than the
  one it runs, flushes pending edits and reloads (`src/lib/build.ts`). Unsent
  edits survive a reload: they're kept in localStorage and merged in on the
  next open.
  Restoring merges the copy over anything saved since and pushes it as a new
  version; the board it replaced becomes an **UNDO RESTORE** slot, and either
  can be dismissed.

## Deploy

Any static host works (`npm run build` → `dist/`). Two easy options:

- **Vercel** — framework auto-detected as Vite; build `npm run build`, output `dist`.
- **GitHub Pages** — publish the built `dist/`.

> **Required after deploy:** in Supabase → **Authentication → URL Configuration**,
> set the **Site URL** and add a **Redirect URL** for your deployed domain
> (e.g. `https://your-app.vercel.app`). Magic links only redirect to allow-listed
> URLs. Add `http://localhost:5173` too for local sign-in.

## Structure

```
index.html              Vite entry (loads Space Grotesk + JetBrains Mono)
src/
  main.tsx              React root
  App.tsx               auth gate + initial load + sync wiring + stale-build check
  ledger.tsx            the app (faithful port; state, streaks, rollover, UI)
  index.css            global styles + :hover/:focus helper classes
  lib/
    supabase.ts        Supabase client
    sync.ts            versioned load/push/merge/refresh + period archive
    merge.ts           three-way board merge (pure; unit-tested)
    build.ts           reload a tab when a newer build is being served
  components/
    Auth.tsx           magic-link sign-in screen
    Shell.tsx          sidebar and header
    RolloverPrompt.tsx week/month rollover modal
supabase/migrations/   database schema (applied in order)
tests/                 node --test unit tests
reference/             original single-file export (design reference)
```
