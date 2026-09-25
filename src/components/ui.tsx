import React from 'react'

/* Shared primitives and design tokens for the instrument-panel UI.
 * Border radius is 0 on every surface here by design — the only rounded
 * things in the app are the ACTIVE status dot and the intention modal's
 * radio, both of which opt in explicitly. */

type Dict = Record<string, any>

/** Turns a CSS declaration string into a React style object, so the exact
 * declarations from the design can be transcribed without re-spelling each
 * property in camelCase. Custom properties (--x) are passed through as-is. */
export const css = (s: string): React.CSSProperties => {
  const o: Dict = {}
  for (const rule of s.split(';')) {
    const r = rule.trim()
    if (!r) continue
    const i = r.indexOf(':')
    if (i < 0) continue
    const k = r.slice(0, i).trim()
    const v = r.slice(i + 1).trim()
    if (k.startsWith('--')) o[k] = v
    else o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
  }
  return o as React.CSSProperties
}

export const MONO = "'JetBrains Mono',monospace"

/** Colour tokens. `accent` is deliberately the CSS variable rather than a hex
 * value so the --accent prop can retheme every accent surface at once. */
export const C = {
  ground: '#eef1f1',
  surface: '#f8fafa',
  raised: '#ffffff',
  border: '#c7d0d0',
  borderSoft: '#d6dddd',
  borderHair: '#e2e7e7',
  borderStrong: '#a9b4b4',
  borderControl: '#6f7c7d',
  ink: '#0e1415',
  inkBody: '#1b2223',
  inkMuted: '#3d4748',
  inkSoft: '#55605f',
  inkLabel: '#5a6566',
  inkLabel2: '#5f6a6b',
  inkFaint: '#7c8889',
  inkGhost: '#9aa6a6',
  inkGhost2: '#a9b4b4',
  accent: 'var(--accent,#0b6c71)',
  onAccent: '#ffffff',
}

/* ---------- panel ---------- */

interface PanelProps {
  /** Section number shown at the head of the band, e.g. '01'. */
  num: string
  label: string
  /** Right-aligned meta value in the band. */
  meta?: string
  /** The section's own number is accent; every other section's is ink. */
  accentLabel?: boolean
  /** Horizontal padding — 18 for narrow panels, 20 for the wide ones. */
  x?: number
  /** Bottom padding. */
  bottom?: number
  /** Gap under the header band. 0 where the body supplies its own spacing. */
  gap?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}

/** A bordered panel with a header band that bleeds to the panel's edges. */
export function Panel({ num, label, meta, accentLabel, x = 18, bottom = 12, gap = 4, style, children }: PanelProps) {
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, padding: `0 ${x}px ${bottom}px`, ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          margin: `0 -${x}px ${gap}px`,
          padding: `11px ${x}px`,
          background: C.ground,
          borderBottom: '1px solid ' + C.border,
          fontFamily: MONO,
        }}
      >
        <span style={{ fontSize: 10, color: C.inkLabel }}>{num}</span>
        <span style={{ fontSize: 10.5, letterSpacing: '0.22em', fontWeight: 500, color: accentLabel ? C.accent : C.ink }}>
          {label}
        </span>
        {meta ? (
          <span style={{ marginLeft: 'auto', fontSize: 10.5, letterSpacing: '0.14em', color: C.inkMuted }}>{meta}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** Marks a container as the live one: accent Ls on two opposite corners,
 * offset by 1px so they sit on top of the border rather than inside it. */
export function CornerTicks() {
  const base = 'position:absolute;width:9px;height:9px'
  return (
    <>
      <span
        style={css(base + `;top:-1px;left:-1px;border-top:2px solid ${C.accent};border-left:2px solid ${C.accent}`)}
      />
      <span
        style={css(
          base + `;bottom:-1px;right:-1px;border-bottom:2px solid ${C.accent};border-right:2px solid ${C.accent}`
        )}
      />
    </>
  )
}

/* ---------- controls ---------- */

interface CheckProps {
  done: boolean
  onClick: () => void
  size: number
  label: string
  /** 1.5px border instead of 1px, for the larger unchecked boxes. */
  thick?: boolean
}

export function Check({ done, onClick, size, label, thick }: CheckProps) {
  const style = { width: size, height: size } as React.CSSProperties
  if (!done) {
    return <button onClick={onClick} aria-label={label} className={'chk todo' + (thick ? ' thick' : '')} style={style} />
  }
  const tick = Math.round(size * 0.58)
  return (
    <button onClick={onClick} aria-label={label} className="chk done" style={style}>
      <svg width={tick} height={tick} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  )
}

/** The × on a list row. Hidden until the row is hovered unless `show`. */
export function DelBtn({ onClick, label, show }: { onClick: () => void; label: string; show?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} className={show ? 'del show' : 'del'}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

/** Line height of wrapping list text (AutoText). */
export const LIST_LINE = 1.35

/** Height of a wrapping row's first line, so the index, check and buttons can
 * sit centred on it however many lines the text runs to. */
export const firstLine = (fontSize: number, padY: number) => Math.round(fontSize * LIST_LINE) + padY * 2

/** Holds a row's fixed-size pieces (index, check, buttons) centred on the
 * first line of text, so they stay put when the text wraps. */
export function Slot({ h, children }: { h: number; children: React.ReactNode }) {
  return <div style={css(`flex:none;display:flex;align-items:center;gap:13px;height:${h}px`)}>{children}</div>
}

/** A one-line text field that wraps instead of scrolling sideways, growing
 * taller to fit. Enter never inserts a newline: it goes to `onKeyDown` (the
 * add rows commit on it) or, without one, just leaves the field. Pasted line
 * breaks become spaces, so saved text stays a single line. */
export function AutoText({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  style,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const fit = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])
  React.useLayoutEffect(fit, [value, fit])
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // Re-wrap when the column width changes (window resize, rotation).
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      fit()
    })
    ro.observe(el)
    // The web font is wider than the fallback, so wrapping changes once it lands.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.ready.then(fit)
    fonts?.addEventListener('loadingdone', fit)
    return () => {
      ro.disconnect()
      fonts?.removeEventListener('loadingdone', fit)
    }
  }, [fit])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        if (/[\r\n]/.test(e.target.value)) e.target.value = e.target.value.replace(/\s*[\r\n]+\s*/g, ' ')
        onChange(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          if (onKeyDown) onKeyDown(e)
          else e.currentTarget.blur()
          return
        }
        onKeyDown?.(e)
      }}
      style={{
        display: 'block',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: LIST_LINE,
        fontFamily: 'inherit',
        overflowWrap: 'anywhere',
        ...style,
      }}
    />
  )
}

