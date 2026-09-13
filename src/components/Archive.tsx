import React from 'react'
import type { Entry, MonthCard, MonthDetail } from '../lib/archive'
import { C, MONO, css } from './ui'

interface Props {
  cards: MonthCard[]
  detail: MonthDetail | null
  onOpen: (tag: string) => void
  onClose: () => void
}

const caption = (mb: number) =>
  css(`font-family:${MONO};font-size:10px;letter-spacing:0.18em;color:${C.inkLabel2};margin-bottom:${mb}px`)
const boxed = (pad: string) => css(`background:${C.surface};border:1px solid ${C.border};padding:${pad}`)
const bodyText = css(`font-size:16.5px;color:${C.inkBody};line-height:1.5`)
const activeFlag = css(`font-family:${MONO};font-size:10px;letter-spacing:0.14em;color:${C.accent};white-space:nowrap`)

/** A captioned box — the unit every piece of archived content is rendered in. */
function Box({ label, pad = '13px 16px', mb = 4, children }: { label: string; pad?: string; mb?: number; children: React.ReactNode }) {
  return (
    <div style={boxed(pad)}>
      <div style={caption(mb)}>{label}</div>
      {children}
    </div>
  )
}

function WeekRow({ row }: { row: Entry }) {
  return (
    <div style={css('display:flex;align-items:stretch;margin-top:16px')}>
      <div style={css(`flex:none;width:110px;padding-right:18px;text-align:right;font-family:${MONO}`)}>
        <div style={css(`font-size:10.5px;letter-spacing:0.14em;color:${C.inkSoft}`)}>{row.label}</div>
        {row.live && <div style={{ ...activeFlag, marginTop: 3 }}>ACTIVE</div>}
      </div>
      <div style={css(`flex:none;width:22px;border-left:1px solid ${C.borderSoft};position:relative`)}>
        {row.live ? (
          <span style={css(`position:absolute;left:-4.5px;top:5px;width:9px;height:9px;background:${C.accent}`)} />
        ) : (
          <span
            style={css(
              `position:absolute;left:-4px;top:6px;width:8px;height:8px;background:${C.ground};border:1.5px solid ${C.inkFaint}`
            )}
          />
        )}
      </div>
      <div style={css('flex:1;min-width:0;padding-left:4px;display:flex;flex-direction:column;gap:10px')}>
        <Box label="FOCUS" pad="11px 14px">
          {row.headline ? (
            <div style={css(`font-size:20px;font-weight:500;letter-spacing:-0.01em;color:${C.ink};line-height:1.25`)}>
              {row.headline}
            </div>
          ) : (
            <div style={css(`font-size:17px;color:${C.inkLabel}`)}>No focus set</div>
          )}
        </Box>
        {row.priorities.length > 0 && (
          <Box label="PRIORITIES" pad="11px 14px" mb={5}>
            <div style={css('display:flex;flex-direction:column;gap:5px')}>
              {row.priorities.map((pr) => (
                <div key={pr.key} style={css('display:flex;gap:10px;align-items:baseline')}>
                  <span style={css(`font-family:${MONO};font-size:10px;color:${C.accent};width:14px;flex:none`)}>{pr.idx}</span>
                  <span style={bodyText}>{pr.text}</span>
                </div>
              ))}
            </div>
          </Box>
        )}
        {row.reflections.map((r) => (
          <Box key={r.key} label={r.name} pad="11px 14px" mb={3}>
            <div style={bodyText}>{r.text}</div>
          </Box>
        ))}
      </div>
    </div>
  )
}

function Detail({ detail, onClose }: { detail: MonthDetail; onClose: () => void }) {
  return (
    <div style={css('padding:22px 34px 44px')}>
      <button onClick={onClose} className="txtbtn" style={css(`font-size:10.5px;letter-spacing:0.16em;color:${C.inkSoft}`)}>
        ALL MONTHS
      </button>

      <div className="cols" style={css('margin-top:18px')}>
        <div style={css('display:flex;flex-direction:column;gap:12px')}>
          <Box label="PRIMARY FOCUS" mb={6}>
            {detail.headline ? (
              <div style={css(`font-size:29px;font-weight:500;letter-spacing:-0.02em;color:${C.ink};line-height:1.15`)}>
                {detail.headline}
              </div>
            ) : (
              <div style={css(`font-size:20px;color:${C.inkLabel}`)}>No focus set</div>
            )}
          </Box>
          {detail.metaLines.map((line) => (
            <Box key={line.key} label={line.boxLabel}>
              <div style={bodyText}>{line.value}</div>
            </Box>
          ))}
        </div>
        <div style={css('display:flex;flex-direction:column;gap:12px')}>
          {detail.reflections.map((r) => (
            <Box key={r.key} label={r.name}>
              <div style={bodyText}>{r.text}</div>
            </Box>
          ))}
        </div>
      </div>

      <div
        style={css(
          `font-family:${MONO};font-size:10.5px;letter-spacing:0.22em;color:${C.inkSoft};padding-bottom:9px;border-bottom:1px solid ${C.borderStrong};margin-top:32px`
        )}
      >
        WEEKS IN THIS MONTH
      </div>
      {detail.weeks.length > 0 ? (
        detail.weeks.map((row) => <WeekRow key={row.key} row={row} />)
      ) : (
        <div style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.14em;color:${C.inkLabel};margin-top:14px`)}>
          NO WEEKS RECORDED
        </div>
      )}
    </div>
  )
}

export default function Archive({ cards, detail, onOpen, onClose }: Props) {
  if (detail) return <Detail detail={detail} onClose={onClose} />

  return (
    <div style={css('padding:26px 34px 44px')}>
      <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:16px')}>
        {cards.map((card) => (
          <button
            key={card.key}
            onClick={() => onOpen(card.tag)}
            className="hit"
            style={css(
              `text-align:left;display:flex;flex-direction:column;gap:11px;background:${C.surface};border:1px solid ${C.border};padding:16px 18px 14px`
            )}
          >
            <div style={css(`display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-family:${MONO}`)}>
              <span style={css(`font-size:10.5px;letter-spacing:0.18em;white-space:nowrap;color:${C.inkSoft}`)}>
                {card.label}
              </span>
              {card.live && <span style={activeFlag}>ACTIVE</span>}
            </div>

            {card.headline ? (
              <div style={css(`font-size:21px;font-weight:500;letter-spacing:-0.01em;color:${C.ink};line-height:1.2`)}>
                {card.headline}
              </div>
            ) : (
              <div style={css(`font-size:18px;color:${C.inkLabel}`)}>No focus set</div>
            )}

            <div style={css('display:flex;flex-direction:column;gap:3px')}>
              {card.metaLines.length > 0 ? (
                card.metaLines.map((line) => (
                  <div key={line.key} style={css(`font-size:15.5px;color:${C.inkBody};line-height:1.45`)}>
                    <span style={{ color: C.inkSoft }}>{line.label}</span>
                    {line.value}
                  </div>
                ))
              ) : (
                <div style={css(`font-size:15.5px;color:${C.inkLabel}`)}>No milestones or revenue recorded</div>
              )}
            </div>

            <div
              style={css(
                `display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:10px;border-top:1px solid ${C.borderHair};font-family:${MONO};font-size:10px;letter-spacing:0.14em`
              )}
            >
              <span style={{ color: C.inkLabel2 }}>{card.weeksLabel}</span>
              <span style={{ color: C.accent }}>OPEN</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
