'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import OtpInput from '@/components/OtpInput'
import { otpVerify, forgotStart, AuthError, MOCK_CREDENTIALS } from '@/lib/auth'
import { getFlowState, setFlowState, clearFlowState, setSessionIdentity } from '@/lib/session'
import { authErrorMessage } from '@/lib/errorMessages'
import SuccessScreen from '@/components/SuccessScreen'

const RESEND_COOLDOWN = 30
const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export default function OtpPage() {
  const router = useRouter()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successState, setSuccessState] = useState<{ role: string; redirect: string } | null>(null)
  const [flowState, setLocalFlowState] = useState<ReturnType<typeof getFlowState>>({})
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const state = getFlowState()
    if (!state.challengeId) {
      router.replace('/login/staff')
      return
    }
    setLocalFlowState(state)
  }, [router])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [secondsLeft])

  const code = digits.join('')
  const disabled = loading || code.length < 6

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!flowState.challengeId) return
    setError(null)
    setLoading(true)

    try {
      const result = await otpVerify(flowState.challengeId, code)
      setSessionIdentity({ displayName: result.displayName })
      clearFlowState()
      setSuccessState({ role: result.role, redirect: result.redirect })
    } catch (err) {
      if (err instanceof AuthError) {
        setError(authErrorMessage(err.code))
      } else {
        setError(authErrorMessage('unknown'))
      }
      setDigits(['', '', '', '', '', ''])
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!flowState.challengeId || secondsLeft > 0) return
    setResending(true)
    setError(null)
    // Resend is still a placeholder for now.
    setSecondsLeft(RESEND_COOLDOWN)
    setDigits(['', '', '', '', '', ''])
    setResending(false)
  }

  const maskedTarget = flowState.maskedTarget ?? (flowState.otpChannel === 'sms' ? '+256 ***** ****' : '***@isbat.ac.ug')

  if (successState) {
    const isStudent = successState.role === 'student'
    return (
      <PanelA eyebrow="Two-factor authentication" headline="Identity verified." centered>
        <SuccessScreen
          subtitle={isStudent
            ? 'The Student Portal is still being built. Check back soon.'
            : 'Welcome back to ISBAT ERP.'}
          redirectTo={isStudent ? undefined : (successState.redirect || '/academic')}
        />
      </PanelA>
    )
  }

  return (
    <PanelA eyebrow="Two-factor authentication" headline="Verify it's you.">
      <p style={{ color: 'var(--isb-muted)', fontSize: 13.5, margin: '0 0 24px', lineHeight: 1.55 }}>
        We've sent a 6-digit code to{' '}
        <b style={{ color: 'var(--isb-ink)' }}>{maskedTarget}</b>.
        Enter it below to continue.
      </p>

      {/* {MOCK_AUTH && (
        <div className="isb-error-banner" style={{ background: 'var(--isb-paper-2)', borderColor: 'var(--isb-line-2)', color: 'var(--isb-muted)' }}>
          <Icon name="shield" size={16} color="var(--isb-muted)" />
          Mock mode &mdash; use code{' '}
          <b style={{ color: 'var(--isb-ink)', fontFamily: 'monospace' }}>{MOCK_CREDENTIALS.otp}</b>
          {' '}to continue.
        </div>
      )} */}

      {error && (
        <div className="isb-error-banner">
          <Icon name="alert" size={16} color="var(--isb-red)" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <OtpInput value={digits} onChange={setDigits} />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          margin: '22px 0', fontSize: 12, color: 'var(--isb-muted)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={12} />
            Code expires in{' '}
            <span className="nums" style={{ color: 'var(--isb-ink)', fontWeight: 500 }}>
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
            </span>
          </span>
          <button
            type="button"
            className="isb-btn link"
            style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={handleResend}
            disabled={secondsLeft > 0 || resending}
          >
            <Icon name="refresh" size={12} />
            {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend'}
          </button>
        </div>

        <button type="submit" className="isb-btn primary full" disabled={disabled}>
          {loading
            ? <>
                <span
                  className="spin"
                  style={{
                    width: 14, height: 14,
                    border: '2px solid rgba(255,255,255,.4)',
                    borderTopColor: '#fff', borderRadius: 99,
                  }}
                />
                Verifying…
              </>
            : <>Verify and continue <Icon name="arrow" size={15} color="#fff" /></>
          }
        </button>
      </form>

      <div style={{ marginTop: 18, fontSize: 12, color: 'var(--isb-muted)', textAlign: 'center' }}>
        Can't access your {flowState.otpChannel === 'sms' ? 'phone' : 'email'}?{' '}
        <a href="mailto:itsupport@isbatuniversity.ac.ug" className="isb-link">
          Contact IT support
        </a>
      </div>

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button
          type="button"
          className="isb-btn link"
          onClick={() => router.push(flowState.returnTo ?? '/login/staff')}
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={12} /> Use a different account
        </button>
      </div>
    </PanelA>
  )
}
