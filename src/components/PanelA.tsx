import HeroA from './HeroA'

interface PanelAProps {
  children: React.ReactNode
  headline?: string
  eyebrow?: string
  centered?: boolean
}

export default function PanelA({ children, headline, eyebrow, centered }: PanelAProps) {
  return (
    <div className="isb-panel-root">
      <HeroA />

      <div className="isb-form-panel" style={centered ? { justifyContent: 'center' } : undefined}>
        <div className="isb-help-link">
          Need help?{' '}
          <a href="mailto:itsupport@isbatuniversity.ac.ug" className="isb-link">
            itsupport@isbatuniversity.ac.ug
          </a>
        </div>

        <div className="isb-form-content" style={centered ? { textAlign: 'center' } : undefined}>
          <img
            src="/isbat-university-logo.png"
            alt="ISBAT University"
            style={{ display: 'block', height: 95, width: 'auto', marginInline: 'auto', marginBottom: 32 }}
          />
          {eyebrow && (
            <div style={{
              fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--isb-blue)', marginBottom: 10, fontWeight: 500,
            }}>
              {eyebrow}
            </div>
          )}
          {headline && (
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500,
              letterSpacing: '-0.02em', margin: '0 0 8px', color: 'var(--isb-ink)',
            }}>
              {headline}
            </h1>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
