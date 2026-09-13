import React, { useState } from 'react'
import { C, Logo, MONO, Pips, css } from './ui'

export interface NavItem {
  key: string
  idx: string
  label: string
  meta: string
  active: boolean
  onClick: () => void
}

interface Props {
  navItems: NavItem[]
  email: string
  onSignOut?: () => void
  dayOfYearLabel: string
  weekLabel: string
  quarterLabel: string
  intentionBtnLabel: string
  onOpenIntention: () => void
  onOpenReflection: () => void
  pageKicker: string
  pageTitle: string
  revHeaderLabel: string
  revPctLabel: string
  /** Display value — thousands-separated, shown while the field is unfocused. */
  revTotal: string
  /** The stored string, shown while editing so digits can be typed plainly. */
  revRaw: string
  /** False on Archive, where the figure is a derived year total. */
  revEditable: boolean
  setRevMade: (e: React.ChangeEvent<HTMLInputElement>) => void
  revFilled: number
  children?: React.ReactNode
}

const chip = css(`background:${C.surface};border:1px solid ${C.border};padding:4px 11px`)

const figureStyle = css(
  `width:100%;font-family:${MONO};font-size:34px;font-weight:500;letter-spacing:-0.02em;color:${C.ink};line-height:1`
)

/**
 * The month's revenue, editable in place. Shows the thousands-separated value
 * at rest and the raw stored string once focused, so typing isn't fighting a
 * comma that moves under the cursor. Read-only on Archive, where the figure is
 * a year total summed across months rather than a single stored value.
 */
function RevenueFigure(p: {
  display: string
  raw: string
  editable: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [editing, setEditing] = useState(false)
  if (!p.editable) return <div style={figureStyle}>{p.display}</div>
  return (
    <input
      type="text"
      value={editing ? p.raw : p.display}
      onChange={p.onChange}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      placeholder="0"
      aria-label="Made this month"
      className="uin ul"
      // size=1 so the input's intrinsic width doesn't widen the panel past its
      // designed 260px; the width comes from figureStyle instead.
      size={1}
      style={{ ...figureStyle, minWidth: 0, padding: '0 0 3px' }}
    />
  )
}

export default function Shell(props: Props) {
  const { navItems, email, onSignOut } = props
  return (
    <div className="shell">
      <div className="sidebar">
        <div style={css('padding:0 20px 30px;display:flex;align-items:center;gap:11px')}>
          <Logo size={26} />
          <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.22em', color: C.ink }}>
            LEDGER
          </span>
        </div>

        <div className="navgroup">
          {navItems.map((item) => (
            <button key={item.key} onClick={item.onClick} className={item.active ? 'navrow active' : 'navrow'}>
              <span
                style={{
                  flex: 'none',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: item.active ? C.onAccent : C.inkLabel,
                  background: item.active ? C.accent : 'transparent',
                  border: item.active ? 'none' : '1px solid ' + C.border,
                }}
              >
                {item.idx}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: item.active ? 700 : 400,
                  color: item.active ? C.ink : C.inkSoft,
                }}
              >
                {item.label}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: item.active ? C.accent : C.inkLabel }}>
                {item.meta}
              </span>
            </button>
          ))}
        </div>

        <div
          style={css(
            `margin-top:auto;padding:14px 20px 0;border-top:1px solid ${C.borderSoft};display:flex;flex-direction:column;gap:6px`
          )}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: '0.1em',
              color: C.inkLabel,
              textTransform: 'uppercase',
              overflowWrap: 'anywhere',
            }}
          >
            {email}
          </span>
          <button onClick={onSignOut} className="txtbtn" style={{ fontSize: 10, letterSpacing: '0.14em' }}>
            SIGN OUT
          </button>
        </div>
      </div>

      <div style={css('min-width:0')}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 34px',
            minHeight: 42,
            borderBottom: '1px solid ' + C.borderSoft,
            fontFamily: MONO,
            fontSize: 12.5,
            fontWeight: 500,
            letterSpacing: '0.06em',
            color: C.inkMuted,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ ...chip, color: C.ink }}>{props.dayOfYearLabel}</span>
          <span style={chip}>{props.weekLabel}</span>
          <span style={chip}>{props.quarterLabel}</span>
          <span style={css('margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
            <span style={{ ...chip, display: 'flex', alignItems: 'center', gap: 7, fontSize: 10.5, letterSpacing: '0.14em' }}>
              <span style={css(`width:6px;height:6px;border-radius:99px;background:${C.accent};display:block`)} />
              <span style={{ color: C.inkMuted }}>ACTIVE</span>
            </span>
            <button onClick={props.onOpenIntention} className="btn-out" style={css('padding:5px 11px;font-size:10.5px;letter-spacing:0.14em')}>
              {props.intentionBtnLabel}
            </button>
            <button onClick={props.onOpenReflection} className="btn-out" style={css('padding:5px 11px;font-size:10.5px;letter-spacing:0.14em')}>
              END OF DAY
            </button>
          </span>
        </div>

        <div
          style={css(
            `padding:26px 34px 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px;border-bottom:1px solid ${C.borderSoft};flex-wrap:wrap`
          )}
        >
          <div style={css('min-width:0')}>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.22em', color: C.inkLabel2 }}>
              {props.pageKicker}
            </div>
            <h1 style={css(`margin:3px 0 0;font-size:46px;font-weight:500;letter-spacing:-0.03em;line-height:1.02;color:${C.ink}`)}>
              {props.pageTitle}
            </h1>
          </div>

          <div style={css(`flex:none;min-width:260px;background:${C.surface};border:1px solid ${C.border};padding:0 18px 14px`)}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                margin: '0 -18px 12px',
                padding: '10px 18px',
                background: C.ground,
                borderBottom: '1px solid ' + C.border,
                fontFamily: MONO,
                fontSize: 10.5,
                letterSpacing: '0.18em',
                color: C.inkMuted,
              }}
            >
              <span>{props.revHeaderLabel}</span>
              <span style={{ color: C.accent }}>{props.revPctLabel}</span>
            </div>
            <RevenueFigure
              display={props.revTotal}
              raw={props.revRaw}
              editable={props.revEditable}
              onChange={props.setRevMade}
            />
            <div style={css('margin-top:9px')}>
              <Pips filled={props.revFilled} height={3} />
            </div>
          </div>
        </div>

        {props.children}
      </div>
    </div>
  )
}
