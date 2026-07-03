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
  Supabase and loads on any browser/device.
- **Forever streaks** — daily "One Lead / One Post" history lives server-side,
  so streaks are never lost when a browser is cleared. (The streak count itself
  is unbounded; the dot row shows the last 14 days.)
- **Period rollover** — at the start of a new week/month, a prompt offers to
  **archive** the previous period (kept in history) and start fresh, or carry it
  over.

## Local development

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + publishable key
npm run dev            # http://localhost:5173
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
Schema is in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql):

- `ledger_state` — one row per user (`user_id`, `data jsonb`, `updated_at`); the
  full app state, including daily history.
- `period_archive` — snapshots of past weeks/months (`period_type`, `period_tag`,
  `snapshot jsonb`).

Both tables have **Row-Level Security**: every row is scoped to `auth.uid()`.

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
index.html              Vite entry (loads Inter + Source Serif 4)
src/
  main.tsx              React root
  App.tsx               auth gate + initial load + sync wiring + account bar
  ledger.tsx            the app (faithful port; state, streaks, rollover, UI)
  index.css            global styles + :hover/:focus helper classes
  lib/
    supabase.ts        Supabase client
    sync.ts            load/upsert/debounce/migrate + period archive
  components/
    Auth.tsx           magic-link sign-in screen
    RolloverPrompt.tsx week/month rollover modal
supabase/migrations/   database schema
reference/             original single-file export (design reference)
```
