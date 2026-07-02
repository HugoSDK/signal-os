import React from 'react'
import RolloverPrompt from './components/RolloverPrompt'

/* ------------------------------------------------------------------ *
 * Faithful port of the Signal Ledger export (was a "DC" React class). *
 * Logic is preserved verbatim; the <x-dc> template is translated to   *
 * JSX. A css() helper lets us reuse the exact inline-style strings;   *
 * :hover / :focus effects live in index.css classes.                  *
 * ------------------------------------------------------------------ */

type Dict = Record<string, any>

const css = (s: string): React.CSSProperties => {
  const o: Dict = {}
  for (const rule of s.split(';')) {
    const r = rule.trim()
    if (!r) continue
    const i = r.indexOf(':')
    if (i < 0) continue
    let k = r.slice(0, i).trim()
    const v = r.slice(i + 1).trim()
    if (k.startsWith('--')) {
      o[k] = v
    } else {
      o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
    }
  }
  return o as React.CSSProperties
}

export interface Item {
  id: number
  text: string
  done?: boolean
}
export interface DayRec {
  leadWho: string
  leadDone: boolean
  postWhat: string
  postDone: boolean
  gratitude: string[]
}
export interface State {
  activeTab: string
  tasks: Item[]
  hardStop: string
  newTask: string
  days: Record<string, DayRec>
  weekTheme: string
  priorities: string[]
  objectives: Item[]
  newObjective: string
  reviewItems: Item[]
  newReview: string
  monthFocus: string
  milestones: Item[]
  newMilestone: string
  monthObs: string
  monthCorr: string
  revGoal: string
  revMadeByMonth: Record<string, string>
  weekTag: string
  monthTag: string
  pendingRollover: 'week' | 'month' | null
}

export interface LedgerProps {
  accent?: string
  currency?: string
  /** Optional initial state (e.g. loaded from the DB). Falls back to localStorage + defaults. */
  initialState?: Partial<State> | null
  /** Called after every state change (localStorage is always written; this is for remote sync). */
  onPersist?: (state: State) => void
  /** Persist a period snapshot to history (rollover "archive"). */
  onArchive?: (row: { period_type: 'week' | 'month'; period_tag: string; snapshot: Record<string, unknown> }) => void
  userId?: string
}

export const DEFAULT_STATE: State = {
  activeTab: 'daily',
  tasks: [],
  hardStop: '18:00',
  newTask: '',
  days: {},
  weekTheme: '',
  priorities: ['', '', ''],
  objectives: [],
  newObjective: '',
  reviewItems: [],
  newReview: '',
  monthFocus: '',
  milestones: [],
  newMilestone: '',
  monthObs: '',
  monthCorr: '',
  revGoal: '5000',
  revMadeByMonth: {},
  weekTag: '',
  monthTag: '',
  pendingRollover: null,
}

