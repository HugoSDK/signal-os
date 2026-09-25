import React from 'react'
import { MANTRAS, QUOTE } from '../lib/content'
import { AutoText, C, Check, CornerTicks, DelBtn, MONO, Panel, Pips, PlusGlyph, Slot, css, firstLine } from './ui'
import type { Dot, Row, WeekDot } from './ui'

type Change = (e: React.ChangeEvent<HTMLInputElement>) => void
type AreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => void

interface Props {
  quoteOpen: boolean
  onDismissQuote: () => void
  onRecallQuote: () => void

  dayOfYearLabel: string
  intentionText: string
  setIntention: Change
  onOpenIntention: () => void
  statusText: string
  statusIsNudge: boolean
  weekDots: WeekDot[]
  topDone: boolean
  toggleTop: () => void

  workRows: Row[]
  miscRows: Row[]
  workCountLabel: string
  miscCountLabel: string
  nextWorkIdx: string
  nextMiscIdx: string
  newWorkTask: string
  setNewWorkTask: AreaChange
  onWorkKey: (e: React.KeyboardEvent) => void
  newMiscTask: string
  setNewMiscTask: AreaChange
  onMiscKey: (e: React.KeyboardEvent) => void
  progressLabel: string
  onPurge: () => void

  leadDone: boolean
  leadWho: string
  setLeadWho: Change
  toggleLead: () => void
  leadDots: Dot[]
  leadStreakLabel: string
  postDone: boolean
  postWhat: string
  setPostWhat: Change
  togglePost: () => void
  postDots: Dot[]
  postStreakLabel: string

  monthFocus: string
  setMonthFocus: Change
  monthLeftLabel: string
  msCountLabel: string
  msDone: number
  msTotal: number
  openMilestones: Row[]
  milestoneEmptyLabel: string
}

const rowIdx = css(`font-family:${MONO};font-size:10px;color:${C.inkLabel};flex:none;width:14px`)
const nextIdx = css(`font-family:${MONO};font-size:10px;color:${C.inkGhost2};flex:none;width:14px`)
const footLine = css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.14em;color:${C.inkMuted}`)

/** WORK and MISC differ only in size and in which list the move button sends to. */
function TaskList(p: {
  num: string
  label: string
  accentLabel?: boolean
  meta: string
  rows: Row[]
  box: number
  addSize: number
  rowPad: number
  moveLabel: string
  nextIdxLabel: string
  draft: string
  setDraft: AreaChange
  onKey: (e: React.KeyboardEvent) => void
}) {
  return (
    <Panel num={p.num} label={p.label} accentLabel={p.accentLabel} meta={p.meta}>
      {p.rows.map((row) => {
        const h = firstLine(Number(row.inputStyle.fontSize), 6)
        return (
          <div
            key={row.key}
            className="row"
            style={css(`display:flex;align-items:flex-start;gap:13px;padding:${p.rowPad}px 0;border-bottom:1px solid ${C.borderHair}`)}
          >
            <Slot h={h}>
              <span style={rowIdx}>{row.idx}</span>
              <Check done={row.done} onClick={row.toggle} size={p.box} label={row.done ? 'Mark not done' : 'Mark done'} />
            </Slot>
            <AutoText value={row.text} onChange={row.onChange} placeholder="…" style={row.inputStyle} />
            <Slot h={h}>
              <button
                onClick={row.move}
                className="txtbtn"
                aria-label={'Move to ' + p.moveLabel.toLowerCase()}
                style={css('font-size:10px;letter-spacing:0.12em;flex:none')}
              >
                {p.moveLabel}
              </button>
              <DelBtn onClick={row.del} label="Delete task" />
            </Slot>
          </div>
        )
      })}
      <div style={css('display:flex;align-items:flex-start;gap:13px;padding:10px 0')}>
        <Slot h={firstLine(p.addSize, 4)}>
          <span style={nextIdx}>{p.nextIdxLabel}</span>
          <PlusGlyph size={p.box} />
        </Slot>
        <AutoText
          value={p.draft}
          onChange={p.setDraft}
          onKeyDown={p.onKey}
          placeholder="add task, press Enter…"
          className="uin"
          style={css(`flex:1;min-width:0;font-size:${p.addSize}px;color:${C.inkSoft};padding:4px 0`)}
        />
      </div>
    </Panel>
  )
}

function StreakDots({ dots }: { dots: Dot[] }) {
  const base = 'display:block;width:9px;height:9px'
  return (
    <div style={css('display:flex;gap:3px')}>
      {dots.map((d) => {
        if (d.on) return <span key={d.key} style={css(base + `;background:${C.accent}`)} />
        if (d.onToday)
          return <span key={d.key} style={css(base + `;background:${C.accent};outline:1px solid ${C.ink};outline-offset:1.5px`)} />
        if (d.offPast) return <span key={d.key} style={css(base + `;background:${C.border}`)} />
        return <span key={d.key} style={css(base + `;border:1.5px solid ${C.borderControl}`)} />
      })}
    </div>
  )
}

/** One of the two daily reps: a title, what it was, and a seven-day streak. */
function Rep(p: {
  title: string
  done: boolean
  toggle: () => void
  value: string
  setValue: Change
  placeholder: string
  dots: Dot[]
  streakLabel: string
}) {
  return (
    <div style={css(`padding:12px 0 13px;border-bottom:1px solid ${C.borderHair}`)}>
      <div style={css('display:flex;justify-content:space-between;align-items:center;gap:12px')}>
        <span style={css(`font-size:20px;font-weight:500;letter-spacing:-0.01em;color:${C.ink}`)}>{p.title}</span>
        <Check done={p.done} onClick={p.toggle} size={16} label={'Toggle ' + p.title} />
      </div>
      <input
        type="text"
        value={p.value}
        onChange={p.setValue}
        placeholder={p.placeholder}
        className="uin ul"
        style={css(`width:100%;font-size:16px;color:${C.inkBody};padding:6px 0;margin-top:4px`)}
      />
      <div style={css('display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px')}>
        <StreakDots dots={p.dots} />
        <span style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.14em;color:${C.accent};white-space:nowrap`)}>
          {p.streakLabel}
        </span>
      </div>
    </div>
  )
}

