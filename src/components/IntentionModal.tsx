import React from 'react'
import { C, MONO, Modal, ModalSection, css, modalArea } from './ui'

export interface TaskOption {
  key: number
  text: string
  selected: boolean
  tag: string
  pick: () => void
}

/** The last day's intention, shown for review before today's is set. */
export interface IntentionReview {
  /** 'YESTERDAY', or e.g. 'FRI 19 SEP' after a gap. */
  label: string
  text: string
  done: boolean
  markDone: () => void
  /** Reuse it as today's intention. */
  carry: () => void
  /** Today's intention already matches it. */
  carried: boolean
}

interface Props {
  dayOfYearLabel: string
  review: IntentionReview | null
  intentionText: string
  setIntention: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  options: TaskOption[]
  onClose: () => void
}

export default function IntentionModal(p: Props) {
  return (
    <Modal
      eyebrow={'START OF DAY · ' + p.dayOfYearLabel}
      title="Set the day's intention"
      cta="BEGIN THE DAY"
      onClose={p.onClose}
    >
      <div style={css('display:flex;flex-direction:column;gap:20px;padding:22px 30px 0')}>
        {p.review && <Review r={p.review} />}

        <ModalSection num={p.review ? '02' : '01'} label="PICK AN OPEN TASK">
          {p.options.length === 0 ? (
            <div
              style={css(
                `background:${C.raised};border:1px solid ${C.borderSoft};padding:14px 13px;font-family:${MONO};font-size:10.5px;letter-spacing:0.16em;color:${C.inkFaint}`
              )}
            >
              NO OPEN TASKS
            </div>
          ) : (
            <div style={css('display:flex;flex-direction:column;gap:6px')}>
              {p.options.map((opt) => (
                <button
                  key={opt.key}
                  onClick={opt.pick}
                  className="hit"
                  style={css(
                    `display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:${C.raised};border:1px solid ${C.borderSoft};padding:11px 13px;font-family:inherit`
                  )}
                >
                  <span
                    style={css(
                      'flex:none;width:12px;height:12px;border-radius:99px;' +
                        (opt.selected
                          ? `border:1px solid ${C.accent};background:${C.accent};box-shadow:inset 0 0 0 2px ${C.raised}`
                          : `border:1px solid ${C.borderStrong}`)
                    )}
                  />
                  <span style={css(`flex:1;min-width:0;font-size:15.5px;color:${C.inkBody}`)}>{opt.text}</span>
                  <span
                    style={css(
                      `flex:none;font-family:${MONO};font-size:9.5px;letter-spacing:0.16em;color:${C.inkFaint}`
                    )}
                  >
                    {opt.tag}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ModalSection>

        <ModalSection num={p.review ? '03' : '02'} label="OR WRITE YOUR OWN">
          <textarea
            value={p.intentionText}
            onChange={p.setIntention}
            rows={2}
            placeholder="the one thing today is for…"
            className="ta"
            style={modalArea}
          />
        </ModalSection>
      </div>
    </Modal>
  )
}

function Review({ r }: { r: IntentionReview }) {
  return (
    <ModalSection num="01" label={'REVIEW · ' + r.label}>
      <div style={css(`background:${C.raised};border:1px solid ${C.borderSoft};padding:12px 13px`)}>
        <div style={css('display:flex;align-items:flex-start;gap:12px')}>
          <span style={css(`flex:1;min-width:0;font-size:15.5px;line-height:1.4;color:${C.inkBody};overflow-wrap:anywhere`)}>{r.text}</span>
          {r.done && (
            <span
              style={css(
                `flex:none;display:flex;align-items:center;gap:7px;padding-top:3px;font-family:${MONO};font-size:9.5px;letter-spacing:0.16em;color:${C.accent}`
              )}
            >
              <span className="chk done" aria-hidden style={css('width:12px;height:12px;cursor:default')}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              COMPLETED
            </span>
          )}
        </div>
        {!r.done && (
          <div style={css('display:flex;align-items:center;gap:16px;margin-top:12px')}>
            <button onClick={r.markDone} className="btn-out-strong" style={css('padding:8px 14px;font-size:10px;letter-spacing:0.16em')}>
              MARK COMPLETED
            </button>
            {r.carried ? (
              <span style={css(`font-family:${MONO};font-size:10px;letter-spacing:0.14em;color:${C.inkFaint}`)}>
                CARRIED TO TODAY
              </span>
            ) : (
              <button onClick={r.carry} className="txtbtn" style={css('font-size:10px;letter-spacing:0.14em')}>
                CARRY TO TODAY
              </button>
            )}
          </div>
        )}
      </div>
    </ModalSection>
  )
}
