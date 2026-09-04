'use client'

import { useEffect } from 'react'

interface Props {
  title?: string
  subtitle: string
  redirectTo?: string
  redirectDelay?: number
}

export default function SuccessScreen({ title, subtitle, redirectTo, redirectDelay = 6000 }: Props) {
  useEffect(() => {
    if (!redirectTo) return
    const t = setTimeout(() => { window.location.href = redirectTo }, redirectDelay)
    return () => clearTimeout(t)
  }, [redirectTo, redirectDelay])

  const textDelay = title ? 1020 : 880
  const actionDelay = textDelay + 160

  return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>

      {/* Illustration */}
      <div style={{
        display: 'inline-block',
        animation: 'ss-pop 500ms cubic-bezier(0.34,1.56,0.64,1) both',
        marginBottom: 22,
      }}>
        <svg width="180" height="200" viewBox="0 0 180 200" fill="none" aria-hidden="true">
          <defs>
            <filter id="ss-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#2EA862" floodOpacity="0.16"/>
            </filter>
          </defs>

          {/* Floating accent dots */}
          <circle cx="24"  cy="96"  r="5"   fill="#2E6BE6" style={{ animation: 'ss-dot 500ms ease  900ms both' }}/>
          <circle cx="158" cy="102" r="4"   fill="#2EA862" style={{ animation: 'ss-dot 500ms ease  950ms both' }}/>
          <circle cx="36"  cy="162" r="3.5" fill="#D9A51E" style={{ animation: 'ss-dot 500ms ease 1050ms both' }}/>
          <circle cx="150" cy="158" r="4.5" fill="#2E6BE6" style={{ animation: 'ss-dot 500ms ease 1000ms both' }}/>
          <circle cx="16"  cy="136" r="3"   fill="#2EA862" style={{ animation: 'ss-dot 500ms ease  980ms both' }}/>
          <circle cx="165" cy="140" r="3"   fill="#D9A51E" style={{ animation: 'ss-dot 500ms ease  930ms both' }}/>

          {/* ── Graduation cap ── */}
          <polygon points="90,16 118,38 90,60 62,38" fill="#0E1628"/>
          <polygon points="90,16 118,38 90,44 62,38" fill="white" opacity="0.06"/>
          <rect x="72" y="57" width="36" height="15" rx="4" fill="#2A3345"/>
          <circle cx="90" cy="38" r="5" fill="#2EA862"/>
          <path d="M118,38 Q130,46 126,68" stroke="#D9A51E" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <circle cx="125" cy="72" r="5.5" fill="#D9A51E"/>
          <line x1="120" y1="77" x2="117" y2="89" stroke="#D9A51E" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="125" y1="78" x2="125" y2="90" stroke="#D9A51E" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="130" y1="77" x2="133" y2="89" stroke="#D9A51E" strokeWidth="1.8" strokeLinecap="round"/>

          {/* ── Success circle ── */}
          <circle cx="90" cy="135" r="52" fill="#E4F4EB" filter="url(#ss-glow)"/>

          {/* Outer ghost ring */}
          <circle
            cx="90" cy="135" r="57"
            stroke="#2EA862" strokeWidth="1" fill="none" opacity="0.2"
            strokeDasharray="358" strokeDashoffset="358"
            transform="rotate(-90 90 135)"
            style={{ animation: 'ss-ring 900ms ease 140ms forwards' }}
          />

          {/* Main animated ring */}
          <circle
            cx="90" cy="135" r="52"
            stroke="#2EA862" strokeWidth="3.5" fill="none"
            strokeDasharray="327" strokeDashoffset="327"
            strokeLinecap="round"
            transform="rotate(-90 90 135)"
            style={{ animation: 'ss-ring 680ms cubic-bezier(0.4,0,0.2,1) 180ms forwards' }}
          />

          {/* ── Checkmark ── */}
          <path
            d="M66 135 L80 149 L116 112"
            stroke="#2EA862" strokeWidth="5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="74" strokeDashoffset="74"
            style={{ animation: 'ss-check 400ms cubic-bezier(0.4,0,0.2,1) 720ms forwards' }}
          />
        </svg>
      </div>

      {/* Title */}
      {title && (
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 27, fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--isb-ink)',
          marginBottom: 8,
          animation: 'ss-rise 380ms ease 880ms both',
        }}>
          {title}
        </div>
      )}

      {/* Subtitle */}
      <div style={{
        fontSize: 13.5, color: 'var(--isb-muted)', lineHeight: 1.6,
        maxWidth: 260, margin: '0 auto',
        animation: `ss-rise 380ms ease ${title ? 1020 : 880}ms both`,
      }}>
        {subtitle}
      </div>

      {/* Actions */}
      <div style={{
        marginTop: 22,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        animation: `ss-rise 380ms ease ${actionDelay}ms both`,
      }}>
        {redirectTo && (
          <button
            className="isb-btn primary"
            style={{ minWidth: 200 }}
            onClick={() => { window.location.href = redirectTo }}
          >
            Continue &rarr;
          </button>
        )}
        {redirectTo && (
          <div style={{
            fontSize: 12, color: 'var(--isb-muted)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              display: 'inline-block', width: 11, height: 11, flexShrink: 0,
              border: '2px solid var(--isb-line)', borderTopColor: 'var(--isb-blue)',
              borderRadius: '50%',
              animation: 'spin 700ms linear infinite',
            }}/>
            Redirecting automatically in a few seconds…
          </div>
        )}
      </div>
    </div>
  )
}