/** Stands in the checkbox column of an "add a row" line. */
export function PlusGlyph({ size = 13 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        color: C.inkGhost2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  )
}

/** Segmented progress bar. `total` segments, the first `filled` in accent. */
export function Pips({ filled, total = 10, height = 3, gap = 2 }: { filled: number; total?: number; height?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ flex: 1, height, background: i < filled ? C.accent : C.border }} />
      ))}
    </div>
  )
}

/** Concentric rings with a satellite dot. The sign-in card uses a lighter,
 * 1px-stroked variant of the same mark. */
export function Logo({ size = 26, faint }: { size?: number; faint?: boolean }) {
  const w = faint ? 1 : 2
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="16" fill="none" stroke={faint ? C.border : C.inkGhost} strokeWidth={w} />
      <circle cx="24" cy="24" r="8" fill="none" stroke={faint ? C.inkSoft : C.ink} strokeWidth={w} />
      <circle cx="24" cy="24" r={faint ? 1.5 : 2.5} fill={C.ink} />
      <circle cx="35.3" cy="12.7" r={faint ? 2.5 : 3} fill={C.accent} />
    </svg>
  )
}

/* ---------- shared row shapes ---------- */

/** An editable list row: task, milestone. */
export interface Row {
  key: number
  /** Zero-padded position, e.g. '03'. */
  idx: string
  done: boolean
  text: string
  /** Which list a task row belongs to. Unset on non-task rows. */
  category?: 'work' | 'misc'
  inputStyle: React.CSSProperties
  toggle: () => void
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  del: () => void
  /** Present on task rows: moves the task to the other list. */
  move?: () => void
}

/** One of the seven trailing-day streak squares under a daily rep. */
export interface Dot {
  key: number
  on: boolean
  onToday: boolean
  offPast: boolean
  offToday: boolean
}

/** One of the seven Mon–Sun squares beside the intention. */
export interface WeekDot {
  key: string
  label: string
  on: boolean
  todayOff: boolean
  pastOff: boolean
  futureOff: boolean
}

/* ---------- modal chrome ---------- */

/** The shared card for the Start of Day / End of Day modals: scrim, corner
 * ticks, an eyebrow + title header with an ESC button, and one primary
 * action across the foot. */
export function Modal(p: {
  eyebrow: string
  title: string
  cta: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={css(
        'position:fixed;inset:0;z-index:1000;background:rgba(14,20,21,0.44);display:flex;' +
          'align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto'
      )}
    >
      <div style={css(`width:560px;max-width:100%;background:${C.surface};border:1px solid ${C.borderStrong};position:relative;margin:auto`)}>
        <CornerTicks />
        <div
          style={css(
            `display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:24px 30px 16px;border-bottom:1px solid ${C.borderSoft}`
          )}
        >
          <div>
            <div style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.2em;color:${C.accent}`)}>{p.eyebrow}</div>
            <h2 style={css(`margin:9px 0 0;font-size:25px;font-weight:500;letter-spacing:-0.02em;color:${C.ink}`)}>{p.title}</h2>
          </div>
          <button onClick={p.onClose} className="btn-esc" style={css('flex:none;font-size:10px;letter-spacing:0.14em;padding:6px 9px')}>
            ESC
          </button>
        </div>

        {p.children}

        <div style={css('padding:22px 30px 24px')}>
          <button onClick={p.onClose} className="btn-pri" style={css('width:100%;padding:12px 0;font-size:10.5px;letter-spacing:0.16em')}>
            {p.cta}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A numbered section heading inside a modal. */
export function ModalSection({ num, label, children }: { num: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={css('display:flex;align-items:baseline;gap:9px;margin-bottom:8px')}>
        <span style={css(`font-family:${MONO};font-size:10px;letter-spacing:0.18em;color:${C.accent}`)}>{num}</span>
        <span style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.2em;color:${C.inkMuted}`)}>{label}</span>
      </div>
      {children}
    </div>
  )
}

/** The white, bordered textarea used inside modals. */
export const modalArea = css(
  `width:100%;display:block;box-sizing:border-box;resize:vertical;font-family:inherit;font-size:15.5px;line-height:1.5;color:${C.inkBody};padding:11px 13px`
)
