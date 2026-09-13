import React from 'react'
import { C, Check, DelBtn, MONO, Panel, Pips, PlusGlyph, css } from './ui'
import type { Row } from './ui'

type Change = (e: React.ChangeEvent<HTMLInputElement>) => void
type AreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => void

interface Props {
  monthFocus: string
  setMonthFocus: Change
  milestoneRows: Row[]
  msCountLabel: string
  nextMilestoneIdx: string
  newMilestone: string
  setNewMilestone: Change
  onMilestoneKey: (e: React.KeyboardEvent) => void

  currency: string
  revMade: string
  setRevMade: Change
  revGoal: string
  setRevGoal: Change
  revFilled: number
  monthLeftLabel: string
  paceLines: { key: string; label: string; value: string }[]

  monthObs: string
  setMonthObs: AreaChange
  monthCorr: string
  setMonthCorr: AreaChange
}

const rowIdx = css(`font-family:${MONO};font-size:10px;color:${C.inkLabel};flex:none;width:14px`)
const nextIdx = css(`font-family:${MONO};font-size:10px;color:${C.inkGhost2};flex:none;width:14px`)

/** One half of the month-end check-in: a white card holding a bare textarea. */
function CheckInCard(p: { label: string; accent?: boolean; value: string; onChange: AreaChange; placeholder: string }) {
  return (
    <div style={css(`background:${C.raised};border:1px solid ${C.borderSoft};padding:14px 16px`)}>
      <div
        style={css(
          `font-family:${MONO};font-size:10px;letter-spacing:0.18em;margin-bottom:8px;color:${
            p.accent ? C.accent : C.inkLabel2
          }`
        )}
      >
        {p.label}
      </div>
      <textarea
        value={p.value}
        onChange={p.onChange}
        placeholder={p.placeholder}
        className="uin"
        style={css(`width:100%;height:96px;resize:none;font-size:16.5px;line-height:1.55;color:${C.inkBody};padding:0`)}
      />
    </div>
  )
}

export default function Month(p: Props) {
  return (
    <div style={css('padding:26px 34px 44px;display:flex;flex-direction:column;gap:30px')}>
      <div className="cols">
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          <Panel num="01" label="PRIMARY FOCUS" accentLabel bottom={14}>
            <input
              type="text"
              value={p.monthFocus}
              onChange={p.setMonthFocus}
              placeholder="one theme for the month…"
              className="uin ul"
              style={css(`width:100%;font-size:32px;font-weight:500;letter-spacing:-0.02em;color:${C.ink};padding:9px 0 10px`)}
            />
          </Panel>

          <Panel num="02" label="MILESTONES" meta={p.msCountLabel}>
            {p.milestoneRows.map((row) => (
              <div
                key={row.key}
                className="row"
                style={css(`display:flex;align-items:center;gap:13px;padding:8px 0;border-bottom:1px solid ${C.borderHair}`)}
              >
                <span style={rowIdx}>{row.idx}</span>
                <Check done={row.done} onClick={row.toggle} size={13} label={row.done ? 'Mark not done' : 'Mark done'} />
                <input type="text" value={row.text} onChange={row.onChange} placeholder="…" style={row.inputStyle} />
                <DelBtn onClick={row.del} label="Delete milestone" show />
              </div>
            ))}
            <div style={css('display:flex;align-items:center;gap:13px;padding:10px 0')}>
              <span style={nextIdx}>{p.nextMilestoneIdx}</span>
              <PlusGlyph size={13} />
              <input
                type="text"
                value={p.newMilestone}
                onChange={p.setNewMilestone}
                onKeyDown={p.onMilestoneKey}
                placeholder="add milestone, press Enter…"
                className="uin"
                style={css(`flex:1;min-width:0;font-size:17px;color:${C.inkSoft};padding:4px 0`)}
              />
            </div>
          </Panel>
        </div>

        <Panel num="03" label="PACE" meta={p.monthLeftLabel} x={20} bottom={16}>
          <div style={css('display:flex;align-items:baseline;gap:6px;margin-top:13px;flex-wrap:wrap')}>
            <span style={css(`font-family:${MONO};font-size:19px;color:${C.inkSoft}`)}>{p.currency}</span>
            <input
              type="text"
              value={p.revMade}
              onChange={p.setRevMade}
              placeholder="0"
              aria-label="Made this month"
              className="uin ul"
              style={css(
                `width:132px;max-width:100%;font-family:${MONO};font-size:32px;font-weight:500;letter-spacing:-0.02em;color:${C.ink};padding:0 0 4px`
              )}
            />
            <span style={css(`font-family:${MONO};font-size:11px;letter-spacing:0.14em;color:${C.inkLabel2}`)}>OF</span>
            <span style={css(`font-family:${MONO};font-size:15px;color:${C.inkSoft}`)}>{p.currency}</span>
            <input
              type="text"
              value={p.revGoal}
              onChange={p.setRevGoal}
              placeholder="goal"
              aria-label="Monthly goal"
              className="uin ul"
              style={css(`width:72px;max-width:100%;font-family:${MONO};font-size:16px;color:${C.inkSoft};padding:0 0 4px`)}
            />
          </div>
          <div style={css('margin-top:14px')}>
            <Pips filled={p.revFilled} height={5} />
          </div>
          {p.paceLines.map((line) => (
            <div
              key={line.key}
              style={css(
                `display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:10px 0;border-bottom:1px solid ${C.borderHair}`
              )}
            >
              <span style={css(`font-size:15.5px;color:${C.inkSoft}`)}>{line.label}</span>
              <span style={css(`font-family:${MONO};font-size:16px;font-weight:500;color:${C.ink}`)}>{line.value}</span>
            </div>
          ))}
        </Panel>
      </div>

      <Panel num="04" label="MONTH-END CHECK-IN" bottom={16} gap={0}>
        <div
          style={css(
            'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:16px;margin-top:16px'
          )}
        >
          <CheckInCard label="OBSERVATION" value={p.monthObs} onChange={p.setMonthObs} placeholder="look at the evidence…" />
          <CheckInCard
            label="CORRECTION"
            accent
            value={p.monthCorr}
            onChange={p.setMonthCorr}
            placeholder="what changes next month…"
          />
        </div>
      </Panel>
    </div>
  )
}
