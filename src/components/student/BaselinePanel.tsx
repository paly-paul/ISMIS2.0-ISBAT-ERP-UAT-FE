interface BaselineItem {
  label: string
  value: React.ReactNode
  accent?: boolean
}

interface BaselinePanelProps {
  label: string
  items: BaselineItem[]
}

// Read-only "Active Baseline Profile" grid shown at the top of each Transfer
// page once a student is loaded — ported from the mockup's .baseline block.
export function BaselinePanel({ label, items }: BaselinePanelProps) {
  return (
    <div className="baseline">
      <div className="baseline-lbl"><i className="lni lni-shield"></i> {label}</div>
      <div className="baseline-grid">
        {items.map((item, i) => (
          <div className="b-item" key={i}>
            <div className="b-lbl">{item.label}</div>
            <div className="b-val" style={item.accent ? { color: 'var(--b700)', fontFamily: 'monospace' } : undefined}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
