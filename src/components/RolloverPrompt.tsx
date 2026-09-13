import { C, CornerTicks, MONO, css } from './ui'

interface Line {
  label: string
  value: string
}

interface Props {
  kind: 'week' | 'month'
  endedLabel: string // e.g. "W37" or "AUGUST 2026"
  nextLabel: string // e.g. "W38" or "SEPTEMBER 2026"
  lines: Line[]
  onArchive: () => void
  onKeep: () => void
  onLater: () => void
  /** The snapshot didn't reach the DB, so clearing was refused. */
  error?: boolean
}

export default function RolloverPrompt({ kind, endedLabel, nextLabel, lines, onArchive, onKeep, onLater, error }: Props) {
  return (
    <div
      style={css(
        'position:fixed;inset:0;z-index:1000;background:rgba(14,20,21,0.4);display:flex;align-items:center;justify-content:center;padding:20px'
      )}
      onClick={onLater}
    >
      <div
        style={css(`width:480px;max-width:100%;background:${C.surface};border:1px solid ${C.borderStrong};padding:26px 30px 24px;position:relative`)}
        onClick={(e) => e.stopPropagation()}
      >
        <CornerTicks />
        <div style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.2em;color:${C.accent}`)}>
          {'NEW ' + kind.toUpperCase() + ' — ' + nextLabel}
        </div>
        <h2 style={css(`margin:10px 0 18px;font-size:26px;font-weight:500;letter-spacing:-0.02em;color:${C.ink}`)}>
          {endedLabel} has ended.
        </h2>

        <div style={css(`border-top:1px solid ${C.borderSoft};padding-top:4px;margin-bottom:20px`)}>
          {lines.length === 0 ? (
            <div style={css(`font-family:${MONO};font-size:10.5px;letter-spacing:0.14em;color:${C.inkLabel};padding:8px 0`)}>
              NOTHING RECORDED
            </div>
          ) : (
            lines.map((l, i) => (
              <div key={i} style={css(`display:flex;gap:14px;padding:7px 0;border-bottom:1px solid ${C.borderHair}`)}>
                <span
                  style={css(
                    `flex:none;width:92px;font-family:${MONO};font-size:10px;letter-spacing:0.14em;color:${C.inkLabel2};padding-top:3px`
                  )}
                >
                  {l.label}
                </span>
                <span style={css(`flex:1;min-width:0;font-size:16px;color:${C.inkBody}`)}>{l.value}</span>
              </div>
            ))
          )}
        </div>

        {error && (
          <div style={css(`font-size:15px;color:${C.accent};margin:0 0 12px`)}>
            Could not save to archive — nothing was cleared.
          </div>
        )}

        <div style={css('display:flex;gap:10px;align-items:center')}>
          <button onClick={onArchive} className="btn-pri" style={css('flex:1;padding:11px 0;font-size:10.5px;letter-spacing:0.16em')}>
            ARCHIVE &amp; RESET
          </button>
          <button onClick={onKeep} className="btn-out-strong" style={css('flex:none;padding:11px 16px;font-size:10.5px;letter-spacing:0.16em')}>
            KEEP
          </button>
          <button onClick={onLater} className="txtbtn" style={css('flex:none;font-size:10.5px;letter-spacing:0.16em;padding:11px 6px')}>
            LATER
          </button>
        </div>
      </div>
    </div>
  )
}
