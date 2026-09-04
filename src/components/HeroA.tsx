import LiveStatsRotator from './LiveStatsRotator'
import HeroImageSlider from './HeroImageSlider'
import PolicyFooter from './PolicyFooter'

const ACCENT = '#2E6BE6'

export default function HeroA() {
  return (
    <div
      className="isb-hero-panel"
      style={{
        position: 'relative', height: '100%',
        background: `linear-gradient(170deg, ${ACCENT} 0%, #1A3C94 100%)`,
        padding: '48px 56px', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid pattern */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .08 }}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="grid-a" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0v28" fill="none" stroke="#fff" strokeWidth=".5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-a)"/>
      </svg>

      {/* Orange left accent stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#E68A2E' }} />

      {/* Brand lockup */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: '#fff', color: ACCENT,
          display: 'grid', placeContent: 'center',
          fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em',
          flexShrink: 0,
        }}>
          IS
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500 }}>
            ISBAT University
          </div>
          <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', opacity: .7 }}>
            Enterprise Resource Portal
          </div>
        </div>
      </div>

      {/* Headline */}
      <div style={{ position: 'relative', marginTop: 56, color: '#fff' }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1.1,
          fontWeight: 500, letterSpacing: '-0.02em', maxWidth: 420,
        }}>
          One portal for the work of the university.
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, opacity: .78, marginTop: 16, maxWidth: 380 }}>
          Admissions, academics, assessments and student services — coordinated in real time
          for faculty, staff and students.
        </div>
      </div>

      {/* Image slider */}
      <div style={{
        position: 'relative', flex: 1, minHeight: 300, marginTop: 24,
        marginLeft: -56, marginRight: -56, display: 'flex',
      }}>
        <HeroImageSlider />
      </div>

      {/* Live stats */}
      <div style={{ position: 'relative', marginTop: 'auto', paddingTop: 32 }}>
        <LiveStatsRotator />
      </div>

      {/* Policy footer */}
      <div style={{
        position: 'relative', marginTop: 32, paddingTop: 20,
        borderTop: '1px solid rgba(255,255,255,.15)',
      }}>
        <PolicyFooter tone="dark" />
      </div>
    </div>
  )
}
