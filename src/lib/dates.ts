/* Date, period-tag and label helpers shared by the ledger, the archive
 * builders and the presentational components. Everything here is pure. */

export const pad = (n: number) => String(n).padStart(2, '0')

export function dateKey(d: Date) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7)
}

/** ISO week tag, e.g. '2026-W38'. The year is the *ISO* year, so the last days
 * of December can belong to W01 of the year after. */
export function weekTagOf(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7)
  return t.getUTCFullYear() + '-W' + pad(week)
}

export function monthTagOf(d: Date) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1)
}

/** 1-365/366. Compared as UTC calendar days so neither the time of day nor a
 * DST shift between 31 Dec and `d` can move the count. */
export function dayOfYear(d: Date) {
  const start = Date.UTC(d.getFullYear(), 0, 0)
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((day - start) / 86400000)
}

export function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** Monday-first list of the seven dates in the week containing `now`. */
export function weekDates(now = new Date()) {
  const idx = now.getDay() || 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - idx + 1)
  const out: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    out.push(d)
  }
  return out
}

/** '14 SEP – 20 SEP' for the Week tab's kicker. */
export function weekRange(now = new Date()) {
  const days = weekDates(now)
  const fmt = (d: Date) => d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  return fmt(days[0]) + ' – ' + fmt(days[6])
}

/** Days of the current week already elapsed, today included: Monday = 1. */
export function elapsedDaysThisWeek(now = new Date()) {
  return now.getDay() || 7
}

export function mondayOfIsoWeek(year: number, week: number) {
  const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - dow + 1)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Which month a week tag belongs to — by its Monday, so a week straddling a
 * month boundary files under the month it started in. '' if unparseable. */
export function monthTagOfWeekTag(tag: string) {
  const m = String(tag || '').match(/^(\d{4})-W(\d{1,2})$/)
  if (!m) return ''
  return monthTagOf(mondayOfIsoWeek(Number(m[1]), Number(m[2])))
}

/** '2026-W38' -> 'W38'. */
export function weekLabelFromTag(tag: string) {
  const wk = String(tag || '').split('-W')[1]
  return wk ? 'W' + pad(Number(wk)) : String(tag || '')
}

/** '2026-09' -> 'September 2026'. */
export function monthLabelFromTag(tag: string) {
  const parts = String(tag || '').split('-')
  if (parts.length < 2) return String(tag || '')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

/** Money strings are free-text in the UI, so strip everything but digits. */
export function parseAmount(v: unknown) {
  return Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')) || 0
}
