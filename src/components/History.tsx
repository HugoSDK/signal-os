import { useEffect, useState } from 'react'
import type { ArchivedPeriod } from '../lib/sync'
import { monthLabelFromTag, weekLabelFromTag } from '../ledger'

interface Props {
  /** Lazily fetches archived periods. Omitted when there is no signed-in user. */
  load?: () => Promise<ArchivedPeriod[]>
}

/* Snapshots are untyped jsonb written by earlier versions, so every field is
 * read defensively and empty ones are skipped rather than rendered blank. */
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const list = (v: unknown) => (Array.isArray(v) ? v : [])
const itemText = (it: unknown) => (it && typeof it === 'object' ? str((it as any).text) : str(it))

const wrap: React.CSSProperties = { padding: '26px 40px 36px' }
const label: React.CSSProperties = {
  fontSize: 15.2,
  fontWeight: 600,
  letterSpacing: '0.14em',
  color: '#8a8175',
  flex: 'none',
  width: 132,
  paddingTop: 5,
}
const headline: React.CSSProperties = {
  fontFamily: "'Source Serif 4', serif",
  fontSize: 21.8,
  fontWeight: 600,
  color: '#1c1917',
}
const quiet: React.CSSProperties = {
  fontFamily: "'Source Serif 4', serif",
  fontStyle: 'italic',
  fontSize: 20.3,
  color: '#8a8175',
}
const subLabel: React.CSSProperties = {
  fontSize: 15.2,
  fontWeight: 600,
  letterSpacing: '0.1em',
  color: '#a89f90',
  marginBottom: 2,
}
const bodyText: React.CSSProperties = { fontSize: 18.1, color: '#44403c', lineHeight: 1.5 }

function Row({ children, tag }: { children: React.ReactNode; tag: string }) {
  return (
    <div style={{ display: 'flex', gap: 18, padding: '18px 0', borderBottom: '1px solid #eae4d8' }}>
      <div style={label}>{tag.toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Reflection({ name, text }: { name: string; text: string }) {
  return (
    <div style={{ border: '1px solid #ded7c8', borderRadius: 6, background: '#fdfcf9', padding: '11px 14px' }}>
      <div style={subLabel}>{name}</div>
      <div style={bodyText}>{text}</div>
    </div>
  )
}

function WeekRow({ period }: { period: ArchivedPeriod }) {
  const snap = (period.snapshot ?? {}) as Record<string, unknown>
  const theme = str(snap.weekTheme)
  const priorities = list(snap.priorities).map(itemText).filter(Boolean)
  const wins = list(snap.reviewItems).map(itemText).filter(Boolean)
  return (
    <Row tag={weekLabelFromTag(period.period_tag)}>
      {theme ? <div style={headline}>{theme}</div> : <div style={quiet}>No focus set</div>}
      {priorities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {priorities.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span
                style={{
                  fontFamily: "'Source Serif 4', serif",
                  fontSize: 18.1,
                  fontWeight: 600,
                  color: 'var(--accent, #7c2d12)',
                  width: 12,
                  flex: 'none',
                }}
              >
                {i + 1}
              </span>
              <span style={bodyText}>{p}</span>
            </div>
          ))}
        </div>
      )}
      {wins.length > 0 && <Reflection name="WEEK IN REVIEW" text={wins.join(' · ')} />}
    </Row>
  )
}

function MonthRow({ period }: { period: ArchivedPeriod }) {
  const snap = (period.snapshot ?? {}) as Record<string, unknown>
  const focus = str(snap.monthFocus)
  const milestones = list(snap.milestones)
  const doneCount = milestones.filter((m: any) => m && typeof m === 'object' && m.done).length
  const names = milestones.map(itemText).filter(Boolean)
  const obs = str(snap.monthObs)
  const corr = str(snap.monthCorr)
  const revMade = str(snap.revMade)
  const revGoal = str(snap.revGoal)
  return (
    <Row tag={monthLabelFromTag(period.period_tag)}>
      {focus ? <div style={headline}>{focus}</div> : <div style={quiet}>No focus set</div>}
      {names.length > 0 && (
        <div style={bodyText}>
          <span style={{ color: '#8a8175' }}>
            Milestones {doneCount}/{names.length} ·{' '}
          </span>
          {names.join(', ')}
        </div>
      )}
      {revMade !== '' && (
        <div style={bodyText}>
          <span style={{ color: '#8a8175' }}>Revenue · </span>
          {revMade}
          {revGoal ? ' of ' + revGoal : ''}
        </div>
      )}
      {obs && <Reflection name="OBSERVATION — HONEST" text={obs} />}
      {corr && <Reflection name="CORRECTION — ACTION" text={corr} />}
    </Row>
  )
}

export default function History({ load }: Props) {
  const [rows, setRows] = useState<ArchivedPeriod[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!load) {
      setRows([])
      return
    }
    let cancelled = false
    setError(null)
    load()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Could not load history.')
      })
    return () => {
      cancelled = true
    }
  }, [load])

  if (error) {
    return (
      <div style={wrap}>
        <div style={quiet}>Couldn’t load history — {error}</div>
      </div>
    )
  }
  if (rows === null) {
    return (
      <div style={wrap}>
        <div style={quiet}>Loading…</div>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div style={wrap}>
        <div style={quiet}>Nothing archived yet — history starts building at your next week or month rollover.</div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((p) =>
          p.period_type === 'week' ? (
            <WeekRow key={'week:' + p.period_tag} period={p} />
          ) : (
            <MonthRow key={'month:' + p.period_tag} period={p} />
          )
        )}
      </div>
    </div>
  )
}
