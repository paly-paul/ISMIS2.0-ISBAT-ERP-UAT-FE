'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import Stepper from '@/components/Stepper'
import OtpInput from '@/components/OtpInput'
import StrengthBar, { computeStrength } from '@/components/StrengthBar'
import MethodPill from '@/components/MethodPill'
import { forgotStart, forgotVerify, forgotReset, AuthError } from '@/lib/auth'
import { getFlowState, setFlowState } from '@/lib/session'
import { authErrorMessage, validateStaffId, validatePassword } from '@/lib/errorMessages'

const RESEND_COOLDOWN = 30
const STEPS = ['Identify', 'Verify', 'New password']

export default function ForgotPage() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [staffId, setStaffId] = useState('')
  const [channel, setChannel] = useState<'email' | 'sms'>('email')
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [secondsLeft])

  const strength = computeStrength(newPw)
  const pwError = newPw ? validatePassword(newPw) : null
  const matchError = confirmPw && newPw !== confirmPw ? 'Passwords do not match.' : null

  // Step 1: identify the account
  async function handleIdentify(e: React.FormEvent) {
    e.preventDefault()
    const idErr = validateStaffId(staffId)
    if (idErr) { setError(idErr); return }
    setError(null)
    setLoading(true)
    try {
      const result = await forgotStart(staffId, channel)
      setFlowState({ forgotChallengeId: result.challengeId })
      setSecondsCooldown()
      setStep(1)
    } catch (err) {
      setError(err instanceof AuthError ? authErrorMessage(err.code) : authErrorMessage('unknown'))
    } finally {
      setLoading(false)
    }
  }

  function setSecondsCooldown() { setSecondsLeft(RESEND_COOLDOWN) }

  // Step 2: verify the OTP
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const challengeId = getFlowState().forgotChallengeId
    if (!challengeId) return
    setError(null)
    setLoading(true)
    try {
      const result = await forgotVerify(challengeId, digits.join(''))
      setFlowState({ forgotResetToken: result.resetToken })
      setStep(2)
    } catch (err) {
      setError(err instanceof AuthError ? authErrorMessage(err.code) : authErrorMessage('unknown'))
      setDigits(['', '', '', '', '', ''])
    } finally {
      setLoading(false)
    }
  }

  // Step 3: set a new password
  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (pwError || matchError) return
    const resetToken = getFlowState().forgotResetToken
    if (!resetToken) return
    setError(null)
    setLoading(true)
    try {
      await forgotReset(resetToken, newPw)
      router.push('/login/staff?reset=1')
    } catch (err) {
      setError(err instanceof AuthError ? authErrorMessage(err.code) : authErrorMessage('unknown'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (secondsLeft > 0) return
    setError(null)
    setLoading(true)
    try {
      const result = await forgotStart(staffId, channel)
      setFlowState({ forgotChallengeId: result.challengeId })
      setSecondsCooldown()
      setDigits(['', '', '', '', '', ''])
    } catch (err) {
      setError(err instanceof AuthError ? authErrorMessage(err.code) : authErrorMessage('unknown'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PanelA eyebrow="Reset password" headline="We'll get you back in.">
      <div style={{ marginBottom: 22 }}>
        <Stepper steps={STEPS} current={step} />
      </div>

      {error && (
        <div className="isb-error-banner">
          <Icon name="alert" size={16} color="var(--isb-red)" />
          {error}
        </div>
      )}

      {step === 0 && (
        <form onSubmit={handleIdentify}>
          <p style={{ color: 'var(--isb-muted)', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.55 }}>
            Enter your Staff ID to receive a one-time code.
            We'll send it to the contact on file.
          </p>

          <div className="isb-field">
            <label className="isb-label" htmlFor="forgot-id">Staff ID</label>
            <input
              id="forgot-id"
              className="isb-input"
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              placeholder="e.g. AR-2019-0042"
              autoFocus
            />
          </div>

          <div className="isb-field">
            <label className="isb-label">Send code via</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <MethodPill
                icon="mail"
                label="Email"
                sub="m******@isbat.ac.ug"
                active={channel === 'email'}
                onClick={() => setChannel('email')}
              />
              <MethodPill
                icon="phone"
                label="SMS"
                sub="+256 ***** 4821"
                active={channel === 'sms'}
                onClick={() => setChannel('sms')}
              />
            </div>
          </div>

          <button type="submit" className="isb-btn primary full" disabled={loading || !staffId.trim()}>
            {loading ? 'Sending…' : <>Send code <Icon name="arrow" size={15} color="#fff" /></>}
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handleVerify}>
          <p style={{ color: 'var(--isb-muted)', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.55 }}>
            We sent a 6-digit code to{' '}
            {channel === 'email' ? 'm******@isbat.ac.ug' : '+256 ***** 4821'}.
            {' '}It expires in 10 minutes.
          </p>

          <OtpInput value={digits} onChange={setDigits} />

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            margin: '18px 0 22px', fontSize: 12, color: 'var(--isb-muted)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={12} />
              {secondsLeft > 0
                ? <>Resend available in <span className="nums">{secondsLeft}s</span></>
                : 'Code sent'
              }
            </span>
            <button
              type="button"
              className="isb-btn link"
              style={{ fontSize: 12 }}
              onClick={handleResend}
              disabled={secondsLeft > 0 || loading}
            >
              Resend code
            </button>
          </div>

          <button
            type="submit"
            className="isb-btn primary full"
            disabled={loading || digits.join('').length < 6}
          >
            {loading ? 'Verifying…' : <>Verify <Icon name="arrow" size={15} color="#fff" /></>}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleReset}>
          <p style={{ color: 'var(--isb-muted)', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.55 }}>
            Create a new password. Must be at least 10 characters with a number and a symbol.
          </p>

          <div className="isb-field">
            <label className="isb-label" htmlFor="new-pw">New password</label>
            <div className="isb-pw-wrap">
              <input
                id="new-pw"
                className="isb-input"
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 10 characters"
                style={{ paddingRight: 62 }}
                autoComplete="new-password"
                autoFocus
              />
              <button type="button" className="toggle" onClick={() => setShowNew(s => !s)}>
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            {newPw && <StrengthBar level={strength} />}
            {pwError && <div className="err">{pwError}</div>}
          </div>

          <div className="isb-field">
            <label className="isb-label" htmlFor="confirm-pw">Confirm new password</label>
            <div className="isb-pw-wrap">
              <input
                id="confirm-pw"
                className="isb-input"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat your password"
                style={{ paddingRight: 62 }}
                autoComplete="new-password"
              />
              <button type="button" className="toggle" onClick={() => setShowConfirm(s => !s)}>
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
            {matchError && <div className="err">{matchError}</div>}
          </div>

          <button
            type="submit"
            className="isb-btn primary full"
            disabled={loading || !!pwError || !!matchError || !newPw || !confirmPw}
          >
            {loading ? 'Updating…' : <>Update password <Icon name="check" size={15} color="#fff" /></>}
          </button>
        </form>
      )}

      <div style={{ marginTop: 22, textAlign: 'center' }}>
        <button
          type="button"
          className="isb-btn link"
          onClick={() => router.push('/login/staff')}
          style={{ fontSize: 12.5 }}
        >
          <Icon name="back" size={12} /> Back to sign in
        </button>
      </div>
    </PanelA>
  )
}
