'use client'
import { useEffect, useState } from 'react'
import { EnquiryEmailVerifyModal, VerifiedEmail } from '@/components/modals/admission/EnquiryEmailVerifyModal'

export type { VerifiedEmail }

// Email field for the enquiry create forms (Online / Kiosk / On-Desk). Since
// the 2026-10 handoff, POST /enquiries needs an emailVerificationToken issued
// for this exact email, so verification happens here, before Save:
//   type email → Verify (OTP modal) → token held by the page → Save.
// Once verified the email is read-only (the server rejects a token issued for
// another address). It becomes editable again only when the token's 30
// minutes run out and it's dropped, or when the page resets the form.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const EMAIL_MAX = 50

export function isValidEnquiryEmail(email: string) {
  const v = email.trim()
  return v.length > 0 && v.length <= EMAIL_MAX && EMAIL_RE.test(v)
}

const norm = (e: string) => e.trim().toLowerCase()

export function isVerifiedFor(verified: VerifiedEmail | null, email: string) {
  return !!verified && verified.expiresAt > Date.now() && norm(verified.email) === norm(email)
}

// Sits beside the Save button and says why it's disabled (or that it's now
// ready), since a faded button alone doesn't explain itself. Soft blue while
// verification is pending — a required step, not a warning — then green.
export function EnquirySaveStatus({ verified }: { verified: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2"
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 500,
        lineHeight: 1.3,
        border: `1px solid ${verified ? 'var(--green-bd)' : 'var(--b100)'}`,
        background: verified ? 'var(--green-bg)' : 'var(--b50)',
        color: verified ? 'var(--green)' : 'var(--g600)',
        transition: 'background .25s ease, border-color .25s ease, color .25s ease',
      }}
    >
      <i
        className={`lni ${verified ? 'lni-checkmark-circle' : 'lni-lock'}`}
        aria-hidden="true"
        style={{ fontSize: 14, color: verified ? 'var(--green)' : 'var(--b600)', flexShrink: 0 }}
      ></i>
      {verified
        ? 'Email verified. You can save the enquiry now.'
        : 'Verify the candidate’s email to enable saving.'}
    </div>
  )
}

interface Props {
  email: string
  onEmailChange: (email: string) => void
  verified: VerifiedEmail | null
  onVerifiedChange: (verified: VerifiedEmail | null) => void
  error?: string
  onClearError?: () => void
  studentName?: string
}

export function EnquiryEmailField({ email, onEmailChange, verified, onVerifiedChange, error, onClearError, studentName }: Props) {
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  // Emails that hit the daily send limit this session. Only ever filled from
  // a real too_many_requests response — never a client-side count.
  const [limitedEmails, setLimitedEmails] = useState<Set<string>>(new Set())

  const isVerified = isVerifiedFor(verified, email)
  const limited = limitedEmails.has(norm(email))

  // Drop the token when it runs out so Save disables again instead of the
  // create call failing with "Email is not verified…".
  useEffect(() => {
    if (!verified) return
    const ms = verified.expiresAt - Date.now()
    if (ms <= 0) { setExpired(true); onVerifiedChange(null); return }
    const t = setTimeout(() => { setExpired(true); onVerifiedChange(null) }, ms)
    return () => clearTimeout(t)
  }, [verified, onVerifiedChange])

  function handleChange(value: string) {
    onEmailChange(value)
    setLocalError(null)
    setExpired(false)
    onClearError?.()
    if (verified && norm(value) !== norm(verified.email)) onVerifiedChange(null)
  }

  function openVerify() {
    if (!isValidEnquiryEmail(email)) {
      setLocalError(email.trim().length > EMAIL_MAX ? `Email must be ${EMAIL_MAX} characters or fewer.` : 'Enter a valid email.')
      return
    }
    setLocalError(null)
    setVerifyOpen(true)
  }

  const shownError = localError || error
  const hint = isVerified
    ? null
    : limited
      ? 'You have reached the OTP limit for this email. Try again tomorrow.'
      : expired
        ? 'Verification expired. Verify the email again to save.'
        // The routine "verify first" message lives beside Save
        // (EnquirySaveStatus); only exceptions are shown here.
        : null

  return (
    <>
      <div className={`ctrl-group${shownError ? ' has-error' : ''}`}>
        <input
          className="ctrl"
          type="email"
          placeholder="candidate@example.com"
          maxLength={EMAIL_MAX}
          // .ctrl-group > .ctrl pads 8px 10px; match a plain .ctrl's 5px so
          // this sits level with the Phone / Date of Birth fields beside it.
          // Locked once verified: the token is bound to this exact address.
          // It unlocks only when the token expires (re-verify needed anyway)
          // or the page resets the form after a save.
          style={{ padding: 5, ...(isVerified ? { background: 'var(--surface)', color: 'var(--g700)', cursor: 'default' } : {}) }}
          readOnly={isVerified}
          value={email}
          onChange={e => { if (!isVerified) handleChange(e.target.value) }}
          onKeyDown={e => { if (e.key === 'Enter' && !isVerified && !limited) { e.preventDefault(); openVerify() } }}
          aria-invalid={!!shownError}
          aria-describedby="enquiry-email-status"
        />
        {isVerified ? (
          <span className="ctrl-addon" style={{ color: 'var(--green)', gap: 5, padding: '0 10px', lineHeight: 1 }}>
            <i className="lni lni-checkmark-circle" aria-hidden="true"></i> Verified
          </span>
        ) : (
          <button
            type="button"
            className="ctrl-addon"
            style={{ border: 'none', borderLeft: '1.5px solid var(--g200)', padding: '0 10px', lineHeight: 1, color: limited ? 'var(--g400)' : 'var(--b700)', cursor: limited ? 'not-allowed' : 'pointer', gap: 5, font: 'inherit', fontSize: 13, fontWeight: 600 }}
            disabled={limited || !email.trim()}
            onClick={openVerify}
          >
            <i className="lni lni-envelope" aria-hidden="true"></i> Verify
          </button>
        )}
      </div>
      <div id="enquiry-email-status" aria-live="polite">
        {shownError
          ? <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{shownError}</p>
          : hint && <p style={{ color: limited || expired ? 'var(--amber)' : 'var(--g500)', fontSize: 12, marginTop: 4 }}>{hint}</p>}
      </div>

      <EnquiryEmailVerifyModal
        isOpen={verifyOpen}
        email={email.trim()}
        studentName={studentName}
        onClose={() => setVerifyOpen(false)}
        onVerified={v => { setExpired(false); onVerifiedChange(v); onClearError?.(); setVerifyOpen(false) }}
        onLimitReached={e => setLimitedEmails(prev => new Set(prev).add(norm(e)))}
      />
    </>
  )
}
