import { supabase } from './supabase'
import type { State } from '../ledger'

const LS_KEY = 'signal_ledger_v1'
const LS_TS = 'signal_ledger_updated_at'

/**
 * Decide the initial state on sign-in.
 * - Remote row present -> use it, unless local edits are newer (offline edits): then push local up.
 * - No remote row but a local blob exists -> migrate local up (first sync of an existing user).
 * - Nothing anywhere -> null (component falls back to defaults).
 */
export async function loadInitialState(userId: string): Promise<Partial<State> | null> {
  let localState: Partial<State> | null = null
  let localTs = 0
  try {
    localState = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    localTs = Date.parse(localStorage.getItem(LS_TS) || '') || 0
  } catch {
    /* ignore */
  }

  const { data, error } = await supabase
    .from('ledger_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('loadInitialState: remote error, using local cache', error.message)
    return localState
  }

  if (!data) {
    if (localState) await pushRemote(userId, localState as State)
    return localState
  }

  const remoteTs = Date.parse(data.updated_at) || 0
  if (localState && localTs > remoteTs) {
    // This device has newer (e.g. offline) edits — keep them and re-sync.
    await pushRemote(userId, localState as State)
    return localState
  }
  return (data.data as Partial<State>) ?? null
}

export async function pushRemote(userId: string, state: State) {
  let ts: string
  try {
    ts = localStorage.getItem(LS_TS) || new Date().toISOString()
  } catch {
    ts = new Date().toISOString()
  }
  const { error } = await supabase
    .from('ledger_state')
    .upsert({ user_id: userId, data: state, updated_at: ts }, { onConflict: 'user_id' })
  if (error) console.warn('pushRemote error', error.message)
}

/** Returns a debounced persister: stamps a local edit time immediately, pushes to the DB ~1s later. */
export function makePersister(userId: string) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: State | null = null
  return (state: State) => {
    latest = state
    try {
      localStorage.setItem(LS_TS, new Date().toISOString())
    } catch {
      /* ignore */
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (latest) pushRemote(userId, latest)
    }, 1000)
  }
}

export interface ArchiveRow {
  period_type: 'week' | 'month'
  period_tag: string
  snapshot: Record<string, unknown>
}

/** Upsert a period snapshot into history (idempotent on user+type+tag). */
export async function archivePeriod(userId: string, row: ArchiveRow) {
  const { error } = await supabase
    .from('period_archive')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id,period_type,period_tag' })
  if (error) console.warn('archivePeriod error', error.message)
}
