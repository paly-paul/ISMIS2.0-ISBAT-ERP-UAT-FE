'use client'
import { useEffect, useRef, useState } from 'react'
import OtpInput from '@/components/OtpInput'
import { useRequestEnquiryEmailOtp, useVerifyEnquiryEmailOtp } from '@/hooks/admission/useEnquiries'
import { AuthError } from '@/lib/api/client'

// Verifies a candidate's email with a 6-digit OTP BEFORE the enquiry is
// created (post-enquiry-email-otp-request.md / -verify.md). Sends the code as
// soon as it opens; on success hands the verificationToken back to the form,
// which must send it with POST /enquiries.
//
// Limits (server-enforced, see the 2026-10 enquiry handoff):
// - 5 sends per email per 24h, Send and Resend alike. too_many_requests is the
//   only source of truth — no client-side counter, since the limit survives
//   refreshes and other browsers.
// - No limit on wrong guesses per code, so the copy never mentions "tries".
// The 30s resend wait is a UI guard against double-sends burning that daily
// allowance, not an API rule.
const RESEND_WAIT_S = 30
const EMPTY = ['', '', '', '', '', '']
const LIMIT_MESSAGE = 'You have reached the OTP limit for this email. Try again tomorrow.'

export interface VerifiedEmail {
  email: string
  token: string
  // Epoch ms; the token is rejected by create after validityMinutes (30).
  expiresAt: number
}

interface Props {
  isOpen: boolean
  email: string
  studentName?: string
  onClose: () => void
  onVerified: (verified: VerifiedEmail) => void
  // The email has used its daily sends — the form disables Verify for it.
  onLimitReached: (email: string) => void
}

function errorCode(e: Error) {
  return e instanceof AuthError ? e.code : undefined
}

export function EnquiryEmailVerifyModal({ isOpen, email, studentName, onClose, onVerified, onLimitReached }: Props) {
  const requestOtp = useRequestEnquiryEmailOtp()
  const verifyOtp = useVerifyEnquiryEmailOtp()
  // Only ever held in memory; each (re)send replaces it.
  const [challenge, setChallenge] = useState<{ token: string; masked: string; expiryMinutes: number } | null>(null)
  const [digits, setDigits] = useState<string[]>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [limited, setLimited] = useState(false)
  const [wait, setWait] = useState(0)
  const sentFor = useRef<string | null>(null)

  function send() {
    setError(null)
    setDigits(EMPTY)
    requestOtp.mutate(email, {
      onSuccess: c => {
        setChallenge({ token: c.challengeToken, masked: c.maskedEmail || email, expiryMinutes: c.expiryMinutes || 10 })
        setWait(RESEND_WAIT_S)
      },
      onError: (e: Error) => {
        const code = errorCode(e)
        if (code === 'too_many_requests') {
          setLimited(true)
          setWait(0)
          setError(LIMIT_MESSAGE)
          onLimitReached(email)
        } else if (code === 'validation_error') {
          setError('Enter a valid email.')
        } else {
          setError(e.message || 'Couldn’t send the code. Please try again.')
        }
      },
    })
  }

  // Send once per email each time the modal opens.
  useEffect(() => {
    if (!isOpen) { sentFor.current = null; return }
    if (!email || sentFor.current === email) return
    sentFor.current = email
    setChallenge(null); setLimited(false)
    send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, email])

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait(w => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  if (!isOpen) return null

  const code = digits.join('')

  function handleVerify() {
    if (!challenge || !/^\d{6}$/.test(code)) return
    setError(null)
    verifyOtp.mutate({ email, challengeToken: challenge.token, otp: code }, {
      onSuccess: v => {
        onVerified({ email, token: v.verificationToken, expiresAt: Date.now() + (v.validityMinutes || 30) * 60_000 })
      },
      onError: (e: Error) => {
        setDigits(EMPTY)
        setError(errorCode(e) === 'bad_request'
          ? 'Wrong or expired code. Check it and try again, or send a new code.'
          : e.message || 'Couldn’t verify the code. Please try again.')
      },
    })
  }

  const sending = requestOtp.isPending

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-envelope"></i> Verify Email</div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><i className="lni lni-close"></i></button>
        </div>

        <div className="eq-verify">
          <div className="eq-verify-icon"><i className="lni lni-envelope"></i></div>
          <div className="eq-verify-title">Confirm the candidate&apos;s email</div>
          <div className="eq-verify-sub" aria-live="polite">
            {sending && !challenge
              ? 'Sending a 6-digit code…'
              : challenge
                ? <>We sent a 6-digit code to <strong>{challenge.masked}</strong>. Ask {studentName || 'the candidate'} to read it out. It expires in {challenge.expiryMinutes} minutes.</>
                : <>We&apos;ll send a 6-digit code to <strong>{email}</strong>.</>}
          </div>

          <div className={`eq-otp${!challenge ? ' locked' : ''}`}>
            <OtpInput value={digits} onChange={d => { setDigits(d); if (error && !limited) setError(null) }} />
          </div>

          {error && <div className="eq-verify-error" role="alert"><i className="lni lni-warning"></i> {error}</div>}

          {!limited && (
            <div className="eq-verify-resend">
              Didn&apos;t get it?{' '}
              <button type="button" className="pm-link" style={{ marginLeft: 0 }} disabled={sending || wait > 0} onClick={send}>
                {sending ? 'Sending…' : wait > 0 ? `Resend in ${wait}s` : 'Send a new code'}
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!challenge || code.length !== 6 || verifyOtp.isPending || sending} onClick={handleVerify}>
            <i className="lni lni-checkmark-circle"></i> {verifyOtp.isPending ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </div>
    </div>
  )
}
