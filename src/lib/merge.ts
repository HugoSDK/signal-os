/* ------------------------------------------------------------------ *
 * Three-way merge of ledger boards. Pure and import-free so it runs    *
 * under plain Node for the tests (`npm test`).                         *
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
  shopping: 1,
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

/**
 * A board from another device, taken into a page that may have been edited
 * since `shown` (the board the page was last given). Edits made here since
 * then are kept; everything else follows `incoming`.
 */
export function carryOver<T extends object>(shown: T, current: T, incoming: T): T {
  return same(current, shown) ? incoming : mergeStates(shown, current, incoming, 'local')
}
