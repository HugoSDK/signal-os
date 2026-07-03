interface Line {
  label: string
  value: string
}

interface Props {
  kind: 'week' | 'month'
  endedLabel: string // e.g. "Week 27" or "June 2026"
  nextLabel: string // e.g. "Week 28" or "July 2026"
  lines: Line[]
  onArchive: () => void
  onKeep: () => void
  onLater: () => void
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(28,25,23,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}

const card: React.CSSProperties = {
  width: 500,
  maxWidth: '100%',
  background: '#f7f4ee',
  border: '1px solid #e0d9ca',
  boxShadow: '0 8px 40px rgba(28,25,23,0.28)',
  borderRadius: 6,
  padding: '30px 34px 26px',
}

export default function RolloverPrompt({ kind, endedLabel, nextLabel, lines, onArchive, onKeep, onLater }: Props) {
  const noun = kind === 'week' ? 'week' : 'month'
  return (
    <div style={overlay} onClick={onLater}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.16em', color: '#8a8175' }}>
          NEW {noun.toUpperCase()} — {nextLabel.toUpperCase()}
        </div>
        <h2
          style={{
            margin: '10px 0 4px',
            fontFamily: "'Source Serif 4', serif",
            fontSize: 27,
            fontWeight: 600,
            color: '#1c1917',
          }}
        >
          {endedLabel} has ended.
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontFamily: "'Source Serif 4', serif",
            fontStyle: 'italic',
            fontSize: 18,
            lineHeight: 1.5,
            color: '#8a8175',
          }}
        >
          Review last {noun}, then start fresh — or keep it going.
        </p>

        <div
          style={{
            border: '1px solid #e3ddd0',
            borderRadius: 6,
            background: '#fdfcf9',
            padding: '14px 16px',
            marginBottom: 22,
          }}
        >
          {lines.length === 0 ? (
            <div style={{ fontSize: 15, color: '#a89f90', fontStyle: 'italic' }}>Nothing recorded.</div>
          ) : (
            lines.map((l, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '5px 0',
                  borderBottom: i < lines.length - 1 ? '1px solid #eee8db' : 'none',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 96,
                    fontSize: 12.5,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    color: '#a89f90',
                    paddingTop: 2,
                  }}
                >
                  {l.label}
                </span>
                <span style={{ flex: 1, fontSize: 16, color: '#44403c' }}>{l.value}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={onArchive}
            style={{
              flex: 1,
              background: 'var(--accent, #7c2d12)',
              color: '#f7f4ee',
              border: 'none',
              borderRadius: 4,
              padding: '11px 0',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Archive &amp; start fresh
          </button>
          <button
            onClick={onKeep}
            style={{
              flex: 'none',
              background: 'transparent',
              color: '#1c1917',
              border: '1px solid #d8d0bf',
              borderRadius: 4,
              padding: '11px 16px',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Keep it
          </button>
          <button
            onClick={onLater}
            style={{
              flex: 'none',
              background: 'none',
              border: 'none',
              color: '#b5ab9a',
              cursor: 'pointer',
              fontSize: 14,
              padding: '11px 6px',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
