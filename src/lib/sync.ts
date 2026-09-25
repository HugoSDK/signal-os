import { supabase } from './supabase'
import type { State } from '../ledger'

/* ------------------------------------------------------------------ *
 * Board sync. The whole board is one JSON row per user, so two open   *
 * devices race to overwrite each other. Writes are therefore          *
 * conditional on the row's `updated_at` (used purely as a version —   *
 * compared for equality, never across clocks). A write that loses the *
 * race pulls the newer row, three-way merges it with this device's    *
 * edits, and retries.                                                  *
 * ------------------------------------------------------------------ */

type Board = Partial<State>

/** A board as confirmed by the server, with the version it was saved at. */
interface Synced {
  ts: string
  data: Board
}

const LS_KEY = 'signal_ledger_v1'
/** Last server-confirmed board: the common ancestor for merges after a reload. */
const LS_BASE = 'signal_ledger_base'
/** '1' while this device holds edits the server hasn't confirmed. */
const LS_DIRTY = 'signal_ledger_dirty'
/** Written by earlier builds; no longer trusted (it compared device clocks). */
const LS_LEGACY_TS = 'signal_ledger_updated_at'

const PUSH_DELAY = 600
const RETRY_DELAY = 5000

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

/* ---------- merge ---------- */

/** JSON with object keys sorted — Postgres jsonb reorders keys, so plain
 * JSON.stringify would call identical boards different. */
function stable(v: unknown): string | undefined {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce((o: Record<string, unknown>, k) => {
            o[k] = val[k]
            return o
          }, {})
      : val
  )
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b)

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)
const isItemList = (v: unknown): v is Plain[] =>
  Array.isArray(v) && v.every((x) => isPlain(x) && typeof x.id === 'number')

/** How far into each field a merge looks before letting this device win. */
const MERGE_DEPTH: Record<string, number> = {
  days: 2, // date -> field
  revMadeByMonth: 1, // month
  tasks: 1, // item id
  reviewItems: 1,
  milestones: 1,
}

/**
 * Three-way merge of one value. Whichever side left it as it was in `b`
 * takes the other side's change; when both changed it, descend `depth`
 * levels into maps (by key) and item lists (by id), and past that the
 * local side wins.
 */
function merge3(b: unknown, l: unknown, r: unknown, depth: number): unknown {
  if (same(l, b)) return r
  if (same(r, b) || same(l, r)) return l
  if (depth <= 0) return l
  if (isItemList(l) && isItemList(r) && (b === undefined || isItemList(b))) {
    const byId = (xs: Plain[]) => new Map(xs.map((x) => [x.id, x]))
    const bm = byId((b ?? []) as Plain[]),
      lm = byId(l),
      rm = byId(r)
    const out: unknown[] = []
    l.forEach((x) => {
      const v = merge3(bm.get(x.id), x, rm.get(x.id), depth)
      if (v !== undefined) out.push(v)
    })
    r.forEach((x) => {
      if (lm.has(x.id)) return
      const v = merge3(bm.get(x.id), undefined, x, depth)
      if (v !== undefined) out.push(v)
    })
    return out
  }
  if (isPlain(l) && isPlain(r) && (b === undefined || isPlain(b))) {
    const bb = (b ?? {}) as Plain
    const out: Plain = {}
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach((k) => {
      const v = merge3(bb[k], l[k], r[k], depth - 1)
      if (v !== undefined) out[k] = v
    })
    return out
  }
  return l
}

/** Merge this device's board (`local`) with a newer server board (`remote`),
 * given the board both started from (`base`). */
export function mergeStates(base: Board | null, local: Board, remote: Board): Board {
  const b = (base ?? {}) as Plain,
    l = local as Plain,
    r = remote as Plain
  const out: Plain = {}
  new Set([...Object.keys(r), ...Object.keys(l)]).forEach((k) => {
    const v = merge3(b[k], l[k], r[k], MERGE_DEPTH[k] ?? 0)
    if (v !== undefined) out[k] = v
  })
  return out as Board
}

/* ---------- server ---------- */

async function pull(userId: string): Promise<{ ok: true; row: Synced | null } | { ok: false }> {
  const { data, error } = await supabase
    .from('ledger_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('sync: pull failed', error.message)
    return { ok: false }
  }
  return { ok: true, row: data ? { ts: data.updated_at, data: (data.data ?? {}) as Board } : null }
}

