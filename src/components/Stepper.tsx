interface StepperProps {
  steps: string[]
  current: number
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--isb-muted)' }}>
      {steps.map((s, i) => (
        <span key={s} style={{ display: 'contents' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: i <= current ? 'var(--isb-ink)' : 'var(--isb-muted)',
            fontWeight: i === current ? 600 : 400,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 99,
              display: 'grid', placeContent: 'center', fontSize: 10,
              background: i < current ? 'var(--isb-blue)' : i === current ? 'var(--isb-ink)' : 'var(--isb-paper)',
              color: i <= current ? '#fff' : 'var(--isb-muted)',
              border: i > current ? '1px solid var(--isb-line)' : 'none',
              flexShrink: 0,
            }}>
              {i < current ? '✓' : i + 1}
            </div>
            {s}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 18, height: 1, background: 'var(--isb-line)', flexShrink: 0 }} />
          )}
        </span>
      ))}
    </div>
  )
}
