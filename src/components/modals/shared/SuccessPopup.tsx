'use client'
import { useEffect, useState } from 'react'

const DURATION_S = parseInt(process.env.NEXT_PUBLIC_SUCCESS_POPUP_DURATION ?? '5', 10)

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
}

export function SuccessPopup({ title, subtitle, onClose }: Props) {
  const [remaining, setRemaining] = useState(DURATION_S)

  useEffect(() => {
    const closeTimer = setTimeout(onClose, DURATION_S * 1000)
    const tickTimer  = setInterval(() => setRemaining(s => s - 1), 1000)
    return () => { clearTimeout(closeTimer); clearInterval(tickTimer) }
  }, [onClose])

  return (
    <div style={{ textAlign: 'center', padding: '36px 28px 30px', position: 'relative' }}>

      {/* Close (×) */}
      <button
        className="modal-close"
        onClick={onClose}
        aria-label="Close"
        style={{ position: 'absolute', top: 10, right: 10 }}
      >
        <i className="lni lni-close"></i>
      </button>

      {/* Animated illustration */}
      <div style={{
        display: 'inline-block',
        animation: 'ss-pop 500ms cubic-bezier(0.34,1.56,0.64,1) both',
        marginBottom: 20,
      }}>
        <svg width="130" height="130" viewBox="0 0 130 130" fill="none" aria-hidden="true">
          <defs>
            <filter id="sp-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="9" floodColor="#2EA862" floodOpacity="0.18"/>
            </filter>
          </defs>

          {/* Floating accent dots */}
          <circle cx="8"   cy="62"  r="4"   fill="#2E6BE6" style={{ animation: 'ss-dot 500ms ease  900ms both' }}/>
          <circle cx="122" cy="68"  r="3.5" fill="#2EA862" style={{ animation: 'ss-dot 500ms ease  950ms both' }}/>
          <circle cx="18"  cy="108" r="3"   fill="#D9A51E" style={{ animation: 'ss-dot 500ms ease 1050ms both' }}/>
          <circle cx="112" cy="106" r="4"   fill="#2E6BE6" style={{ animation: 'ss-dot 500ms ease 1000ms both' }}/>
          <circle cx="10"  cy="88"  r="3"   fill="#2EA862" style={{ animation: 'ss-dot 500ms ease  980ms both' }}/>
          <circle cx="120" cy="90"  r="3"   fill="#D9A51E" style={{ animation: 'ss-dot 500ms ease  930ms both' }}/>

          {/* Background fill */}
          <circle cx="65" cy="65" r="52" fill="#E4F4EB" filter="url(#sp-glow)"/>

          {/* Outer ghost ring */}
          <circle
            cx="65" cy="65" r="58"
            stroke="#2EA862" strokeWidth="1" fill="none" opacity="0.2"
            strokeDasharray="364" strokeDashoffset="364"
            transform="rotate(-90 65 65)"
            style={{ animation: 'ss-ring 900ms ease 140ms forwards' }}
          />

          {/* Main animated ring */}
          <circle
            cx="65" cy="65" r="52"
            stroke="#2EA862" strokeWidth="3.5" fill="none"
            strokeDasharray="327" strokeDashoffset="327"
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
            style={{ animation: 'ss-ring 680ms cubic-bezier(0.4,0,0.2,1) 180ms forwards' }}
          />

          {/* Checkmark */}
          <path
            d="M41 65 L55 79 L91 42"
            stroke="#2EA862" strokeWidth="5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="74" strokeDashoffset="74"
            style={{ animation: 'ss-check 400ms cubic-bezier(0.4,0,0.2,1) 720ms forwards' }}
          />
        </svg>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--g900)', marginBottom: 6,
        animation: 'ss-rise 380ms ease 880ms both', opacity: 0,
      }}>
        {title}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize: 'var(--fs-sm)', color: 'var(--g500)', lineHeight: 1.6,
          animation: 'ss-rise 380ms ease 1020ms both', opacity: 0,
        }}>
          {subtitle}
        </div>
      )}

      {/* Continue button */}
      <div style={{ marginTop: 20, animation: 'ss-rise 380ms ease 1100ms both', opacity: 0 }}>
        <button className="btn btn-primary" onClick={onClose}>
          Continue →
        </button>
      </div>

      {/* Countdown */}
      <div style={{
        marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 'var(--fs-xs)', color: 'var(--g400)',
        animation: 'ss-rise 380ms ease 1180ms both', opacity: 0,
      }}>
        <span style={{
          display: 'inline-block', width: 10, height: 10, flexShrink: 0,
          border: '2px solid var(--g200)', borderTopColor: 'var(--green)',
          borderRadius: '50%', animation: 'spin 700ms linear infinite',
        }}/>
        Closing automatically in <strong style={{ color: 'var(--g600)', minWidth: 8 }}>{Math.max(remaining, 0)}</strong> second{remaining !== 1 ? 's' : ''}…
      </div>
    </div>
  )
}
