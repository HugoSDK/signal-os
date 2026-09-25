import { supabase } from './supabase'
import type { State } from '../ledger'
import { isLossy, lossOf, mergeStates, same, stable } from './merge'

/* ------------------------------------------------------------------ *
 * Board sync. The whole board is one JSON row per user, so two open   *
 * devices race to overwrite each other. Every write therefore asserts *
 * the row's next `version` (and its `updated_at`, as a second check); *
 * a trigger on the table refuses anything else — including writes     *
 * from builds that predate versions. A write that loses the race      *
 * pulls the newer row, three-way merges it with this device's edits   *
 * (merge.ts), and retries.                                             *
 * ------------------------------------------------------------------ */

type Board = Partial<State>

/** A board as confirmed by the server, with the version it was saved at. */
interface Synced {
  ts: string
  version: number
  data: Board
}
/** What an earlier build may have left in localStorage: no version. */
type StoredBase = Omit<Synced, 'version'> & { version?: number }

/** A board this device had confirmed, set aside when a later one lost
 * content it had. `replacedBy` is the board that displaced it: the base for
 * putting it back over whatever has been saved since. */
interface Backup {
  ts: string
  version?: number
  /** When it was set aside. */
  at: number
  data: Board
  replacedBy?: Board
  /** The slot holds what a restore replaced, so restoring again undoes it. */
  undo?: boolean
  dismissed?: boolean
}

const LS_KEY = 'signal_ledger_v1'
/** Last server-confirmed board: the common ancestor for merges after a reload. */
const LS_BASE = 'signal_ledger_base'
/** '1' while this device holds edits the server hasn't confirmed. */
const LS_DIRTY = 'signal_ledger_dirty'
/** Written by earlier builds; no longer trusted (it compared device clocks). */
const LS_LEGACY_TS = 'signal_ledger_updated_at'
const LS_BACKUP = 'signal_ledger_backup'
const BACKUP_TTL = 7 * 24 * 60 * 60 * 1000

const PUSH_DELAY = 600
const RETRY_DELAY = 5000

const MIGRATION_HINT = 'sync: ledger_state has no version column — apply supabase/migrations/0002_ledger_state_version.sql'

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function lsSet(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}
function lsJson<T>(k: string): T | null {
  try {
    return JSON.parse(lsGet(k) || 'null')
  } catch {
    return null
  }
}

/* ---------- server ---------- */

async function pull(userId: string): Promise<{ ok: true; row: Synced | null } | { ok: false }> {
  const { data, error } = await supabase
    .from('ledger_state')
    .select('data, version, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (error.code === '42703') console.error(MIGRATION_HINT)
    console.warn('sync: pull failed', error.message)
    return { ok: false }
  }
  return {
    ok: true,
    row: data ? { ts: data.updated_at, version: Number(data.version ?? 0), data: (data.data ?? {}) as Board } : null,
  }
}

type Written = { ts: string; version: number }

/** Write `data` as the version after `base` (null = no row yet). Returns the
 * new version, 'conflict' if the row has moved on, or 'error' for anything
 * else (offline, auth). `updated_at` is stamped by the server; the one sent
 * here only matters to a base row that predates the guard. */
async function write(userId: string, data: Board, base: Synced | null): Promise<Written | 'conflict' | 'error'> {
  const updated_at = new Date().toISOString()
  const q = base
    ? supabase
        .from('ledger_state')
        .update({ data, version: base.version + 1, updated_at })
        .eq('user_id', userId)
        .eq('version', base.version)
        .eq('updated_at', base.ts)
    : supabase.from('ledger_state').insert({ user_id: userId, data, updated_at })
  const { data: rows, error } = await q.select('version, updated_at')
  if (error) {
    // 23505: the insert raced another device's first save. PT409: the
    // table's guard refused the write because the row has moved on.
    if (error.code === '23505' || error.code === 'PT409' || error.code === 'P0001') return 'conflict'
    if (error.code === 'PGRST204' || error.code === '42703') console.error(MIGRATION_HINT, error.message)
    else console.warn('sync: write failed', error.message)
    return 'error'
  }
  if (!rows || !rows.length) return 'conflict'
  return { ts: rows[0].updated_at as string, version: Number(rows[0].version ?? 0) }
}

/* ---------- engine ---------- */

