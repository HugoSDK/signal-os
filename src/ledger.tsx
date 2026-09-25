import React from 'react'
import RolloverPrompt from './components/RolloverPrompt'
import Shell from './components/Shell'
import Today from './components/Today'
import Week from './components/Week'
import Month from './components/Month'
import Archive from './components/Archive'
import IntentionModal from './components/IntentionModal'
import ReflectionModal from './components/ReflectionModal'
import type { Dot, Row, WeekDot } from './components/ui'
import type { ArchivedPeriod } from './lib/sync'
import { buildEntries, monthCards, monthDetail, revenueByMonth } from './lib/archive'
import {
  dateKey,
  dayOfYear,
  daysInMonth,
  elapsedDaysThisWeek,
  isoWeek,
  monthLabelFromTag,
  monthTagOf,
  pad,
  parseAmount,
  weekDates,
  weekLabelFromTag,
  weekRange,
  weekTagOf,
} from './lib/dates'

/* ------------------------------------------------------------------ *
 * Ledger owns all state: the persisted board, the period rollover and  *
 * the archive fetch. Everything below it is presentational.            *
 * ------------------------------------------------------------------ */

export interface Item {
  id: number
  text: string
  done?: boolean
  category?: 'work' | 'misc'
}

export interface DayRec {
  /** The one thing the day is for, and whether it got done. */
  intention: string
  topDone: boolean
  leadWho: string
  leadDone: boolean
  postWhat: string
  postDone: boolean
  /** End-of-day reflection. */
  wentWell: string
  improve: string
  gratitude: string[]
}

export interface State {
  activeTab: string
  tasks: Item[]
  newWorkTask: string
  newMiscTask: string
  days: Record<string, DayRec>
  weekTheme: string
  priorities: string[]
  newPriority: string
  reviewItems: Item[]
  newReview: string
  monthFocus: string
  milestones: Item[]
  newMilestone: string
  monthObs: string
  monthCorr: string
  revGoal: string
  revMadeByMonth: Record<string, string>
  /** Date key of the day the mantra band was last acknowledged. */
  quoteSeen: string
  /** Date key of the day the start-of-day intention prompt was last closed. */
  intentionPromptSeen: string
  /** Month tag whose archive detail is open, if any. */
  openPeriod: string | null
  dayTag: string
  weekTag: string
  monthTag: string
  pendingRollover: 'week' | 'month' | null
  /** Set when 'Archive & reset' was blocked because the DB write failed. */
  archiveError: 'week' | 'month' | null

  /* UI-only, never persisted. */
  intentionOpen: boolean
  reflectionOpen: boolean
  archive: ArchivedPeriod[]
}

export interface LedgerProps {
  accent?: string
  currency?: string
  /** Optional initial state (e.g. loaded from the DB). Falls back to localStorage + defaults. */
  initialState?: Partial<State> | null
  /** Called after every state change (localStorage is always written; this is for remote sync). */
  onPersist?: (state: State) => void
  /** Persist a period snapshot to history (rollover "archive"). */
  onArchive?: (row: { period_type: 'week' | 'month'; period_tag: string; snapshot: Record<string, unknown> }) => Promise<boolean>
  /** Lazily load archived periods. Fetched once on mount for the Archive tab. */
  onLoadHistory?: () => Promise<ArchivedPeriod[]>
  /** Pull other devices' saves when the page is shown again. The day rollover
   * waits for it, so a stale board never gets pushed over a newer one. */
  onVisible?: () => Promise<void>
  userId?: string
  email?: string
  onSignOut?: () => void
}

export const DEFAULT_STATE: State = {
  activeTab: 'today',
  tasks: [],
  newWorkTask: '',
  newMiscTask: '',
  days: {},
  weekTheme: '',
  priorities: ['', '', ''],
  newPriority: '',
  reviewItems: [],
  newReview: '',
  monthFocus: '',
  milestones: [],
  newMilestone: '',
  monthObs: '',
  monthCorr: '',
  revGoal: '5000',
  revMadeByMonth: {},
  quoteSeen: '',
  intentionPromptSeen: '',
  openPeriod: null,
  dayTag: '',
  weekTag: '',
  monthTag: '',
  pendingRollover: null,
  archiveError: null,
  intentionOpen: false,
  reflectionOpen: false,
  archive: [],
}

const EMPTY_DAY: DayRec = {
  intention: '',
  topDone: false,
  leadWho: '',
  leadDone: false,
  postWhat: '',
  postDone: false,
  wentWell: '',
  improve: '',
  gratitude: ['', '', ''],
}

const TABS = ['today', 'week', 'month', 'timeline']
/* Boards saved by earlier builds name the tabs differently. */
const TAB_ALIASES: Record<string, string> = { daily: 'today', weekly: 'week', monthly: 'month', history: 'timeline' }

