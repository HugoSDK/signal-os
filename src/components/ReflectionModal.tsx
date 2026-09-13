import React from 'react'
import { C, MONO, Modal, ModalSection, css, modalArea } from './ui'

type AreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => void

interface Props {
  dayOfYearLabel: string
  dayTitle: string
  lines: { key: string; label: string; value: string }[]
  wentWell: string
  setWentWell: AreaChange
  improve: string
  setImprove: AreaChange
  /** The day's gratitude lines, one per newline. */
  gratitude: string
  setGratitude: AreaChange
  onClose: () => void
}

export default function ReflectionModal(p: Props) {
  return (
    <Modal eyebrow={'END OF DAY · ' + p.dayOfYearLabel} title={p.dayTitle} cta="CLOSE THE DAY" onClose={p.onClose}>
      <div style={css('padding:4px 30px 0')}>
        {p.lines.map((line) => (
          <div
            key={line.key}
            style={css(
              `display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:8px 0;border-bottom:1px solid ${C.borderHair}`
            )}
          >
            <span style={css(`font-size:15px;color:${C.inkSoft}`)}>{line.label}</span>
            <span style={css(`font-family:${MONO};font-size:14.5px;font-weight:500;color:${C.ink}`)}>{line.value}</span>
          </div>
        ))}
      </div>

      <div style={css('display:flex;flex-direction:column;gap:20px;padding:22px 30px 0')}>
        <ModalSection num="01" label="WHAT WENT WELL">
          <textarea
            value={p.wentWell}
            onChange={p.setWentWell}
            rows={3}
            placeholder="the wins worth keeping…"
            className="ta"
            style={modalArea}
          />
        </ModalSection>
        <ModalSection num="02" label="WHAT COULD BE IMPROVED">
          <textarea
            value={p.improve}
            onChange={p.setImprove}
            rows={3}
            placeholder="the correction for tomorrow…"
            className="ta"
            style={modalArea}
          />
        </ModalSection>
        <ModalSection num="03" label="GRATEFUL FOR">
          <textarea
            value={p.gratitude}
            onChange={p.setGratitude}
            rows={3}
            placeholder="one line each…"
            className="ta"
            style={modalArea}
          />
        </ModalSection>
      </div>
    </Modal>
  )
}
