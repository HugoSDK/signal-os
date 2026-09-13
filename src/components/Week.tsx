import React from 'react'
import { C, DelBtn, MONO, Panel, css } from './ui'

type Change = (e: React.ChangeEvent<HTMLInputElement>) => void

export interface PriorityRow {
  key: number
  idx: string
  text: string
  placeholder: string
  onChange: Change
  del: () => void
}

export interface ReviewRow {
  key: number
  text: string
  onChange: Change
  del: () => void
}

interface Props {
  weekTheme: string
  setWeekTheme: Change
  priorityRows: PriorityRow[]
  nextPriorityIdx: string
  newPriority: string
  setNewPriority: Change
  onPriorityKey: (e: React.KeyboardEvent) => void
  reviewRows: ReviewRow[]
  newReview: string
  setNewReview: Change
  onReviewKey: (e: React.KeyboardEvent) => void
  weekLeftLabel: string
  score: { key: string; label: string; value: string }[]
}

const rowIdx = css(`font-family:${MONO};font-size:10px;color:${C.inkLabel};flex:none;width:14px`)
const nextIdx = css(`font-family:${MONO};font-size:10px;color:${C.inkGhost2};flex:none;width:14px`)
const listRow = css(`display:flex;align-items:center;gap:13px;padding:7px 0;border-bottom:1px solid ${C.borderHair}`)
const addRow = css('display:flex;align-items:center;gap:13px;padding:10px 0')
const bullet = (on: boolean) => css(`width:5px;height:5px;flex:none;background:${on ? C.accent : C.border}`)

export default function Week(p: Props) {
  return (
    <div className="cols" style={css('padding:26px 34px 44px')}>
      <div style={css('display:flex;flex-direction:column;gap:16px')}>
        <Panel num="01" label="FOCUS" accentLabel bottom={14}>
          <input
            type="text"
            value={p.weekTheme}
            onChange={p.setWeekTheme}
            placeholder="what is this week about?"
            className="uin ul"
            style={css(`width:100%;font-size:29px;font-weight:500;letter-spacing:-0.02em;color:${C.ink};padding:9px 0 10px`)}
          />
        </Panel>

        <Panel num="02" label="PRIORITIES">
          {p.priorityRows.map((row) => (
            <div key={row.key} className="row" style={listRow}>
              <span style={rowIdx}>{row.idx}</span>
              <input
                type="text"
                value={row.text}
                onChange={row.onChange}
                placeholder={row.placeholder}
                className="uin"
                style={css(`flex:1;min-width:0;font-size:18px;color:${C.ink};padding:5px 0`)}
              />
              <DelBtn onClick={row.del} label="Delete priority" show />
            </div>
          ))}
          <div style={addRow}>
            <span style={nextIdx}>{p.nextPriorityIdx}</span>
            <input
              type="text"
              value={p.newPriority}
              onChange={p.setNewPriority}
              onKeyDown={p.onPriorityKey}
              placeholder="add priority, press Enter…"
              className="uin"
              style={css(`flex:1;min-width:0;font-size:17px;color:${C.inkSoft};padding:4px 0`)}
            />
          </div>
        </Panel>

        <Panel num="03" label="EVIDENCE · WEEK IN REVIEW">
          {p.reviewRows.map((row) => (
            <div key={row.key} className="row" style={listRow}>
              <span style={bullet(true)} />
              <input
                type="text"
                value={row.text}
                onChange={row.onChange}
                placeholder="…"
                className="uin"
                style={css(`flex:1;min-width:0;font-size:17px;color:${C.inkBody};padding:5px 0`)}
              />
              <DelBtn onClick={row.del} label="Delete item" />
            </div>
          ))}
          <div style={addRow}>
            <span style={bullet(false)} />
            <input
              type="text"
              value={p.newReview}
              onChange={p.setNewReview}
              onKeyDown={p.onReviewKey}
              placeholder="add evidence, press Enter…"
              className="uin"
              style={css(`flex:1;min-width:0;font-size:17px;color:${C.inkSoft};padding:4px 0`)}
            />
          </div>
        </Panel>
      </div>

      <Panel num="04" label="WEEK SO FAR" meta={p.weekLeftLabel} x={20} bottom={16}>
        {p.score.map((line) => (
          <div
            key={line.key}
            style={css(
              `display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:11px 0;border-bottom:1px solid ${C.borderHair}`
            )}
          >
            <span style={css(`font-size:16px;color:${C.inkSoft}`)}>{line.label}</span>
            <span style={css(`font-family:${MONO};font-size:20px;font-weight:500;color:${C.ink}`)}>{line.value}</span>
          </div>
        ))}
      </Panel>
    </div>
  )
}
