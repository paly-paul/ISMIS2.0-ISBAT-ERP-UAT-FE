import Icon, { type IconName } from './Icon'

interface MethodPillProps {
  icon: IconName
  label: string
  sub: string
  active?: boolean
  onClick: () => void
}

export default function MethodPill({ icon, label, sub, active = false, onClick }: MethodPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: 'unset', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        border: active ? '1px solid var(--isb-blue)' : '1px solid var(--isb-line)',
        background: active ? 'var(--isb-blue-050)' : '#fff',
        borderRadius: 8, transition: 'all .15s', width: '100%',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: active ? 'var(--isb-blue)' : 'var(--isb-paper)',
        color: active ? '#fff' : 'var(--isb-muted)',
        display: 'grid', placeContent: 'center',
      }}>
        <Icon name={icon} size={14} color="currentColor" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--isb-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--isb-muted)', fontFamily: 'var(--font-mono)' }}>
          {sub}
        </div>
      </div>
    </button>
  )
}