/** Write `data` only if the row is still at version `baseTs` (null = no row yet).
 * Returns the new version, 'conflict' if another device got there first, or
 * 'error' for anything else (offline, auth). */
async function write(userId: string, data: Board, baseTs: string | null): Promise<string | 'conflict' | 'error'> {
  const updated_at = new Date().toISOString()
  const q = baseTs
    ? supabase.from('ledger_state').update({ data, updated_at }).eq('user_id', userId).eq('updated_at', baseTs)
    : supabase.from('ledger_state').insert({ user_id: userId, data, updated_at })
  const { data: rows, error } = await q.select('updated_at')
  if (error) {
    if (error.code === '23505') return 'conflict' // insert raced another device's first save
    console.warn('sync: write failed', error.message)
    return 'error'
  }
  if (!rows || !rows.length) return 'conflict'
  return rows[0].updated_at as string
}

/* ---------- engine ---------- */

export interface Sync {
  /** Initial board on sign-in (null = nothing anywhere; use defaults). */
  load(): Promise<Board | null>
  /** Called after every Ledger change; pushes shortly after the last real edit. */
  persist(state: State): void
  /** Push any pending edit now (page hidden / closing). */
  flush(): Promise<void>
  /** Pick up saves made on other devices (page shown / focused). */
  refresh(): Promise<void>
}

/**
 * @param onRemote called when the server's board (possibly merged with local
 *   edits) should replace what's on screen.
 */
export function createSync(userId: string, onRemote: (state: Board) => void): Sync {
  let base: Synced | null = null
  let loaded = false
  /** load() has returned, so the screen can be told about newer boards. */
  let ready = false
  /** Board most recently handed to persist(), and whether it's unpushed. */
  let latest: Board | null = null
  let pending = false
  /** Stable form of the last board known to be saved or on screen — persist()
   * ignores calls that don't change it (tab loads, modal toggles…). */
  let lastSnap: string | undefined
  let timer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<void> = Promise.resolve()
  let refreshing: Promise<void> | null = null

  function setBase(next: Synced) {
    base = next
    lsSet(LS_BASE, JSON.stringify(next))
  }
  function markDirty(on: boolean) {
    lsSet(LS_DIRTY, on ? '1' : null)
  }
  function show(board: Board) {
    latest = board
    lastSnap = stable(board)
    if (ready) onRemote(board)
  }
  function schedule(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), ms)
  }

  /** Push `board`; on a lost race, merge with the winner and retry once. */
  async function push(board: Board): Promise<boolean> {
    let res = await write(userId, board, base ? base.ts : null)
    if (res === 'conflict') {
      const p = await pull(userId)
      if (!p.ok) return false
      const remote = p.row
      const merged = mergeStates(base ? base.data : null, board, remote ? remote.data : {})
      console.info('sync: push conflict → merged with newer save from another device')
      res = await write(userId, merged, remote ? remote.ts : null)
      if (res === 'conflict' || res === 'error') {
        // Lost again (or failed): adopt the server's version as the base so
        // the retry merges against it.
        if (remote) setBase(remote)
        return false
      }
      setBase({ ts: res, data: merged })
      // Keep anything typed while this was in flight.
      show(pending && latest ? mergeStates(board, latest, merged) : merged)
      return true
    }
    if (res === 'error') return false
    setBase({ ts: res, data: board })
    return true
  }

  function flush(): Promise<void> {
    if (timer) clearTimeout(timer)
    timer = null
    queue = queue.then(async () => {
      if (!loaded || !pending || !latest) return
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
    })
    return queue
  }

  function persist(state: State) {
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
      if (base && base.ts === remote.ts) return
      if (pending && latest) {
        const merged = mergeStates(base ? base.data : null, latest, remote.data)
        setBase(remote)
        show(merged)
        void flush()
      } else {
        setBase(remote)
        show(remote.data)
      }
    })().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function load(): Promise<Board | null> {
    const local = lsJson<Board>(LS_KEY)
    const savedBase = lsJson<Synced>(LS_BASE)
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
      // Edits this device never got to push: fold them into the server's board.
      const merged =
        savedBase && savedBase.ts === remote.ts
          ? local
          : mergeStates(savedBase ? savedBase.data : remote.data, local, remote.data)
      setBase(remote)
      return pushFirst(merged)
    }

    setBase(remote)
    markDirty(false)
    return done(remote.data)
  }

  return { load, persist, flush, refresh }
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
