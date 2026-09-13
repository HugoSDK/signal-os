import React from 'react'
import { C, MONO, Modal, ModalSection, css, modalArea } from './ui'

export interface TaskOption {
  key: number
  text: string
  selected: boolean
  tag: string
  pick: () => void
}

interface Props {
  dayOfYearLabel: string
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
        <ModalSection num="01" label="PICK AN OPEN TASK">
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

        <ModalSection num="02" label="OR WRITE YOUR OWN">
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
