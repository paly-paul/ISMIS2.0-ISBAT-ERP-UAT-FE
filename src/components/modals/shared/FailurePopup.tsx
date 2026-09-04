'use client'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
}

// Failure counterpart to SuccessPopup — same animated-illustration layout
// and timing, red/error themed instead of green, no auto-dismiss countdown
// since the user needs to actually read the error before retrying.
export function FailurePopup({ title, subtitle, onClose }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 28px 30px', position: 'relative' }}>

      {/* Close (×) — same convention as SuccessPopup, so the user can
          dismiss without needing to click "Try Again". */}
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
            <filter id="fp-glow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="5" stdDeviation="9" floodColor="var(--red)" floodOpacity="0.18"/>
            </filter>
          </defs>

          {/* Floating accent dots */}
          <circle cx="8"   cy="62"  r="4"   fill="var(--red)" style={{ animation: 'ss-dot 500ms ease  900ms both' }}/>
          <circle cx="122" cy="68"  r="3.5" fill="var(--red)" style={{ animation: 'ss-dot 500ms ease  950ms both' }}/>
          <circle cx="18"  cy="108" r="3"   fill="#D9A51E"    style={{ animation: 'ss-dot 500ms ease 1050ms both' }}/>
          <circle cx="112" cy="106" r="4"   fill="var(--red)" style={{ animation: 'ss-dot 500ms ease 1000ms both' }}/>
          <circle cx="10"  cy="88"  r="3"   fill="var(--red)" style={{ animation: 'ss-dot 500ms ease  980ms both' }}/>
          <circle cx="120" cy="90"  r="3"   fill="#D9A51E"    style={{ animation: 'ss-dot 500ms ease  930ms both' }}/>

          {/* Background fill */}
          <circle cx="65" cy="65" r="52" fill="var(--red-bg)" filter="url(#fp-glow)"/>

          {/* Outer ghost ring */}
          <circle
            cx="65" cy="65" r="58"
            stroke="var(--red)" strokeWidth="1" fill="none" opacity="0.2"
            strokeDasharray="364" strokeDashoffset="364"
            transform="rotate(-90 65 65)"
            style={{ animation: 'ss-ring 900ms ease 140ms forwards' }}
          />

          {/* Main animated ring */}
          <circle
            cx="65" cy="65" r="52"
            stroke="var(--red)" strokeWidth="3.5" fill="none"
            strokeDasharray="327" strokeDashoffset="327"
            strokeLinecap="round"
            transform="rotate(-90 65 65)"
            style={{ animation: 'ss-ring 680ms cubic-bezier(0.4,0,0.2,1) 180ms forwards' }}
          />

          {/* X mark */}
          <path
            d="M48 48 L82 82 M82 48 L48 82"
            stroke="var(--red)" strokeWidth="5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="96" strokeDashoffset="96"
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

      {/* Dismiss button */}
      <div style={{ marginTop: 20, animation: 'ss-rise 380ms ease 1100ms both', opacity: 0 }}>
        <button className="btn btn-danger" onClick={onClose}>
          Try Again
        </button>
      </div>
    </div>
  )
}