/** Fields that exist only for this session and must not reach storage. */
const UI_ONLY = ['intentionOpen', 'reflectionOpen', 'archive'] as const

export default class Ledger extends React.Component<LedgerProps, State> {
  constructor(props: LedgerProps) {
    super(props)
    let saved: Partial<State> | null = props.initialState ?? null
    if (!saved) {
      try {
        saved = JSON.parse(window.localStorage.getItem('signal_ledger_v1') || 'null')
      } catch (e) {
        saved = null
      }
    }
    const st = Object.assign({}, DEFAULT_STATE, saved || {}, {
      newWorkTask: '',
      newMiscTask: '',
      newPriority: '',
      newReview: '',
      newMilestone: '',
      pendingRollover: null,
      archiveError: null,
      intentionOpen: false,
      reflectionOpen: false,
      archive: [],
    })
    if (TABS.indexOf(st.activeTab) < 0) st.activeTab = TAB_ALIASES[st.activeTab] || 'today'
    if (!Array.isArray(st.priorities) || st.priorities.length === 0) st.priorities = ['', '', '']
    this.state = st
  }

  dismissed = new Set<string>()

  mounted = false

  onVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    const refresh = this.props.onVisible
    if (!refresh) {
      this.detectRollover()
      this.maybePromptIntention()
      return
    }
    // A refresh that finds a newer board remounts Ledger, and the new instance
    // runs its own rollover on mount.
    refresh()
      .catch(() => {})
      .then(() => {
        if (!this.mounted) return
        this.detectRollover()
        this.maybePromptIntention()
      })
  }

  onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (this.state.reflectionOpen) this.setState({ reflectionOpen: false })
    if (this.state.intentionOpen) this.closeIntention()
  }

  componentDidMount() {
    this.mounted = true
    this.detectRollover()
    this.maybePromptIntention()
    this.loadArchive()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisible)
      document.addEventListener('keydown', this.onKey)
    }
  }

  componentDidUpdate(prev: LedgerProps) {
    if (prev.onLoadHistory !== this.props.onLoadHistory) this.loadArchive()
    const persisted = this.persistable()
    try {
      window.localStorage.setItem('signal_ledger_v1', JSON.stringify(persisted))
    } catch (e) {
      /* ignore */
    }
    this.props.onPersist?.(persisted)
  }

  componentWillUnmount() {
    this.mounted = false
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisible)
      document.removeEventListener('keydown', this.onKey)
    }
  }

  /** State minus the fields that only make sense inside this session. */
  persistable(): State {
    const out: any = Object.assign({}, this.state)
    UI_ONLY.forEach((k) => delete out[k])
    return out as State
  }

  /* ---------- archive ---------- */

  loadArchive() {
    const load = this.props.onLoadHistory
    if (!load) {
      this.setState({ archive: [] })
      return
    }
    load()
      .then((rows) => this.setState({ archive: rows || [] }))
      .catch((e) => {
        console.warn('loadArchive error', e?.message || e)
      })
  }

  /* ---------- period rollover ---------- */

  /** Silent daily rollover: on the first open of a new day, carry unfinished
   * tasks forward and clear the completed ones. Legacy state (no dayTag) just
   * initialises to today so nothing is cleared on first launch. */
  detectDayRollover() {
    const today = dateKey(new Date())
    const s = this.state
    if (!s.dayTag) {
      this.setState({ dayTag: today })
      return
    }
    if (s.dayTag !== today) {
      this.setState((prev) => ({
        tasks: prev.tasks.filter((t) => !t.done),
        dayTag: today,
      }))
    }
  }

  weekTag(d: Date) {
    return weekTagOf(d)
  }

  monthTag(d: Date) {
    return monthTagOf(d)
  }

  weekHasContent(s: State) {
    return !!(s.weekTheme.trim() || s.priorities.some((p) => p.trim()) || s.reviewItems.length)
  }

  monthHasContent(s: State) {
    return !!(
      s.monthFocus.trim() ||
      s.milestones.length ||
      s.monthObs.trim() ||
      s.monthCorr.trim() ||
      (s.revMadeByMonth[s.monthTag] || '').trim()
    )
  }

  /* ---------- archiving ----------
   * Archiving happens at rollover *detection*, not on a button press, so a
   * period is recorded no matter which prompt button is used (or if the
   * prompt is dismissed / never seen). archivePeriod upserts on
   * user+type+tag, so repeat calls are idempotent. */

  /** Whether the pending period's snapshot reached the DB. Null = not attempted. */
  archivedOk: { week: boolean | null; month: boolean | null } = { week: null, month: null }

  archiveWeek(s: State) {
    this.archivedOk.week = null
    const p = this.props.onArchive?.({
      period_type: 'week',
      period_tag: s.weekTag,
      snapshot: { weekTheme: s.weekTheme, priorities: s.priorities, reviewItems: s.reviewItems },
    })
    if (!p) {
      this.archivedOk.week = false
      return
    }
    Promise.resolve(p).then((ok) => {
      this.archivedOk.week = ok
      if (ok) this.loadArchive()
    })
  }

  archiveMonth(s: State) {
    this.archivedOk.month = null
    const p = this.props.onArchive?.({
      period_type: 'month',
      period_tag: s.monthTag,
      snapshot: {
        monthFocus: s.monthFocus,
        milestones: s.milestones,
        monthObs: s.monthObs,
        monthCorr: s.monthCorr,
        revGoal: s.revGoal,
        revMade: s.revMadeByMonth[s.monthTag] ?? '',
      },
    })
    if (!p) {
      this.archivedOk.month = false
      return
    }
    Promise.resolve(p).then((ok) => {
      this.archivedOk.month = ok
      if (ok) this.loadArchive()
    })
  }

  detectRollover() {
    this.detectDayRollover()
    if (this.state.pendingRollover) return
    const now = new Date()
    const wTag = weekTagOf(now)
    const mTag = monthTagOf(now)
    const s = this.state
    const patch: any = {}
    let pending: 'week' | 'month' | null = null

    if (!s.weekTag) patch.weekTag = wTag
    else if (s.weekTag !== wTag) {
      if (this.weekHasContent(s)) this.archiveWeek(s)
      if (this.weekHasContent(s) && !this.dismissed.has('week:' + wTag)) pending = 'week'
      else patch.weekTag = wTag
    }

    if (!s.monthTag) patch.monthTag = mTag
    else if (s.monthTag !== mTag) {
      if (this.monthHasContent(s)) this.archiveMonth(s)
      if (this.monthHasContent(s) && !this.dismissed.has('month:' + mTag)) {
        if (!pending) pending = 'month'
      } else patch.monthTag = mTag
    }

    if (pending) patch.pendingRollover = pending
    if (Object.keys(patch).length) this.setState(patch)
  }

  /* The snapshot was already written at detection time. "Archive & reset"
   * only *clears* — and it refuses to clear anything the DB hasn't
   * confirmed, so a failed write can never blank the board. */
  resolveWeek(action: 'archive' | 'keep') {
    const wTag = weekTagOf(new Date())
    if (action === 'archive') {
      if (this.archivedOk.week !== true) {
        this.setState({ archiveError: 'week' })
        return
      }
      this.setState(
        { weekTheme: '', priorities: ['', '', ''], reviewItems: [], weekTag: wTag, pendingRollover: null, archiveError: null },
        () => this.detectRollover()
      )
    } else {
      this.setState({ weekTag: wTag, pendingRollover: null, archiveError: null }, () => this.detectRollover())
    }
  }

  resolveMonth(action: 'archive' | 'keep') {
    const mTag = monthTagOf(new Date())
    if (action === 'archive') {
      if (this.archivedOk.month !== true) {
        this.setState({ archiveError: 'month' })
        return
      }
      this.setState(
        { monthFocus: '', milestones: [], monthObs: '', monthCorr: '', monthTag: mTag, pendingRollover: null, archiveError: null },
        () => this.detectRollover()
      )
    } else {
      this.setState({ monthTag: mTag, pendingRollover: null, archiveError: null }, () => this.detectRollover())
    }
  }

  dismissRollover(kind: 'week' | 'month') {
    const tag = kind === 'week' ? weekTagOf(new Date()) : monthTagOf(new Date())
    this.dismissed.add(kind + ':' + tag)
    this.setState({ pendingRollover: null, archiveError: null })
  }

  renderRollover() {
    const kind = this.state.pendingRollover
    if (!kind) return null
    const now = new Date()
    const s = this.state
    const currency = this.props.currency ?? '$'
    if (kind === 'week') {
      const lines: { label: string; value: string }[] = []
      if (s.weekTheme.trim()) lines.push({ label: 'FOCUS', value: s.weekTheme.trim() })
      s.priorities.forEach((p, i) => {
        if (p.trim()) lines.push({ label: 'PRIORITY ' + pad(i + 1), value: p.trim() })
      })
      const touches = this.countThisWeek('topDone')
      if (touches) {
        lines.push({ label: 'ADVANCED', value: pad(touches) + ' / ' + pad(elapsedDaysThisWeek(now)) + ' DAYS' })
      }
      if (s.reviewItems.length) lines.push({ label: 'EVIDENCE', value: pad(s.reviewItems.length) + ' LOGGED' })
      return (
        <RolloverPrompt
          kind="week"
          endedLabel={weekLabelFromTag(s.weekTag || weekTagOf(now))}
          nextLabel={weekLabelFromTag(weekTagOf(now))}
          lines={lines}
          onArchive={() => this.resolveWeek('archive')}
          onKeep={() => this.resolveWeek('keep')}
          onLater={() => this.dismissRollover('week')}
          error={s.archiveError === 'week'}
        />
      )
    }
    const lines: { label: string; value: string }[] = []
    if (s.monthFocus.trim()) lines.push({ label: 'FOCUS', value: s.monthFocus.trim() })
    if (s.milestones.length) {
      const done = s.milestones.filter((m) => m.done).length
      lines.push({ label: 'MILESTONES', value: pad(done) + ' / ' + pad(s.milestones.length) })
    }
    const made = s.revMadeByMonth[s.monthTag]
    if (made) lines.push({ label: 'REVENUE', value: currency + made })
    if (s.monthObs.trim() || s.monthCorr.trim()) lines.push({ label: 'CHECK-IN', value: 'WRITTEN' })
    return (
      <RolloverPrompt
        kind="month"
        endedLabel={monthLabelFromTag(s.monthTag || monthTagOf(now)).toUpperCase()}
        nextLabel={monthLabelFromTag(monthTagOf(now)).toUpperCase()}
        lines={lines}
        onArchive={() => this.resolveMonth('archive')}
        onKeep={() => this.resolveMonth('keep')}
        onLater={() => this.dismissRollover('month')}
        error={s.archiveError === 'month'}
      />
    )
  }

  /* ---------- day record ---------- */

  today(): DayRec {
    return Object.assign({}, EMPTY_DAY, this.state.days[dateKey(new Date())] || {})
  }

  setToday(patch: Partial<DayRec>) {
    this.setDay(dateKey(new Date()), patch)
  }

  setDay(key: string, patch: Partial<DayRec>) {
    this.setState((s) => ({
      days: { ...s.days, [key]: Object.assign({}, EMPTY_DAY, s.days[key] || {}, patch) },
    }))
  }

  /* ---------- start-of-day intention ---------- */

  /** Open the Start of Day prompt on the first visit of each day. It's marked
   * seen on close, not open, so a remount mid-prompt brings it back. */
  maybePromptIntention() {
    if (this.state.intentionPromptSeen !== dateKey(new Date()) && !this.state.intentionOpen) {
      this.setState({ intentionOpen: true })
    }
  }

  closeIntention = () => {
    this.setState({ intentionOpen: false, intentionPromptSeen: dateKey(new Date()) })
  }

  /** The most recent earlier day (within a week) that had an intention set. */
  lastIntention(): { key: string; label: string; rec: DayRec } | null {
    const d = new Date()
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() - 1)
      const key = dateKey(d)
      const rec = this.state.days[key]
      if (rec && (rec.intention || '').trim()) {
        const label =
          i === 1
            ? 'YESTERDAY'
            : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '').toUpperCase()
        return { key, label, rec: Object.assign({}, EMPTY_DAY, rec) }
      }
    }
    return null
  }

  /** Consecutive days back from today (or yesterday, if today isn't done yet). */
  streak(field: 'leadDone' | 'postDone' | 'topDone') {
    let n = 0
    const d = new Date()
    const todayRec = this.state.days[dateKey(d)]
    if (!(todayRec && todayRec[field])) d.setDate(d.getDate() - 1)
    while (true) {
      const rec = this.state.days[dateKey(d)]
      if (rec && rec[field]) {
        n++
        d.setDate(d.getDate() - 1)
      } else break
      if (n > 3650) break
    }
    return n
  }

  /** The last seven days, oldest first. */
  dots(field: 'leadDone' | 'postDone' | 'topDone'): Dot[] {
    const out: Dot[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const rec = this.state.days[dateKey(d)]
      const done = !!(rec && rec[field])
      const isToday = i === 0
      out.push({
        key: i,
        on: done && !isToday,
        onToday: done && isToday,
        offPast: !done && !isToday,
        offToday: !done && isToday,
      })
    }
    return out
  }

  /** Monday–Sunday of the current week, so future days read as pending
   * rather than missed. */
  weekDots(field: 'leadDone' | 'postDone' | 'topDone'): WeekDot[] {
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    const todayKey = dateKey(new Date())
    return weekDates().map((d, i) => {
      const key = dateKey(d)
      const rec = this.state.days[key]
      const done = !!(rec && rec[field])
      const isToday = key === todayKey
      const isFuture = key > todayKey
      return {
        key,
        label: letters[i],
        on: done,
        todayOff: !done && isToday,
        pastOff: !done && !isToday && !isFuture,
        futureOff: !done && isFuture,
      }
    })
  }

  /** How many days so far this week had `field` set. Future days don't count. */
  countThisWeek(field: 'leadDone' | 'postDone' | 'topDone') {
    const todayKey = dateKey(new Date())
    let n = 0
    weekDates().forEach((d) => {
      const key = dateKey(d)
      if (key > todayKey) return
      const rec = this.state.days[key]
      if (rec && rec[field]) n++
    })
    return n
  }

  /* ---------- lists ---------- */

  listRows(key: 'tasks' | 'milestones', size = 17.5): Row[] {
    return (this.state[key] as Item[]).map((it, i) => ({
      key: it.id,
      idx: pad(i + 1),
      done: !!it.done,
      text: it.text,
      category: it.category,
      inputStyle: {
        flex: 1,
        minWidth: 0,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        fontSize: size,
        padding: '6px 0',
        color: it.done ? '#5a6566' : '#0e1415',
        textDecoration: it.done ? 'line-through' : 'none',
      } as React.CSSProperties,
      toggle: () =>
        this.setState((s) => ({
          [key]: (s[key] as Item[]).map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)),
        }) as any),
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const v = e.target.value
        this.setState((s) => ({
          [key]: (s[key] as Item[]).map((x) => (x.id === it.id ? { ...x, text: v } : x)),
        }) as any)
      },
      del: () =>
        this.setState((s) => ({
          [key]: (s[key] as Item[]).filter((x) => x.id !== it.id),
        }) as any),
    }))
  }

  /** Task rows for one list, re-indexed within that list. */
  taskRows(variant: 'work' | 'misc'): Row[] {
    const other: 'work' | 'misc' = variant === 'work' ? 'misc' : 'work'
    return this.listRows('tasks', variant === 'misc' ? 16 : 17.5)
      .filter((r) => (variant === 'work' ? r.category === 'work' : r.category !== 'work'))
      .map((r, i) => {
        const row: Row = {
          ...r,
          idx: pad(i + 1),
          move: () =>
            this.setState((s) => ({ tasks: s.tasks.map((x) => (x.id === r.key ? { ...x, category: other } : x)) })),
        }
        // Misc tasks sit a step back in the hierarchy while still open.
        if (variant === 'misc' && !r.done) row.inputStyle = { ...r.inputStyle, color: '#1b2223' }
        return row
      })
  }

  commit(
    listKey: 'tasks' | 'reviewItems' | 'milestones',
    draftKey: 'newWorkTask' | 'newMiscTask' | 'newReview' | 'newMilestone',
    category?: 'work' | 'misc'
  ) {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (this.state[draftKey] as string).trim()) {
        this.setState(
          (s) =>
            ({
              [listKey]: [
                ...(s[listKey] as Item[]),
                { id: Date.now(), text: (s[draftKey] as string).trim(), done: false, ...(category ? { category } : {}) },
              ],
              [draftKey]: '',
            }) as any
        )
      }
    }
  }

  /** Revenue is stored as the raw typed string, keyed by month. */
  setRevMade = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    const ym = monthTagOf(new Date())
    this.setState((p) => ({ revMadeByMonth: { ...p.revMadeByMonth, [ym]: v } }))
  }

  commitText(listKey: 'priorities', draftKey: 'newPriority') {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (this.state[draftKey] as string).trim()) {
        this.setState(
          (s) =>
            ({
              [listKey]: [...(s[listKey] as string[]), (s[draftKey] as string).trim()],
              [draftKey]: '',
            }) as any
        )
      }
    }
  }

  render() {
    const s = this.state
    const accent = this.props.accent ?? '#0b6c71'
    const currency = this.props.currency ?? '$'
    const now = new Date()
    const t = this.today()
    const todayKey = dateKey(now)

    /* --- revenue --- */
    const ym = monthTagOf(now)
    const madeNum = parseAmount(s.revMadeByMonth[ym])
    const goalNum = parseAmount(s.revGoal)
    const revMap = revenueByMonth(s.archive, s.revMadeByMonth)
    const yearTotalNum = Object.keys(revMap)
      .filter((k) => k.indexOf(now.getFullYear() + '-') === 0)
      .reduce((a, k) => a + revMap[k], 0)
    const revPct = goalNum > 0 ? Math.min(999, Math.round((madeNum / goalNum) * 100)) : 0
    const revFilled = goalNum > 0 ? Math.max(0, Math.min(10, Math.floor((madeNum / goalNum) * 10))) : 0
    const yearGoalNum = goalNum * 12
    const yearPct = yearGoalNum > 0 ? Math.min(999, Math.round((yearTotalNum / yearGoalNum) * 100)) : 0
    const yearFilled = yearGoalNum > 0 ? Math.max(0, Math.min(10, Math.floor((yearTotalNum / yearGoalNum) * 10))) : 0

    /* --- calendar --- */
    const dim = daysInMonth(now)
    const dayOfMonth = now.getDate()
    const daysLeftMonth = dim - dayOfMonth
    const expected = goalNum * (dayOfMonth / dim)
    const perDay = Math.ceil((goalNum - madeNum) / Math.max(1, dim - dayOfMonth + 1))
    const elapsed = elapsedDaysThisWeek(now)
    const daysLeftWeek = 7 - elapsed
    const dayOfYearLabel = 'D' + dayOfYear(now) + ' / 365'
    const monthLeftLabel = 'T−' + pad(daysLeftMonth) + 'D'

    /* --- intention --- */
    const dayIntent = (t.intention || '').trim()
    const prevIntent = s.intentionOpen ? this.lastIntention() : null
    const intentStreak = this.streak('topDone')
    const nudgeText = dayIntent && !t.topDone && intentStreak > 0 ? 'STREAK ' + pad(intentStreak) + 'D · NOT YET TODAY' : ''
    const touchLabel = !dayIntent
      ? 'NO INTENTION SET'
      : t.topDone
        ? 'COMPLETED · STREAK ' + pad(intentStreak) + 'D'
        : 'NOT YET COMPLETED'

    /* --- lists --- */
    const workRows = this.taskRows('work')
    const miscRows = this.taskRows('misc')
    const doneCount = s.tasks.filter((x) => x.done).length
    const openCount = s.tasks.length - doneCount
    const msDone = s.milestones.filter((m) => m.done).length
    const msTotal = s.milestones.length
    const openTasks = s.tasks.filter((x) => !x.done && (x.text || '').trim())

    /* --- archive --- */
    const entries = buildEntries(s.archive, s, currency, now)
    const detail = monthDetail(entries, s.openPeriod)

    const titles: Record<string, string> = {
      today: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase() + ' ' + now.getFullYear(),
      week: 'WEEK ' + pad(isoWeek(now)),
      month: now.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase() + ' ' + now.getFullYear(),
      timeline: detail ? monthLabelFromTag(s.openPeriod!).toUpperCase() : 'ARCHIVE',
    }
    const kickers: Record<string, string> = {
      today: now.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase(),
      week: weekRange(now),
      month: 'MONTH ' + pad(now.getMonth() + 1) + ' OF 12',
      timeline: detail ? (detail.live ? 'IN PROGRESS' : 'ARCHIVED') : 'ALL PERIODS',
    }

    const isTimeline = s.activeTab === 'timeline'
    const navItems = [
      { key: 'today', label: 'Today', meta: openCount > 0 ? pad(openCount) : '' },
      { key: 'week', label: 'Week', meta: pad(daysLeftWeek) + 'D' },
      { key: 'month', label: 'Month', meta: goalNum > 0 ? revPct + '%' : '' },
      { key: 'timeline', label: 'Archive', meta: s.archive.length ? pad(s.archive.length) : '' },
    ].map((it, i) => ({
      ...it,
      idx: pad(i + 1),
      active: s.activeTab === it.key,
      onClick: () => this.setState({ activeTab: it.key }, () => this.detectRollover()),
    }))

    return (
      <div style={{ display: 'contents', ['--accent' as any]: accent }}>
        <Shell
          navItems={navItems}
          email={this.props.email ?? ''}
          onSignOut={this.props.onSignOut}
          dayOfYearLabel={dayOfYearLabel}
          weekLabel={'W' + pad(isoWeek(now))}
          quarterLabel={'Q' + (Math.floor(now.getMonth() / 3) + 1)}
          intentionBtnLabel={dayIntent ? 'INTENTION SET' : 'START OF DAY'}
          onOpenIntention={() => this.setState({ intentionOpen: true })}
          onOpenReflection={() => this.setState({ reflectionOpen: true })}
          pageKicker={kickers[s.activeTab]}
          pageTitle={titles[s.activeTab]}
          revHeaderLabel={
            isTimeline
              ? 'REVENUE · ' + now.getFullYear()
              : 'REVENUE · ' + now.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
          }
          revPctLabel={isTimeline ? (yearGoalNum > 0 ? yearPct + '%' : '—') : goalNum > 0 ? revPct + '%' : '—'}
          revTotal={(isTimeline ? yearTotalNum : madeNum).toLocaleString('en-US')}
          revRaw={s.revMadeByMonth[ym] ?? ''}
          revEditable={!isTimeline}
          setRevMade={this.setRevMade}
          revFilled={isTimeline ? yearFilled : revFilled}
        >
          {s.activeTab === 'today' && (
            <Today
              quoteOpen={s.quoteSeen !== todayKey}
              onDismissQuote={() => this.setState({ quoteSeen: todayKey })}
              onRecallQuote={() => this.setState({ quoteSeen: '' })}
              dayOfYearLabel={dayOfYearLabel}
              intentionText={t.intention || ''}
              setIntention={(e) => this.setToday({ intention: e.target.value })}
              onOpenIntention={() => this.setState({ intentionOpen: true })}
              statusText={nudgeText || touchLabel}
              statusIsNudge={!!nudgeText}
              weekDots={this.weekDots('topDone')}
              topDone={!!t.topDone}
              toggleTop={() => this.setToday({ topDone: !this.today().topDone })}
              workRows={workRows}
              miscRows={miscRows}
              workCountLabel={pad(workRows.filter((r) => r.done).length) + '/' + pad(workRows.length)}
              miscCountLabel={pad(miscRows.filter((r) => r.done).length) + '/' + pad(miscRows.length)}
              nextWorkIdx={pad(workRows.length + 1)}
              nextMiscIdx={pad(miscRows.length + 1)}
              newWorkTask={s.newWorkTask}
              setNewWorkTask={(e) => this.setState({ newWorkTask: e.target.value })}
              onWorkKey={this.commit('tasks', 'newWorkTask', 'work')}
              newMiscTask={s.newMiscTask}
              setNewMiscTask={(e) => this.setState({ newMiscTask: e.target.value })}
              onMiscKey={this.commit('tasks', 'newMiscTask', 'misc')}
              progressLabel={pad(doneCount) + ' / ' + pad(s.tasks.length) + ' CLEARED'}
              onPurge={() => this.setState((prev) => ({ tasks: prev.tasks.filter((x) => !x.done) }))}
              leadDone={t.leadDone}
              leadWho={t.leadWho}
              setLeadWho={(e) => this.setToday({ leadWho: e.target.value })}
              toggleLead={() => this.setToday({ leadDone: !this.today().leadDone })}
              leadDots={this.dots('leadDone')}
              leadStreakLabel={'STREAK ' + pad(this.streak('leadDone'))}
              postDone={t.postDone}
              postWhat={t.postWhat}
              setPostWhat={(e) => this.setToday({ postWhat: e.target.value })}
              togglePost={() => this.setToday({ postDone: !this.today().postDone })}
              postDots={this.dots('postDone')}
              postStreakLabel={'STREAK ' + pad(this.streak('postDone'))}
              monthFocus={s.monthFocus}
              setMonthFocus={(e) => this.setState({ monthFocus: e.target.value })}
              monthLeftLabel={monthLeftLabel}
              msCountLabel={pad(msDone) + '/' + pad(msTotal)}
              msDone={msDone}
              msTotal={msTotal}
              openMilestones={this.listRows('milestones').filter((r) => !r.done).slice(0, 3)}
              milestoneEmptyLabel={msTotal > 0 ? 'ALL COMPLETE' : 'NONE SET'}
            />
          )}

          {s.activeTab === 'week' && (
            <Week
              weekTheme={s.weekTheme}
              setWeekTheme={(e) => this.setState({ weekTheme: e.target.value })}
              priorityRows={s.priorities.map((text, idx) => ({
                key: idx,
                idx: pad(idx + 1),
                text,
                placeholder: idx === 0 ? 'the one thing that matters this week…' : 'priority ' + (idx + 1) + '…',
                onChange: (e) => {
                  const v = e.target.value
                  this.setState((prev) => {
                    const p = prev.priorities.slice()
                    p[idx] = v
                    return { priorities: p }
                  })
                },
                del: () => this.setState((prev) => ({ priorities: prev.priorities.filter((_, i) => i !== idx) })),
              }))}
              nextPriorityIdx={pad(s.priorities.length + 1)}
              newPriority={s.newPriority}
              setNewPriority={(e) => this.setState({ newPriority: e.target.value })}
              onPriorityKey={this.commitText('priorities', 'newPriority')}
              reviewRows={s.reviewItems.map((it) => ({
                key: it.id,
                text: it.text,
                onChange: (e) => {
                  const v = e.target.value
                  this.setState((prev) => ({
                    reviewItems: prev.reviewItems.map((x) => (x.id === it.id ? { ...x, text: v } : x)),
                  }))
                },
                del: () => this.setState((prev) => ({ reviewItems: prev.reviewItems.filter((x) => x.id !== it.id) })),
              }))}
              newReview={s.newReview}
              setNewReview={(e) => this.setState({ newReview: e.target.value })}
              onReviewKey={this.commit('reviewItems', 'newReview')}
              weekLeftLabel={pad(daysLeftWeek) + 'D LEFT'}
              score={[
                { key: 'top', label: 'Intention completed', value: pad(this.countThisWeek('topDone')) + '/' + pad(elapsed) },
                { key: 'lead', label: 'One Lead', value: pad(this.countThisWeek('leadDone')) + '/' + pad(elapsed) },
                { key: 'post', label: 'One Post', value: pad(this.countThisWeek('postDone')) + '/' + pad(elapsed) },
                { key: 'wins', label: 'Evidence logged', value: pad(s.reviewItems.length) },
              ]}
            />
          )}

          {s.activeTab === 'month' && (
            <Month
              monthFocus={s.monthFocus}
              setMonthFocus={(e) => this.setState({ monthFocus: e.target.value })}
              milestoneRows={this.listRows('milestones')}
              msCountLabel={pad(msDone) + '/' + pad(msTotal)}
              nextMilestoneIdx={pad(msTotal + 1)}
              newMilestone={s.newMilestone}
              setNewMilestone={(e) => this.setState({ newMilestone: e.target.value })}
              onMilestoneKey={this.commit('milestones', 'newMilestone')}
              currency={currency}
              revMade={s.revMadeByMonth[ym] ?? ''}
              setRevMade={this.setRevMade}
              revGoal={s.revGoal}
              setRevGoal={(e) => this.setState({ revGoal: e.target.value })}
              revFilled={revFilled}
              monthLeftLabel={monthLeftLabel}
              paceLines={[
                {
                  key: 'exp',
                  label: 'Should be at, day ' + dayOfMonth,
                  value: goalNum > 0 ? currency + Math.round(expected).toLocaleString('en-US') : '—',
                },
                {
                  key: 'gap',
                  label: madeNum >= expected ? 'Ahead by' : 'Gap to pace',
                  value: goalNum > 0 ? currency + Math.abs(Math.round(madeNum - expected)).toLocaleString('en-US') : '—',
                },
                {
                  key: 'run',
                  label: 'Per remaining day',
                  value: goalNum > 0 && madeNum < goalNum ? currency + perDay.toLocaleString('en-US') : '—',
                },
              ]}
              monthObs={s.monthObs}
              setMonthObs={(e) => this.setState({ monthObs: e.target.value })}
              monthCorr={s.monthCorr}
              setMonthCorr={(e) => this.setState({ monthCorr: e.target.value })}
            />
          )}

          {isTimeline && (
            <Archive
              cards={monthCards(entries)}
              detail={detail}
              onOpen={(tag) => this.setState({ openPeriod: tag })}
              onClose={() => this.setState({ openPeriod: null })}
            />
          )}
        </Shell>

        {s.intentionOpen && !s.pendingRollover && (
          <IntentionModal
            dayOfYearLabel={dayOfYearLabel}
            review={
              prevIntent
                ? {
                    label: prevIntent.label,
                    text: prevIntent.rec.intention.trim(),
                    done: !!prevIntent.rec.topDone,
                    markDone: () => this.setDay(prevIntent.key, { topDone: true }),
                    carry: () => this.setToday({ intention: prevIntent.rec.intention.trim() }),
                    carried: dayIntent === prevIntent.rec.intention.trim(),
                  }
                : null
            }
            intentionText={t.intention || ''}
            setIntention={(e) => this.setToday({ intention: e.target.value })}
            options={openTasks.map((x) => ({
              key: x.id,
              text: x.text,
              selected: (x.text || '').trim() === dayIntent,
              tag: x.category === 'work' ? 'WORK' : 'MISC',
              pick: () => this.setToday({ intention: x.text }),
            }))}
            onClose={this.closeIntention}
          />
        )}

        {s.reflectionOpen && (
          <ReflectionModal
            dayOfYearLabel={dayOfYearLabel}
            dayTitle={titles.today}
            lines={[
              { key: 'top', label: 'Intention completed', value: t.topDone ? 'YES' : 'NO' },
              { key: 'lead', label: 'One Lead', value: t.leadDone ? 'YES' : 'NO' },
              { key: 'post', label: 'One Post', value: t.postDone ? 'YES' : 'NO' },
              { key: 'tasks', label: 'Tasks cleared', value: pad(doneCount) + ' / ' + pad(s.tasks.length) },
            ]}
            wentWell={t.wentWell || ''}
            setWentWell={(e) => this.setToday({ wentWell: e.target.value })}
            improve={t.improve || ''}
            setImprove={(e) => this.setToday({ improve: e.target.value })}
            gratitude={(t.gratitude || []).filter(Boolean).join('\n')}
            setGratitude={(e) => this.setToday({ gratitude: e.target.value.split('\n') })}
            onClose={() => this.setState({ reflectionOpen: false })}
          />
        )}

        {this.renderRollover()}
      </div>
    )
  }
}
