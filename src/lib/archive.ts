import type { ArchivedPeriod } from './sync'
import { monthLabelFromTag, monthTagOf, monthTagOfWeekTag, pad, parseAmount, weekLabelFromTag, weekTagOf } from './dates'

/* Builds the Archive screen's month cards and detail view out of the rows in
 * period_archive plus the week and month currently in progress.
 *
 * Snapshots are untyped jsonb written by earlier versions of the app, so every
 * field is read defensively and empty ones are dropped rather than rendered
 * blank. */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])
const itemText = (it: unknown) => (it && typeof it === 'object' ? str((it as any).text) : str(it))

export interface MetaLine {
  key: string
  /** Inline prefix used on a card, e.g. 'Milestones 02/05 · '. */
  label: string
  /** Caption used when the same line becomes its own box in the detail view. */
  boxLabel: string
  value: string
}
export interface Reflection {
  key: string
  name: string
  text: string
}
export interface PriorityLine {
  key: number
  idx: string
  text: string
}

export interface Entry {
  /** 'week:2026-W38' or 'month:2026-09'. */
  key: string
  /** Period tag without the type prefix. */
  tag: string
  /** Display label — 'W38' or 'SEPTEMBER 2026'. */
  label: string
  /** The period still in progress, as opposed to an archived one. */
  live: boolean
  headline: string
  priorities: PriorityLine[]
  metaLines: MetaLine[]
  reflections: Reflection[]
}

export interface MonthCard extends Entry {
  weeksLabel: string
}

export interface MonthDetail extends Entry {
  weeks: Entry[]
}

/** Live period content, in the same shape the snapshots use. */
export interface LiveState {
  weekTag: string
  monthTag: string
  weekTheme: string
  priorities: string[]
  reviewItems: { text: string }[]
  monthFocus: string
  milestones: { text: string; done?: boolean }[]
  monthObs: string
  monthCorr: string
  revGoal: string
  revMadeByMonth: Record<string, string>
}

/** Revenue per month tag, merging archived snapshots with the live figures.
 * Live values win, since a month can be edited after it was archived. */
export function revenueByMonth(archive: ArchivedPeriod[], revMadeByMonth: Record<string, string>) {
  const out: Record<string, number> = {}
  archive.forEach((p) => {
    if (p.period_type !== 'month') return
    const v = parseAmount((p.snapshot as any)?.revMade)
    if (v) out[p.period_tag] = v
  })
  Object.keys(revMadeByMonth || {}).forEach((k) => {
    const v = parseAmount(revMadeByMonth[k])
    if (v) out[k] = v
  })
  return out
}

function weekEntry(tag: string, snap: Record<string, unknown>, live: boolean): Entry {
  const priorities = list(snap.priorities)
    .map(itemText)
    .filter(Boolean)
    .map((text, i) => ({ key: i, idx: pad(i + 1), text }))
  const wins = list(snap.reviewItems).map(itemText).filter(Boolean)
  return {
    key: 'week:' + tag,
    tag,
    label: weekLabelFromTag(tag),
    live,
    headline: str(snap.weekTheme),
    priorities,
    metaLines: [],
    reflections: wins.length ? [{ key: 'wins', name: 'WEEK IN REVIEW', text: wins.join(' · ') }] : [],
  }
}