const EMPTY_DAY: DayRec = { leadWho: '', leadDone: false, postWhat: '', postDone: false, gratitude: ['', '', ''] }

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
    this.state = Object.assign({}, DEFAULT_STATE, saved || {}, {
      newTask: '',
      newObjective: '',
      newReview: '',
      newMilestone: '',
      pendingRollover: null,
    })
  }

  dismissed = new Set<string>()

  componentDidMount() {
    this.detectRollover()
  }

  componentDidUpdate() {
    try {
      window.localStorage.setItem('signal_ledger_v1', JSON.stringify(this.state))
    } catch (e) {
      /* ignore */
    }
    this.props.onPersist?.(this.state)
  }

  /* ---------- period rollover ---------- */

  weekTag(d: Date) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7)
    return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0')
  }

  monthTag(d: Date) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
  }

  weekHasContent(s: State) {
    return !!(s.weekTheme.trim() || s.priorities.some((p) => p.trim()) || s.reviewItems.length)
  }

  monthHasContent(s: State) {
    return !!(s.monthFocus.trim() || s.milestones.length || s.monthObs.trim() || s.monthCorr.trim())
  }

  detectRollover() {
    if (this.state.pendingRollover) return
    const now = new Date()
    const wTag = this.weekTag(now)
    const mTag = this.monthTag(now)
    const s = this.state
    const patch: any = {}
    let pending: 'week' | 'month' | null = null

    if (!s.weekTag) patch.weekTag = wTag
    else if (s.weekTag !== wTag) {
      if (this.weekHasContent(s) && !this.dismissed.has('week:' + wTag)) pending = 'week'
      else patch.weekTag = wTag
    }

    if (!s.monthTag) patch.monthTag = mTag
    else if (s.monthTag !== mTag) {
      if (this.monthHasContent(s) && !this.dismissed.has('month:' + mTag)) {
        if (!pending) pending = 'month'
      } else patch.monthTag = mTag
    }

    if (pending) patch.pendingRollover = pending
    if (Object.keys(patch).length) this.setState(patch)
  }

  resolveWeek(action: 'archive' | 'keep') {
    const wTag = this.weekTag(new Date())
    const s = this.state
    if (action === 'archive') {
      this.props.onArchive?.({
        period_type: 'week',
        period_tag: s.weekTag,
        snapshot: { weekTheme: s.weekTheme, priorities: s.priorities, reviewItems: s.reviewItems },
      })
      this.setState(
        { weekTheme: '', priorities: ['', '', ''], reviewItems: [], weekTag: wTag, pendingRollover: null },
        () => this.detectRollover()
      )
    } else {
      this.setState({ weekTag: wTag, pendingRollover: null }, () => this.detectRollover())
    }
  }

  resolveMonth(action: 'archive' | 'keep') {
    const mTag = this.monthTag(new Date())
    const s = this.state
    if (action === 'archive') {
      this.props.onArchive?.({
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
      this.setState(
        { monthFocus: '', milestones: [], monthObs: '', monthCorr: '', monthTag: mTag, pendingRollover: null },
        () => this.detectRollover()
      )
    } else {
      this.setState({ monthTag: mTag, pendingRollover: null }, () => this.detectRollover())
    }
  }

  dismissRollover(kind: 'week' | 'month') {
    const tag = kind === 'week' ? this.weekTag(new Date()) : this.monthTag(new Date())
    this.dismissed.add(kind + ':' + tag)
    this.setState({ pendingRollover: null })
  }

  weekLabelFromTag(tag: string) {
    const wk = tag.split('-W')[1]
    return wk ? 'Week ' + String(Number(wk)) : tag
  }

  monthLabelFromTag(tag: string) {
    const [y, m] = tag.split('-')
    if (!y || !m) return tag
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  renderRollover() {
    const kind = this.state.pendingRollover
    if (!kind) return null
    const now = new Date()
    const s = this.state
    if (kind === 'week') {
      const lines: { label: string; value: string }[] = []
      if (s.weekTheme.trim()) lines.push({ label: 'FOCUS', value: s.weekTheme.trim() })
      s.priorities.forEach((p, i) => {
        if (p.trim()) lines.push({ label: 'PRIORITY ' + (i + 1), value: p.trim() })
      })
      if (s.reviewItems.length) lines.push({ label: 'WINS', value: s.reviewItems.length + ' logged' })
      return (
        <RolloverPrompt
          kind="week"
          endedLabel={this.weekLabelFromTag(s.weekTag)}
          nextLabel={this.weekLabelFromTag(this.weekTag(now))}
          lines={lines}
          onArchive={() => this.resolveWeek('archive')}
          onKeep={() => this.resolveWeek('keep')}
          onLater={() => this.dismissRollover('week')}
        />
      )
    }
    const lines: { label: string; value: string }[] = []
    if (s.monthFocus.trim()) lines.push({ label: 'FOCUS', value: s.monthFocus.trim() })
    if (s.milestones.length) {
      const done = s.milestones.filter((m) => m.done).length
      lines.push({ label: 'MILESTONES', value: done + '/' + s.milestones.length + ' done' })
    }
    const made = s.revMadeByMonth[s.monthTag]
    if (made) lines.push({ label: 'REVENUE', value: (this.props.currency ?? '$') + made })
    if (s.monthObs.trim() || s.monthCorr.trim()) lines.push({ label: 'CHECK-IN', value: 'written' })
    return (
      <RolloverPrompt
        kind="month"
        endedLabel={this.monthLabelFromTag(s.monthTag)}
        nextLabel={this.monthLabelFromTag(this.monthTag(now))}
        lines={lines}
        onArchive={() => this.resolveMonth('archive')}
        onKeep={() => this.resolveMonth('keep')}
        onLater={() => this.dismissRollover('month')}
      />
    )
  }

  dateKey(d: Date) {
    const p = (n: number) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
  }

  today(): DayRec {
    const key = this.dateKey(new Date())
    return Object.assign({}, EMPTY_DAY, this.state.days[key] || {})
  }

  setToday(patch: Partial<DayRec>) {
    const key = this.dateKey(new Date())
    this.setState((s) => ({
      days: { ...s.days, [key]: Object.assign({}, EMPTY_DAY, s.days[key] || {}, patch) },
    }))
  }

  streak(field: 'leadDone' | 'postDone') {
    let n = 0
    const d = new Date()
    const todayRec = this.state.days[this.dateKey(d)]
    if (!(todayRec && todayRec[field])) d.setDate(d.getDate() - 1)
    while (true) {
      const rec = this.state.days[this.dateKey(d)]
      if (rec && rec[field]) {
        n++
        d.setDate(d.getDate() - 1)
      } else break
      if (n > 3650) break
    }
    return n
  }

  dots(field: 'leadDone' | 'postDone') {
    const out: { key: number; on: boolean; onToday: boolean; offPast: boolean; offToday: boolean }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const rec = this.state.days[this.dateKey(d)]
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

  isoWeek(d: Date) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    return Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7)
  }

  weekRange() {
    const now = new Date()
    const day = now.getDay() || 7
    const mon = new Date(now)
    mon.setDate(now.getDate() - day + 1)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const fmt = (d: Date) => d.getDate() + ' ' + d.toLocaleDateString('en-GB', { month: 'long' })
    return fmt(mon) + ' – ' + fmt(sun)
  }

  listRows(key: 'tasks' | 'milestones') {
    return (this.state[key] as Item[]).map((it) => ({
      key: it.id,
      done: !!it.done,
      notDone: !it.done,
      text: it.text,
      inputStyle: {
        flex: 1,
        minWidth: 0,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        fontSize: 14,
        padding: '8px 0',
        fontWeight: it.done ? 400 : 500,
        color: it.done ? '#a89f90' : '#1c1917',
        textDecoration: it.done ? 'line-through' : 'none',
      } as React.CSSProperties,
      toggle: () =>
        this.setState((s) => ({
          [key]: (s[key] as Item[]).map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)),
        }) as any),
      onChange: (e: any) => {
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

  commit(listKey: 'tasks' | 'reviewItems' | 'milestones', draftKey: 'newTask' | 'newReview' | 'newMilestone') {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (this.state[draftKey] as string).trim()) {
        this.setState(
          (s) =>
            ({
              [listKey]: [...(s[listKey] as Item[]), { id: Date.now(), text: (s[draftKey] as string).trim(), done: false }],
              [draftKey]: '',
            }) as any
        )
      }
    }
  }

  /* ---------- small render helpers ---------- */

  check(done: boolean, onClick: () => void, size: number, label: string) {
    const style = { width: size, height: size } as React.CSSProperties
    if (done) {
      return (
        <button onClick={onClick} aria-label={label} className="chk done" style={style}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f7f4ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )
    }
    return <button onClick={onClick} aria-label={label} className="chk todo" style={style} />
  }

  delBtn(onClick: () => void, label: string, show = false) {
    return (
      <button onClick={onClick} aria-label={label} className={show ? 'del show' : 'del'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    )
  }

  renderDots(dots: ReturnType<Ledger['dots']>) {
    const base = 'display:block;width:8px;height:8px;border-radius:99px'
    return dots.map((d) => {
      if (d.on) return <span key={d.key} style={css(base + ';background:var(--accent,#7c2d12)')} />
      if (d.onToday) return <span key={d.key} style={css(base + ';background:var(--accent,#7c2d12);outline:1px solid #1c1917;outline-offset:1.5px')} />
      if (d.offPast) return <span key={d.key} style={css(base + ';background:#ded7c8')} />
      return <span key={d.key} style={css(base + ';background:#fdfcf9;border:1px solid #b5ab9a')} />
    })
  }

  render() {
    const s = this.state
    const accent = this.props.accent ?? '#7c2d12'
    const currency = this.props.currency ?? '$'
    const now = new Date()
    const t = this.today()

    const titles: Dict = {
      daily: now.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' }),
      weekly: 'Week ' + this.isoWeek(now),
      monthly: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    }
    const metas: Dict = {
      daily: 'Week ' + this.isoWeek(now) + ' · ' + now.getFullYear(),
      weekly: this.weekRange(),
      monthly: 'Month ' + (now.getMonth() + 1) + ' of 12',
    }

    const doneCount = s.tasks.filter((x) => x.done).length
    const leadStreak = this.streak('leadDone')
    const postStreak = this.streak('postDone')

    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
    const parseAmt = (v: any) => Number(String(v == null ? '' : v).replace(/[^0-9.]/g, '')) || 0
    const madeNum = parseAmt(s.revMadeByMonth[ym])
    const goalNum = parseAmt(s.revGoal)
    const revPct = goalNum > 0 ? Math.min(999, Math.round((madeNum / goalNum) * 100)) : 0
    const revFilled = goalNum > 0 ? Math.max(0, Math.min(10, Math.floor((madeNum / goalNum) * 10))) : 0

    const isDaily = s.activeTab === 'daily'
    const isWeekly = s.activeTab === 'weekly'
    const isMonthly = s.activeTab === 'monthly'

    const taskRows = this.listRows('tasks')
    const milestoneRows = this.listRows('milestones')
    const leadDots = this.dots('leadDone')
    const postDots = this.dots('postDone')

    const tabs = ['Daily', 'Weekly', 'Monthly'].map((label) => {
      const id = label.toLowerCase()
      return { label, active: s.activeTab === id, onClick: () => this.setState({ activeTab: id }, () => this.detectRollover()) }
    })

    return (
      <>
      <div style={css('min-height:100vh;padding:20px')}>
        <div style={{ display: 'contents', ['--accent' as any]: accent }}>
          <div style={css('max-width:none;margin:0;min-height:calc(100vh - 40px);background:#f7f4ee;border:1px solid #e0d9ca;box-shadow:0 2px 16px rgba(60,50,30,0.08);border-radius:2px')}>
            {/* ---------- header ---------- */}
            <div style={css('padding:28px 40px 0')}>
              <div style={css('display:flex;justify-content:space-between;align-items:baseline')}>
                <span style={css('font-size:15.2px;font-weight:600;letter-spacing:0.18em;color:#8a8175')}>SIGNAL — LEDGER</span>
                <div style={css('display:flex;gap:20px')}>
                  {tabs.map((tab) => (
                    <button key={tab.label} onClick={tab.onClick} className={'tab ' + (tab.active ? 'active' : 'inactive')}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={css('display:flex;justify-content:space-between;align-items:baseline;margin-top:18px;padding-bottom:22px;border-bottom:1px solid #e3ddd0')}>
                <h1 style={css("margin:0;font-family:'Source Serif 4',serif;font-size:44.9px;font-weight:600;letter-spacing:-0.01em;color:#1c1917")}>{titles[s.activeTab]}</h1>
                <span style={css("font-family:'Source Serif 4',serif;font-style:italic;font-size:20.3px;color:#8a8175")}>{metas[s.activeTab]}</span>
              </div>
              {/* revenue bar */}
              <div style={css('display:flex;align-items:center;gap:14px;padding:12px 0 13px')}>
                <span style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175;flex:none')}>
                  {'PROJECT REVENUE — ' + now.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase()}
                </span>
                <div style={css('display:flex;gap:3px;flex:none')}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} style={css('display:block;width:16px;height:6px;border-radius:2px;background:' + (i < revFilled ? 'var(--accent,#7c2d12)' : '#ded7c8'))} />
                  ))}
                </div>
                <span style={css('font-size:15.9px;font-weight:600;color:var(--accent,#7c2d12);flex:none')}>{goalNum > 0 ? revPct + '%' : '—'}</span>
                <span style={css('flex:1')} />
                <div style={css('display:flex;align-items:baseline;gap:6px;flex:none')}>
                  <span style={css("font-family:'Source Serif 4',serif;font-size:19.6px;font-weight:600;color:#1c1917")}>{currency}</span>
                  <input
                    type="text"
                    value={s.revMadeByMonth[ym] ?? ''}
                    onChange={(e) => { const v = e.target.value; this.setState((p) => ({ revMadeByMonth: { ...p.revMadeByMonth, [ym]: v } })) }}
                    placeholder="0"
                    aria-label="Made this month"
                    className="uin ul"
                    style={css("width:70px;font-family:'Source Serif 4',serif;font-size:21.8px;font-weight:600;color:#1c1917;padding:2px 0;text-align:right")}
                  />
                  <span style={css('font-size:16.7px;color:#8a8175')}>of</span>
                  <span style={css("font-family:'Source Serif 4',serif;font-size:18.8px;color:#8a8175")}>{currency}</span>
                  <input
                    type="text"
                    value={s.revGoal}
                    onChange={(e) => this.setState({ revGoal: e.target.value })}
                    placeholder="goal"
                    aria-label="Monthly goal"
                    className="uin ul"
                    style={css("width:60px;font-family:'Source Serif 4',serif;font-size:19.6px;color:#8a8175;padding:2px 0;text-align:right")}
                  />
                </div>
              </div>
            </div>

            {/* ---------- DAILY ---------- */}
            {isDaily && (
              <div style={css('display:grid;grid-template-columns:1.2fr 1fr')}>
                {/* today's list */}
                <div style={css('padding:26px 32px 32px 40px;border-right:1px solid #e3ddd0')}>
                  <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175;margin-bottom:10px')}>TODAY'S LIST</div>
                  <div style={css('display:flex;flex-direction:column')}>
                    {taskRows.map((row) => (
                      <div key={row.key} style={css('display:flex;gap:12px;align-items:center;padding:4px 0;border-bottom:1px solid #eae4d8')}>
                        {this.check(row.done, row.toggle, 18, row.done ? 'Mark not done' : 'Mark done')}
                        <input type="text" value={row.text} onChange={row.onChange} placeholder="…" className="uin" style={row.inputStyle} />
                        {this.delBtn(row.del, 'Delete task')}
                      </div>
                    ))}
                    <div style={css('display:flex;gap:12px;align-items:center;padding:8px 0')}>
                      <span style={css('width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#b5ab9a;flex:none')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={s.newTask}
                        onChange={(e) => this.setState({ newTask: e.target.value })}
                        onKeyDown={this.commit('tasks', 'newTask')}
                        placeholder="add a line, press Enter…"
                        className="uin"
                        style={css("flex:1;min-width:0;font-family:'Source Serif 4',serif;font-style:italic;font-size:20.3px;color:#44403c;padding:4px 0")}
                      />
                    </div>
                  </div>
                  <div style={css('margin-top:24px;padding-top:14px;border-top:1px solid #e3ddd0;display:flex;justify-content:space-between;align-items:center;font-size:16.7px;color:#8a8175')}>
                    <span>{s.tasks.length === 0 ? 'Nothing planned yet' : doneCount + ' of ' + s.tasks.length + ' complete'}</span>
                    <div style={css('display:flex;align-items:center;gap:14px')}>
                      <button onClick={() => this.setState((prev) => ({ tasks: prev.tasks.filter((x) => !x.done) }))} className="linkbtn" style={css('font-size:16.7px')}>
                        Clear completed
                      </button>
                    </div>
                  </div>
                </div>

                {/* daily reps + gratitude */}
                <div style={css('padding:26px 40px 32px 32px;display:flex;flex-direction:column;gap:26px')}>
                  <div>
                    <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175;margin-bottom:12px')}>DAILY REPS</div>
                    <div style={css('border:1px solid #ded7c8;border-radius:6px;background:#fdfcf9')}>
                      {/* One Lead */}
                      <div style={css('padding:14px 16px;border-bottom:1px solid #eee8db')}>
                        <div style={css('display:flex;justify-content:space-between;align-items:center')}>
                          <span style={css("font-family:'Source Serif 4',serif;font-weight:600;font-size:21.8px;color:#1c1917")}>One Lead</span>
                          {this.check(t.leadDone, () => this.setToday({ leadDone: !this.today().leadDone }), 20, 'Toggle One Lead')}
                        </div>
                        <div style={css('font-size:16.7px;color:#a89f90;margin-top:2px')}>One new person or org that could bring business.</div>
                        <input
                          type="text"
                          value={t.leadWho}
                          onChange={(e) => this.setToday({ leadWho: e.target.value })}
                          placeholder="Who — person or organisation…"
                          className="uin ul-e"
                          style={css('width:100%;font-size:18.1px;color:#44403c;padding:7px 0 5px;margin-top:4px')}
                        />
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:11px')}>
                          <div style={css('display:flex;gap:3px')}>{this.renderDots(leadDots)}</div>
                          <span style={css('font-size:15.9px;font-weight:600;color:var(--accent,#7c2d12)')}>{leadStreak === 0 ? 'start today' : leadStreak + '-day streak'}</span>
                        </div>
                      </div>
                      {/* One Post */}
                      <div style={css('padding:14px 16px')}>
                        <div style={css('display:flex;justify-content:space-between;align-items:center')}>
                          <span style={css("font-family:'Source Serif 4',serif;font-weight:600;font-size:21.8px;color:#1c1917")}>One Post</span>
                          {this.check(t.postDone, () => this.setToday({ postDone: !this.today().postDone }), 20, 'Toggle One Post')}
                        </div>
                        <div style={css('font-size:16.7px;color:#a89f90;margin-top:2px')}>Publish one piece of content, every day.</div>
                        <input
                          type="text"
                          value={t.postWhat}
                          onChange={(e) => this.setToday({ postWhat: e.target.value })}
                          placeholder="What went out — post, clip, article…"
                          className="uin ul-e"
                          style={css('width:100%;font-size:18.1px;color:#44403c;padding:7px 0 5px;margin-top:4px')}
                        />
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:11px')}>
                          <div style={css('display:flex;gap:3px')}>{this.renderDots(postDots)}</div>
                          <span style={css('font-size:15.9px;font-weight:600;color:var(--accent,#7c2d12)')}>{postStreak === 0 ? 'start today' : postStreak + '-day streak'}</span>
                        </div>
                      </div>
                    </div>
                    <div style={css('font-size:15.2px;color:#b5ab9a;margin-top:8px;text-align:right')}>last 14 days</div>
                  </div>

                  {/* gratitude */}
                  <div>
                    <div style={css('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px')}>
                      <span style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175')}>THINGS I'M GRATEFUL FOR</span>
                    </div>
                    <div style={css('display:flex;flex-direction:column;gap:6px')}>
                      {[0, 1, 2].map((idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={t.gratitude[idx] || ''}
                          onChange={(e) => { const g = [...this.today().gratitude]; g[idx] = e.target.value; this.setToday({ gratitude: g }) }}
                          placeholder={idx === 0 ? 'What went right today…' : '…'}
                          className="uin ul"
                          style={css("width:100%;font-family:'Source Serif 4',serif;font-style:italic;font-size:20.3px;color:#44403c;padding:8px 0 7px")}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------- WEEKLY ---------- */}
            {isWeekly && (
              <div style={css('padding:26px 40px 36px;display:flex;flex-direction:column;gap:30px')}>
                <div>
                  <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175;margin-bottom:12px')}>THE WEEK'S FOCUS</div>
                  <input
                    type="text"
                    value={s.weekTheme}
                    onChange={(e) => this.setState({ weekTheme: e.target.value })}
                    placeholder="What is this week about?"
                    className="uin ul-strong"
                    style={css("width:100%;font-family:'Source Serif 4',serif;font-size:30.4px;font-weight:600;color:#1c1917;padding:2px 0 10px")}
                  />
                  <div style={css('display:flex;flex-direction:column;margin-top:18px')}>
                    {s.priorities.map((text, idx) => (
                      <div key={idx} style={css('display:flex;gap:14px;align-items:baseline;padding:6px 0;border-bottom:1px solid #eae4d8')}>
                        <span style={css("font-family:'Source Serif 4',serif;font-size:21.8px;font-weight:600;color:var(--accent,#7c2d12);width:16px;flex:none")}>{idx + 1}</span>
                        <input
                          type="text"
                          value={text}
                          onChange={(e) => { const v = e.target.value; this.setState((prev) => { const p = [...prev.priorities]; p[idx] = v; return { priorities: p } }) }}
                          placeholder={idx === 0 ? 'Most important thing this week…' : 'Priority ' + (idx + 1) + '…'}
                          className="uin"
                          style={css('flex:1;min-width:0;font-size:20.3px;color:#1c1917;font-weight:500;padding:4px 0')}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={css('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px')}>
                    <span style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175')}>WEEK IN REVIEW</span>
                    <span style={css("font-family:'Source Serif 4',serif;font-style:italic;font-size:18.1px;color:#a89f90")}>What exists now that didn't a week ago?</span>
                  </div>
                  <div style={css('border:1px solid #ded7c8;border-radius:6px;background:#fdfcf9;padding:16px 18px')}>
                    <div style={css('display:flex;flex-direction:column')}>
                      {s.reviewItems.map((it) => (
                        <div key={it.id} style={css('display:flex;gap:12px;align-items:center;padding:3px 0;border-bottom:1px solid #eee8db')}>
                          <span style={css('width:5px;height:5px;border-radius:99px;background:var(--accent,#7c2d12);flex:none')} />
                          <input
                            type="text"
                            value={it.text}
                            onChange={(e) => { const v = e.target.value; this.setState((prev) => ({ reviewItems: prev.reviewItems.map((x) => (x.id === it.id ? { ...x, text: v } : x)) })) }}
                            placeholder="…"
                            className="uin"
                            style={css('flex:1;min-width:0;font-size:19.6px;color:#44403c;padding:6px 0')}
                          />
                          {this.delBtn(() => this.setState((prev) => ({ reviewItems: prev.reviewItems.filter((x) => x.id !== it.id) })), 'Delete item')}
                        </div>
                      ))}
                      <div style={css('display:flex;gap:12px;align-items:center;padding:6px 0 0')}>
                        <span style={css('width:5px;height:5px;border-radius:99px;background:#ded7c8;flex:none')} />
                        <input
                          type="text"
                          value={s.newReview}
                          onChange={(e) => this.setState({ newReview: e.target.value })}
                          onKeyDown={this.commit('reviewItems', 'newReview')}
                          placeholder="add evidence, press Enter…"
                          className="uin"
                          style={css("flex:1;min-width:0;font-family:'Source Serif 4',serif;font-style:italic;font-size:19.6px;color:#44403c;padding:4px 0")}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------- MONTHLY ---------- */}
            {isMonthly && (
              <div style={css('padding:26px 40px 36px;display:flex;flex-direction:column;gap:30px')}>
                <div>
                  <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175;margin-bottom:12px')}>PRIMARY FOCUS</div>
                  <input
                    type="text"
                    value={s.monthFocus}
                    onChange={(e) => this.setState({ monthFocus: e.target.value })}
                    placeholder="One main theme for the month…"
                    className="uin ul-strong"
                    style={css("width:100%;font-family:'Source Serif 4',serif;font-size:34.8px;font-weight:600;color:#1c1917;padding:2px 0 10px")}
                  />
                </div>

                <div>
                  <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175;margin-bottom:8px')}>MILESTONES</div>
                  <div style={css('display:flex;flex-direction:column')}>
                    {milestoneRows.map((row) => (
                      <div key={row.key} style={css('display:flex;gap:12px;align-items:center;padding:4px 0;border-bottom:1px solid #eae4d8')}>
                        {this.check(row.done, row.toggle, 18, row.done ? 'Mark not done' : 'Mark done')}
                        <input type="text" value={row.text} onChange={row.onChange} placeholder="…" className="uin" style={row.inputStyle} />
                        {this.delBtn(row.del, 'Delete milestone', true)}
                      </div>
                    ))}
                    <div style={css('display:flex;gap:12px;align-items:center;padding:8px 0')}>
                      <span style={css('width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#b5ab9a;flex:none')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={s.newMilestone}
                        onChange={(e) => this.setState({ newMilestone: e.target.value })}
                        onKeyDown={this.commit('milestones', 'newMilestone')}
                        placeholder="add a milestone, press Enter…"
                        className="uin"
                        style={css("flex:1;min-width:0;font-family:'Source Serif 4',serif;font-style:italic;font-size:20.3px;color:#44403c;padding:4px 0")}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div style={css('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px')}>
                    <span style={css('font-size:15.2px;font-weight:600;letter-spacing:0.14em;color:#8a8175')}>MONTH-END CHECK-IN</span>
                    <span style={css("font-family:'Source Serif 4',serif;font-style:italic;font-size:18.1px;color:#a89f90")}>Are current actions leading to the dream, or just keeping busy?</span>
                  </div>
                  <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:14px')}>
                    <div style={css('border:1px solid #ded7c8;border-radius:6px;background:#fdfcf9;padding:14px 16px')}>
                      <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.1em;color:#a89f90;margin-bottom:8px')}>OBSERVATION — HONEST</div>
                      <textarea
                        value={s.monthObs}
                        onChange={(e) => this.setState({ monthObs: e.target.value })}
                        placeholder="Look at the evidence…"
                        className="uin"
                        style={css('width:100%;height:96px;resize:none;font-size:19.6px;line-height:1.55;color:#44403c;padding:0')}
                      />
                    </div>
                    <div style={css('border:1px solid #ded7c8;border-radius:6px;background:#fdfcf9;padding:14px 16px')}>
                      <div style={css('font-size:15.2px;font-weight:600;letter-spacing:0.1em;color:var(--accent,#7c2d12);margin-bottom:8px')}>CORRECTION — ACTION</div>
                      <textarea
                        value={s.monthCorr}
                        onChange={(e) => this.setState({ monthCorr: e.target.value })}
                        placeholder="What changes next month…"
                        className="uin"
                        style={css('width:100%;height:96px;resize:none;font-size:19.6px;line-height:1.55;color:#44403c;padding:0')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {this.renderRollover()}
      </>
    )
  }
}