export default function Today(p: Props) {
  return (
    <div>
      {p.quoteOpen ? (
        <div
          style={css(
            `padding:18px 34px;border-bottom:1px solid ${C.borderSoft};display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap`
          )}
        >
          <div style={css('flex:1;min-width:min(300px,100%)')}>
            <div style={css('display:flex;flex-wrap:wrap;align-items:baseline;gap:10px')}>
              <span style={css(`font-size:22px;font-weight:500;letter-spacing:-0.01em;color:${C.ink}`)}>{MANTRAS[0]}</span>
              <span style={css(`font-size:22px;font-weight:500;letter-spacing:-0.01em;color:${C.inkSoft}`)}>
                <span style={{ color: C.inkGhost2 }}>/</span> {MANTRAS[1]}
              </span>
            </div>
            <blockquote style={css(`margin:11px 0 0;max-width:76ch;font-size:15.5px;line-height:1.6;color:${C.inkSoft}`)}>
              {QUOTE.text}
              <span
                style={css(
                  `display:block;margin-top:6px;font-family:${MONO};font-size:10px;letter-spacing:0.2em;color:${C.inkLabel}`
                )}
              >
                {QUOTE.author}
              </span>
            </blockquote>
          </div>
          <button
            onClick={p.onDismissQuote}
            className="btn-out"
            style={css(`flex:none;padding:9px 15px;font-size:10.5px;letter-spacing:0.16em;color:${C.inkSoft}`)}
          >
            ACKNOWLEDGE
          </button>
        </div>
      ) : (
        <div
          style={css(
            `padding:12px 34px;border-bottom:1px solid ${C.borderSoft};display:flex;align-items:baseline;gap:12px;flex-wrap:wrap`
          )}
        >
          <span style={css(`font-size:16px;color:${C.inkSoft}`)}>
            {MANTRAS[0]} <span style={{ color: C.inkGhost2 }}>/</span> {MANTRAS[1]}
          </span>
          <button onClick={p.onRecallQuote} className="txtbtn" style={css('margin-left:auto;font-size:10px;letter-spacing:0.16em')}>
            RECALL
          </button>
        </div>
      )}

      <div
        style={css(
          `margin:22px 34px 0;position:relative;background:${C.surface};border:1px solid ${C.border};padding:20px 24px;` +
            'display:flex;justify-content:space-between;align-items:flex-end;gap:28px;flex-wrap:wrap'
        )}
      >
        <CornerTicks />
        <div style={css('flex:1;min-width:min(430px,100%)')}>
          <div style={css('display:flex;align-items:baseline;gap:14px;flex-wrap:wrap')}>
            <span style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.22em;color:${C.accent}`)}>
              {"TODAY'S INTENTION · " + p.dayOfYearLabel}
            </span>
            <button onClick={p.onOpenIntention} className="txtbtn" style={css('font-size:10px;letter-spacing:0.16em')}>
              PICK A TASK
            </button>
          </div>
          <input
            type="text"
            value={p.intentionText}
            onChange={p.setIntention}
            placeholder="Name the one thing today is for…"
            className="uin ul"
            style={css(
              `width:100%;font-size:29px;font-weight:500;letter-spacing:-0.02em;color:${C.ink};padding:5px 0 8px;margin-top:5px`
            )}
          />
          <div
            style={css(
              `font-family:${MONO};font-size:11.5px;letter-spacing:0.1em;margin-top:9px;color:${
                p.statusIsNudge ? C.accent : C.inkLabel2
              }`
            )}
          >
            {p.statusText}
          </div>
        </div>

        <div style={css('flex:none;display:flex;align-items:flex-end;gap:22px;flex-wrap:wrap')}>
          <div style={css(`display:flex;gap:6px;font-family:${MONO}`)}>
            {p.weekDots.map((d) => (
              <div key={d.key} style={css('text-align:center')}>
                <div style={css(`font-size:9.5px;letter-spacing:0.06em;color:${C.inkLabel}`)}>{d.label}</div>
                <div
                  style={css(
                    'width:15px;height:15px;margin-top:6px;' +
                      (d.on
                        ? `background:${C.accent}`
                        : d.todayOff
                          ? `border:1.5px solid ${C.accent}`
                          : d.pastOff
                            ? `background:${C.border}`
                            : `border:1px solid ${C.border}`)
                  )}
                />
              </div>
            ))}
          </div>
          {p.topDone ? (
            <button
              onClick={p.toggleTop}
              className="btn-pri"
              style={css('padding:10px 17px;font-size:10.5px;letter-spacing:0.16em')}
            >
              COMPLETED
            </button>
          ) : (
            <button
              onClick={p.toggleTop}
              className="btn-out-strong"
              style={css('padding:10px 17px;font-size:10.5px;letter-spacing:0.16em')}
            >
              MARK COMPLETED
            </button>
          )}
        </div>
      </div>

      <div className="cols" style={css('margin:26px 34px 44px;gap:34px 32px')}>
        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          <TaskList
            num="01"
            label="WORK"
            accentLabel
            meta={p.workCountLabel}
            rows={p.workRows}
            box={13}
            addSize={17}
            rowPad={8}
            moveLabel="MISC"
            nextIdxLabel={p.nextWorkIdx}
            draft={p.newWorkTask}
            setDraft={p.setNewWorkTask}
            onKey={p.onWorkKey}
          />
          <TaskList
            num="02"
            label="MISC"
            meta={p.miscCountLabel}
            rows={p.miscRows}
            box={12}
            addSize={16}
            rowPad={7}
            moveLabel="WORK"
            nextIdxLabel={p.nextMiscIdx}
            draft={p.newMiscTask}
            setDraft={p.setNewMiscTask}
            onKey={p.onMiscKey}
          />
          <div style={{ ...footLine, display: 'flex', justifyContent: 'space-between', paddingTop: 2 }}>
            <span>{p.progressLabel}</span>
            <button onClick={p.onPurge} className="txtbtn" style={css('font-size:10.5px;letter-spacing:0.14em')}>
              PURGE DONE
            </button>
          </div>
        </div>

        <div style={css('display:flex;flex-direction:column;gap:16px')}>
          <Panel num="03" label="DAILY REPS" bottom={16}>
            <Rep
              title="One Lead"
              done={p.leadDone}
              toggle={p.toggleLead}
              value={p.leadWho}
              setValue={p.setLeadWho}
              placeholder="who — person or organisation…"
              dots={p.leadDots}
              streakLabel={p.leadStreakLabel}
            />
            <Rep
              title="One Post"
              done={p.postDone}
              toggle={p.togglePost}
              value={p.postWhat}
              setValue={p.setPostWhat}
              placeholder="what went out — post, clip, article…"
              dots={p.postDots}
              streakLabel={p.postStreakLabel}
            />
          </Panel>

          <Panel num="04" label="MONTH" meta={p.monthLeftLabel} bottom={16}>
            <input
              type="text"
              value={p.monthFocus}
              onChange={p.setMonthFocus}
              placeholder="one theme for the month…"
              className="uin ul-hair"
              style={css(
                `width:100%;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:${C.ink};padding:11px 0 10px`
              )}
            />
            <div style={css(`display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid ${C.borderHair}`)}>
              <span style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.12em;color:${C.inkLabel2}`)}>
                {p.msCountLabel}
              </span>
              <span style={css('flex:1')}>
                <Pips filled={p.msDone} total={Math.max(1, p.msTotal)} height={4} />
              </span>
            </div>
            {p.openMilestones.length > 0 ? (
              p.openMilestones.map((m) => (
                <div
                  key={m.key}
                  style={css(`display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid ${C.borderHair}`)}
                >
                  <Check done={false} onClick={m.toggle} size={12} label="Mark done" />
                  <span style={css(`flex:1;min-width:0;font-size:16.5px;color:${C.inkBody}`)}>{m.text}</span>
                </div>
              ))
            ) : (
              <div style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.14em;color:${C.inkLabel};padding:10px 0`)}>
                {p.milestoneEmptyLabel}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