function monthEntry(
  tag: string,
  snap: Record<string, unknown>,
  live: boolean,
  currency: string,
  revMap: Record<string, number>
): Entry {
  const milestones = list(snap.milestones)
  const names = milestones.map(itemText).filter(Boolean)
  const doneCount = milestones.filter((m: any) => m && typeof m === 'object' && m.done).length
  const metaLines: MetaLine[] = []
  if (names.length) {
    metaLines.push({
      key: 'ms',
      label: 'Milestones ' + pad(doneCount) + '/' + pad(names.length) + ' · ',
      boxLabel: 'MILESTONES · ' + pad(doneCount) + '/' + pad(names.length),
      value: names.join(', '),
    })
  }
  const rev = revMap[tag] || 0
  if (rev > 0) {
    metaLines.push({ key: 'rev', label: 'Revenue · ', boxLabel: 'REVENUE', value: currency + rev.toLocaleString('en-US') })
  }
  const reflections: Reflection[] = []
  if (str(snap.monthObs)) reflections.push({ key: 'obs', name: 'OBSERVATION', text: str(snap.monthObs) })
  if (str(snap.monthCorr)) reflections.push({ key: 'corr', name: 'CORRECTION', text: str(snap.monthCorr) })
  return {
    key: 'month:' + tag,
    tag,
    label: monthLabelFromTag(tag).toUpperCase(),
    live,
    headline: str(snap.monthFocus),
    priorities: [],
    metaLines,
    reflections,
  }
}

/**
 * Every week and month worth showing, newest first: the two live periods, then
 * everything in the archive, then months that only ever recorded revenue.
 *
 * A live period and an archived row can carry the same tag — the snapshot is
 * written the moment a rollover is detected, while the live tag only advances
 * once the prompt is resolved — so the live entry wins for its own tag.
 */
export function buildEntries(
  archive: ArchivedPeriod[],
  live: LiveState,
  currency: string,
  now = new Date()
): { weeks: Entry[]; months: Entry[] } {
  const revMap = revenueByMonth(archive, live.revMadeByMonth)
  const liveWeekTag = live.weekTag || weekTagOf(now)
  const liveMonthTag = live.monthTag || monthTagOf(now)

  const weeks: Entry[] = [
    weekEntry(liveWeekTag, { weekTheme: live.weekTheme, priorities: live.priorities, reviewItems: live.reviewItems }, true),
  ]
  const months: Entry[] = [
    monthEntry(
      liveMonthTag,
      {
        monthFocus: live.monthFocus,
        milestones: live.milestones,
        monthObs: live.monthObs,
        monthCorr: live.monthCorr,
        revGoal: live.revGoal,
        revMade: live.revMadeByMonth[liveMonthTag] || '',
      },
      true,
      currency,
      revMap
    ),
  ]

  const seen = new Set([weeks[0].key, months[0].key])
  archive.forEach((p) => {
    const key = p.period_type + ':' + p.period_tag
    if (seen.has(key)) return
    seen.add(key)
    const snap = (p.snapshot ?? {}) as Record<string, unknown>
    if (p.period_type === 'week') weeks.push(weekEntry(p.period_tag, snap, false))
    else months.push(monthEntry(p.period_tag, snap, false, currency, revMap))
  })

  // Months that were never archived but do have revenue on record.
  Object.keys(revMap).forEach((tag) => {
    if (seen.has('month:' + tag)) return
    seen.add('month:' + tag)
    months.push(monthEntry(tag, { revMade: revMap[tag] }, false, currency, revMap))
  })

  const newestFirst = (a: Entry, b: Entry) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0)
  return { weeks: weeks.sort(newestFirst), months: months.sort(newestFirst) }
}

function weeksOfMonth(weeks: Entry[], monthTag: string) {
  return weeks.filter((w) => monthTagOfWeekTag(w.tag) === monthTag)
}

export function monthCards(entries: { weeks: Entry[]; months: Entry[] }): MonthCard[] {
  return entries.months.map((m) => {
    const n = weeksOfMonth(entries.weeks, m.tag).length
    return { ...m, weeksLabel: pad(n) + (n === 1 ? ' WEEK' : ' WEEKS') }
  })
}

export function monthDetail(entries: { weeks: Entry[]; months: Entry[] }, monthTag: string | null): MonthDetail | null {
  if (!monthTag) return null
  const m = entries.months.find((x) => x.tag === monthTag)
  if (!m) return null
  return { ...m, weeks: weeksOfMonth(entries.weeks, monthTag) }
}