export interface Sync {
  /** Initial board on sign-in (null = nothing anywhere; use defaults). */
  load(): Promise<Board | null>
  /** Called after every Ledger change; pushes shortly after the last real
   * edit. `rev` is the revision of the board on screen (0 for the one load()
   * returned, then whatever the last onRemote carried); a call from a board
   * that has since been replaced is ignored. */
  persist(state: State, rev: number): void
  /** Push any pending edit now (page hidden / closing). Resolves to whether
   * the server has everything. */
  flush(): Promise<boolean>
  /** Pick up saves made on other devices (page shown / focused). */
  refresh(): Promise<void>
  /** A copy this device had confirmed before a newer board lost content from
   * it, if one is set aside. */
  backup(): { ts: string; undo: boolean } | null
  /** Put the set-aside copy back, merged over anything saved since, and push
   * it as a new version. The board it replaces takes its place, so a restore
   * can be undone. Resolves to whether the push went through. */
  restore(): Promise<boolean>
  dismissBackup(): void
}

/**
 * @param onRemote called when the server's board (possibly merged with local
 *   edits) should replace what's on screen, with the new revision number.
 */
export function createSync(userId: string, onRemote: (state: Board, rev: number) => void): Sync {
  let base: StoredBase | null = null
  let loaded = false
  /** load() has returned, so the screen can be told about newer boards. */
  let ready = false
  /** Revision of the board on screen; see Sync.persist. */
  let rev = 0
  /** Board most recently handed to persist(), and whether it's unpushed. */
  let latest: Board | null = null
  let pending = false
  /** Stable form of the last board known to be saved or on screen — persist()
   * ignores calls that don't change it (tab loads, modal toggles…). */
  let lastSnap: string | undefined
  let timer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<unknown> = Promise.resolve()
  let refreshing: Promise<void> | null = null

  function setBase(next: StoredBase) {
    base = next
    lsSet(LS_BASE, JSON.stringify(next))
  }
  /** Take `next` as the confirmed board. If it lost content this device had
   * confirmed in `prev`, that copy is set aside first. */
  function adopt(next: Synced, prev: StoredBase | null = base) {
    if (prev && prev.ts !== next.ts) stashIfLossy(prev, next.data)
    setBase(next)
  }
  function markDirty(on: boolean) {
    lsSet(LS_DIRTY, on ? '1' : null)
  }
  function show(board: Board) {
    latest = board
    lastSnap = stable(board)
    if (ready) {
      rev += 1
      onRemote(board, rev)
    }
  }
  function schedule(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), ms)
  }

  /** Push `board`; on a lost race, merge with the winner and retry once. A
   * base saved by an earlier build carries no version, so it can't be
   * written from: that counts as a lost race too, which pulls one. */
  async function push(board: Board): Promise<boolean> {
    let res: Written | 'conflict' | 'error' =
      base && base.version === undefined ? 'conflict' : await write(userId, board, base as Synced | null)
    if (res === 'conflict') {
      const p = await pull(userId)
      if (!p.ok) return false
      const remote = p.row
      const merged = mergeStates(base ? base.data : null, board, remote ? remote.data : {})
      if (remote) adopt(remote)
      console.info('sync: push conflict → merged with newer save from another device')
      res = await write(userId, merged, remote)
      // Keep anything typed while this was in flight.
      const next = pending && latest ? mergeStates(board, latest, merged, 'local') : merged
      if (res === 'conflict' || res === 'error') {
        // Lost again (or failed): carry on from the merged board, so the
        // retry can't push this device's stale copy over the newer one.
        show(next)
        return false
      }
      setBase({ ...res, data: merged })
      show(next)
      return true
    }
    if (res === 'error') return false
    setBase({ ...res, data: board })
    return true
  }

  function flush(): Promise<boolean> {
    if (timer) clearTimeout(timer)
    timer = null
    const run = queue.then(async () => {
      if (!loaded || !pending || !latest) return true
      pending = false
      let ok = false
      try {
        ok = await push(latest)
      } catch (e) {
        console.warn('sync: push threw', e)
      }
      if (!ok) {
        pending = true
        schedule(RETRY_DELAY)
      } else if (!pending) markDirty(false)
      return ok
    })
    queue = run
    return run
  }

  function persist(state: State, atRev: number) {
    if (atRev !== rev) return
    const snap = stable(state)
    if (snap === lastSnap) return
    lastSnap = snap
    latest = state
    pending = true
    markDirty(true)
    schedule(PUSH_DELAY)
  }

  function refresh(): Promise<void> {
    if (!loaded) return Promise.resolve()
    if (refreshing) return refreshing
    refreshing = (async () => {
      await flush()
      const p = await pull(userId)
      if (!p.ok || !p.row) return
      const remote = p.row
      if (base && base.ts === remote.ts) {
        if (base.version === undefined) setBase(remote)
        return
      }
      if (pending && latest) {
        const merged = mergeStates(base ? base.data : null, latest, remote.data)
        adopt(remote)
        show(merged)
        void flush()
      } else {
        adopt(remote)
        show(remote.data)
      }
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function load(): Promise<Board | null> {
    const local = lsJson<Board>(LS_KEY)
    const savedBase = lsJson<StoredBase>(LS_BASE)
    const dirty = lsGet(LS_DIRTY) === '1'
    lsSet(LS_LEGACY_TS, null)

    const done = (board: Board | null) => {
      lastSnap = stable(board)
      ready = true
      return board
    }
    /** Push `board` before showing it; a conflict merge along the way updates `latest`. */
    const pushFirst = async (board: Board) => {
      latest = board
      pending = true
      await flush()
      return done(latest)
    }

    const p = await pull(userId)
    loaded = true
    if (!p.ok) {
      // Offline: carry on from the local copy and sync once reachable.
      base = savedBase
      if (local && dirty) {
        latest = local
        pending = true
        schedule(RETRY_DELAY)
      }
      return done(local)
    }

    const remote = p.row
    if (!remote) {
      // First sync for this account: move any local board up.
      return local ? pushFirst(local) : done(null)
    }

    if (local && dirty) {
      // Edits this device never got to push: fold them into the server's
      // board. Without a record of what they were made on top of, the
      // server's board is trusted and only additions are taken from here.
      const merged =
        savedBase && savedBase.ts === remote.ts
          ? local
          : mergeStates(savedBase ? savedBase.data : null, local, remote.data)
      adopt(remote, savedBase)
      if (same(merged, remote.data)) {
        markDirty(false)
        return done(remote.data)
      }
      return pushFirst(merged)
    }

    adopt(remote, savedBase)
    markDirty(false)
    return done(remote.data)
  }

  /* ---------- set-aside copy ---------- */

  function readBackup(): Backup | null {
    const b = lsJson<Backup>(LS_BACKUP)
    if (!b || !b.data || typeof b.at !== 'number') return null
    if (Date.now() - b.at > BACKUP_TTL) {
      lsSet(LS_BACKUP, null)
      return null
    }
    return b
  }
  function writeBackup(b: Backup) {
    lsSet(LS_BACKUP, JSON.stringify(b))
  }
  function stashIfLossy(prev: StoredBase, next: Board) {
    if (same(prev.data, next) || !isLossy(lossOf(prev.data, next))) return
    const cur = readBackup()
    // A copy the user hasn't dealt with yet is not overwritten.
    if (cur && !cur.dismissed && !cur.undo && !same(cur.data, next)) return
    writeBackup({ ts: prev.ts, version: prev.version, at: Date.now(), data: prev.data, replacedBy: next })
    console.info("sync: set aside this device's copy — the board from another device is missing content it had")
  }
  function onScreen(): Board | null {
    return latest ?? (base ? base.data : null)
  }
  function backup() {
    const b = readBackup()
    if (!b || b.dismissed || same(b.data, onScreen())) return null
    return { ts: b.ts, undo: !!b.undo }
  }
  function dismissBackup() {
    const b = readBackup()
    if (b) writeBackup({ ...b, dismissed: true })
  }
  async function restore(): Promise<boolean> {
    const b = readBackup()
    if (!loaded || !b || b.dismissed) return false
    await flush()
    const current = onScreen() ?? {}
    // Put the copy back on top of whatever changed since it was set aside.
    const merged = b.replacedBy ? mergeStates(b.replacedBy, b.data, current, 'local') : b.data
    writeBackup({
      ts: base ? base.ts : '',
      version: base ? base.version : undefined,
      at: Date.now(),
      data: current,
      replacedBy: merged,
      undo: !b.undo,
    })
    show(merged)
    pending = true
    markDirty(true)
    return flush()
  }

  return { load, persist, flush, refresh, backup, restore, dismissBackup }
}

export interface ArchiveRow {
  period_type: 'week' | 'month'
  period_tag: string
  snapshot: Record<string, unknown>
}

/** A past period as stored in history. `snapshot` shape differs by period_type. */
export interface ArchivedPeriod extends ArchiveRow {
  archived_at: string
}

/**
 * Upsert a period snapshot into history (idempotent on user+type+tag).
 * Returns whether the write succeeded — callers must not clear the live
 * period unless this resolved true.
 */
export async function archivePeriod(userId: string, row: ArchiveRow): Promise<boolean> {
  const { error } = await supabase
    .from('period_archive')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id,period_type,period_tag' })
  if (error) {
    console.warn('archivePeriod error', error.message)
    return false
  }
  return true
}

/** Read back every archived period for a user, newest first. */
export async function loadHistory(userId: string): Promise<ArchivedPeriod[]> {
  const { data, error } = await supabase
    .from('period_archive')
    .select('period_type, period_tag, snapshot, archived_at')
    .eq('user_id', userId)
    .order('archived_at', { ascending: false })
  if (error) {
    console.warn('loadHistory error', error.message)
    throw new Error(error.message)
  }
  return (data ?? []) as ArchivedPeriod[]
}
