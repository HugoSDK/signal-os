/* ------------------------------------------------------------------ *
 * Three-way merge of ledger boards, and the loss check that decides    *
 * when a device sets its own copy aside. Pure and import-free so it   *
 * runs under plain Node for the tests (`npm test`).                    *
 * ------------------------------------------------------------------ */

export type Plain = Record<string, unknown>

/** JSON with object keys sorted — Postgres jsonb reorders keys, so plain
 * JSON.stringify would call identical boards different. */
export function stable(v: unknown): string | undefined {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce((o: Plain, k) => {
            o[k] = val[k]
            return o
          }, {})
      : val
  )
}

export const same = (a: unknown, b: unknown) => stable(a) === stable(b)

export const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)
export const isItemList = (v: unknown): v is Plain[] =>
  Array.isArray(v) && v.every((x) => isPlain(x) && typeof x.id === 'number')

/** Nothing worth keeping: '', false, null, or a list/map whose members are
 * all empty. Numbers never are (ids). */
export function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '' || v === false) return true
  if (Array.isArray(v)) return v.every(isEmpty)
  if (isPlain(v)) return Object.keys(v).every((k) => isEmpty(v[k]))
  return false
}

/** How far into each field a merge looks before letting one side win. */
export const MERGE_DEPTH: Record<string, number> = {
  days: 2, // date -> field
  revMadeByMonth: 1, // month
  tasks: 1, // item id
  reviewItems: 1,
  milestones: 1,
}

/**
 * Which side wins a value both sides changed, once a merge can't look any
 * deeper. 'local' is right when `base` really is the board both started
 * from. With no base to go on, the server's copy is trusted ('remote') and
 * only additions are taken from the local one — except that an empty value
 * never beats a filled one.
 */
export type Trust = 'local' | 'remote'

const pick = (l: unknown, r: unknown, trust: Trust) => (trust === 'local' ? l : isEmpty(r) && !isEmpty(l) ? l : r)

/**
 * Three-way merge of one value. Whichever side left it as it was in `b`
 * takes the other side's change; when both changed it, descend `depth`
 * levels into maps (by key) and item lists (by id), and past that `trust`
 * decides.
 */
export function merge3(b: unknown, l: unknown, r: unknown, depth: number, trust: Trust): unknown {
  if (same(l, b)) return r
  if (same(r, b) || same(l, r)) return l
  if (depth <= 0) return pick(l, r, trust)
  if (isItemList(l) && isItemList(r) && (b === undefined || isItemList(b))) {
    const byId = (xs: Plain[]) => new Map(xs.map((x) => [x.id, x]))
    const bm = byId((b ?? []) as Plain[]),
      lm = byId(l),
      rm = byId(r)
    const out: unknown[] = []
    l.forEach((x) => {
      const v = merge3(bm.get(x.id), x, rm.get(x.id), depth, trust)
      if (v !== undefined) out.push(v)
    })
    r.forEach((x) => {
      if (lm.has(x.id)) return
      const v = merge3(bm.get(x.id), undefined, x, depth, trust)
      if (v !== undefined) out.push(v)
    })
    return out
  }
  if (isPlain(l) && isPlain(r) && (b === undefined || isPlain(b))) {
    const bb = (b ?? {}) as Plain
    const out: Plain = {}
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach((k) => {
      const v = merge3(bb[k], l[k], r[k], depth - 1, trust)
      if (v !== undefined) out[k] = v
    })
    return out
  }
  return pick(l, r, trust)
}

/** Merge this device's board (`local`) with a newer server board (`remote`),
 * given the board both started from (`base`), if known. */
export function mergeStates<T extends object>(
  base: T | null,
  local: T,
  remote: T,
  trust: Trust = base ? 'local' : 'remote'
): T {
  const b = (base ?? {}) as Plain,
    l = local as Plain,
    r = remote as Plain
  const out: Plain = {}
  new Set([...Object.keys(r), ...Object.keys(l)]).forEach((k) => {
    const v = merge3(b[k], l[k], r[k], MERGE_DEPTH[k] ?? 0, trust)
    if (v !== undefined) out[k] = v
  })
  return out as T
}

/* ---------- loss check ---------- */

/** Session and period bookkeeping, never content. */
const BOOKKEEPING = new Set([
  'activeTab',
  'newWorkTask',
  'newMiscTask',
  'newTask',
  'newPriority',
  'newReview',
  'newMilestone',
  'newObjective',
  'quoteSeen',
  'intentionPromptSeen',
  'openPeriod',
  'dayTag',
  'weekTag',
  'monthTag',
  'pendingRollover',
  'archiveError',
])
/** Cleared together by "Archive & reset" when the period rolls over. */
const WEEK_FIELDS = ['weekTheme', 'priorities', 'reviewItems']
const MONTH_FIELDS = ['monthFocus', 'milestones', 'monthObs', 'monthCorr']
/** Keyed by date or month. An entry is only ever added or edited, never removed. */
const KEYED = new Set(['days', 'revMadeByMonth'])

export interface Loss {
  /** Whole keyed entries (a day's record, a month's revenue) that vanished.
   * Nothing in the app removes those, so this is a sure sign of a clobber. */
  entries: number
  /** Filled values that came back missing or empty, counted one by one. */
  leaves: number
}

/** Enough loss to set the previous copy aside: a vanished entry. Cleared or
 * deleted values are ordinary edits (emptying a field, deleting tasks in
 * bulk) and the server guard rules out blind overwrites, so those are only
 * counted for the log line. */
export const isLossy = (loss: Loss) => loss.entries > 0

/**
 * What `remote` lacks that `prev` had. Legitimate clearing is discounted:
 * done items (the day rollover and the purge drop them) and the week or
 * month fields when `remote` has moved on to a later period (Archive & reset).
 */
export function lossOf(prev: object, remote: object): Loss {
  const p = prev as Plain,
    r = remote as Plain
  const skip = new Set(BOOKKEEPING)
  const later = (tag: string) =>
    typeof r[tag] === 'string' && typeof p[tag] === 'string' && (r[tag] as string) > (p[tag] as string)
  if (later('weekTag')) WEEK_FIELDS.forEach((k) => skip.add(k))
  if (later('monthTag')) MONTH_FIELDS.forEach((k) => skip.add(k))
  const loss: Loss = { entries: 0, leaves: 0 }
  Object.keys(p).forEach((k) => {
    if (skip.has(k)) return
    if (KEYED.has(k)) {
      if (!isPlain(p[k])) return
      const pm = p[k] as Plain,
        rm = isPlain(r[k]) ? (r[k] as Plain) : {}
      Object.keys(pm).forEach((key) => {
        if (isEmpty(pm[key])) return
        if (rm[key] === undefined) loss.entries += 1
        else loss.leaves += missing(pm[key], rm[key])
      })
      return
    }
    loss.leaves += missing(p[k], r[k])
  })
  return loss
}

/** Filled leaves of `p` that are missing or empty in `r`. */
function missing(p: unknown, r: unknown): number {
  if (isItemList(p)) {
    const rm = new Map(isItemList(r) ? r.map((x) => [x.id, x]) : [])
    let n = 0
    p.forEach((x) => {
      if (x.done === true) return
      const y = rm.get(x.id)
      n += y === undefined ? (isEmpty(x.text) ? 0 : 1) : missing(x, y)
    })
    return n
  }
  if (Array.isArray(p)) {
    const rr = Array.isArray(r) ? r : []
    return p.reduce((n: number, x, i) => n + missing(x, rr[i]), 0)
  }
  if (isPlain(p)) {
    const rr = isPlain(r) ? r : {}
    return Object.keys(p).reduce((n, k) => n + missing(p[k], rr[k]), 0)
  }
  if (isEmpty(p)) return 0
  return isEmpty(r) ? 1 : 0
}
