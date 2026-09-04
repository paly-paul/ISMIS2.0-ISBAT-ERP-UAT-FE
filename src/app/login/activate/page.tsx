'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import Stepper from '@/components/Stepper'
import StrengthBar, { computeStrength } from '@/components/StrengthBar'
import MethodPill from '@/components/MethodPill'
import { activateConfirm, activateSetup, type ActivateProfile, AuthError } from '@/lib/auth'
import { authErrorMessage, validatePassword } from '@/lib/errorMessages'

const STEPS = ['Confirm details', 'Set password', 'Two-factor']

function CheckItem({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: ok ? 'var(--isb-green)' : 'var(--isb-muted)' }}>
      <div style={{
        width: 14, height: 14, borderRadius: 99, display: 'grid', placeContent: 'center',
        background: ok ? 'var(--isb-green)' : 'transparent',
        border: ok ? 'none' : '1.5px solid var(--isb-line)',
        flexShrink: 0,
      }}>
        {ok && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l4 4L19 6"/>
          </svg>
        )}
      </div>
      <span style={{ fontSize: 11.5 }}>{children}</span>
    </div>
  )
}

function DetailRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '130px 1fr',
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--isb-line-2)',
      fontSize: 13,
    }}>
      <div style={{ color: 'var(--isb-muted)', fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        color: 'var(--isb-ink)', fontWeight: 500,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        fontSize: mono ? 12.5 : 13.5,
      }}> 
        {value}
      </div>
    </div>
  )
}

function ActivatePage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<ActivateProfile | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [otpChannel, setOtpChannel] = useState<'email' | 'sms'>('email')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }

    activateConfirm(token)
      .then(setProfile)
      .catch(err => {
        setError(err instanceof AuthError ? authErrorMessage(err.code) : 'Invalid or expired activation link. Please contact IT support.')
      })
  }, [token, router])

  const strength = computeStrength(password)
  const pwError = password ? validatePassword(password) : null
  const matchError = confirmPw && password !== confirmPw ? 'Passwords do not match.' : null

  async function handleSetup() {
    if (!consent) { setError('You must consent to data processing to complete setup.'); return }
    setError(null)
    setLoading(true)
    try {
      const result = await activateSetup(token, password, otpChannel, consent)
      window.location.href = result.redirect || '/academic'
    } catch (err) {
      setError(err instanceof AuthError ? authErrorMessage(err.code) : authErrorMessage('unknown'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <PanelA eyebrow="Welcome, first-time sign-in" headline="Secure your account.">
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
        <>
          <div style={{
            padding: 14, background: 'var(--isb-blue-050)', border: '1px solid #D8E4FC',
            borderRadius: 8, fontSize: 12.5, color: 'var(--isb-blue-700)',
            marginBottom: 18, display: 'flex', gap: 10,
          }}>
            <Icon name="sparkle" size={16} color="var(--isb-blue)" />
            <div>
              Your account was created by HR/IT.
              Please confirm your details and set up your password.
            </div>
          </div>

          {profile ? (
            <>
              <DetailRow label="Full name" value={profile.fullName} />
              <DetailRow label="Role" value={profile.role} />
              <DetailRow label="Staff ID" value={profile.staffId} mono />
              <DetailRow label="Email on file" value={profile.email} />
              <DetailRow label="Department" value={profile.department} last />
            </>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--isb-muted)', fontSize: 13 }}>
              Loading your details…
            </div>
          )}

          <button
            className="isb-btn primary full"
            style={{ marginTop: 18 }}
            onClick={() => setStep(1)}
            disabled={!profile || loading}
          >
            These details are correct <Icon name="arrow" size={15} color="#fff" />
          </button>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--isb-muted)', textAlign: 'center' }}>
            Something wrong?{' '}
            <a href="mailto:itsupport@isbatuniversity.ac.ug" className="isb-link">Contact IT</a>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <p style={{ color: 'var(--isb-muted)', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.55 }}>
            Choose a strong password. At least 10 characters, 1 number and 1 symbol.
          </p>

          <div className="isb-field">
            <label className="isb-label" htmlFor="act-pw">New password</label>
            <div className="isb-pw-wrap">
              <input
                id="act-pw"
                className="isb-input"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 10 characters"
                style={{ paddingRight: 62 }}
                autoComplete="new-password"
                autoFocus
              />
              <button type="button" className="toggle" onClick={() => setShowPw(s => !s)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {password && <StrengthBar level={strength} />}
          </div>

          <div className="isb-field">
            <label className="isb-label" htmlFor="act-confirm">Confirm password</label>
            <div className="isb-pw-wrap">
              <input
                id="act-confirm"
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

          <div style={{
            padding: 10, fontSize: 11.5, color: 'var(--isb-muted)',
            background: 'var(--isb-paper-2)', border: '1px solid var(--isb-line-2)',
            borderRadius: 6, display: 'grid', gap: 4,
          }}>
            <CheckItem ok={password.length >= 10}>At least 10 characters</CheckItem>
            <CheckItem ok={/\d/.test(password)}>Contains a number</CheckItem>
            <CheckItem ok={/[^a-zA-Z0-9]/.test(password)}>Contains a symbol (! @ # $ %)</CheckItem>
          </div>

          <button
            className="isb-btn primary full"
            style={{ marginTop: 14 }}
            onClick={() => setStep(2)}
            disabled={!!pwError || !!matchError || !password || !confirmPw}
          >
            Continue <Icon name="arrow" size={15} color="#fff" />
          </button>
        </>
      )}

      {step === 2 && profile && (
        <>
          <p style={{ color: 'var(--isb-muted)', fontSize: 13.5, margin: '0 0 18px', lineHeight: 1.55 }}>
            Choose where we send your sign-in verification codes.
          </p>

          <MethodPill
            icon="mail"
            label={profile.email}
            sub="Primary email"
            active={otpChannel === 'email'}
            onClick={() => setOtpChannel('email')}
          />
          <div style={{ height: 10 }} />
          <MethodPill
            icon="phone"
            label="Add SMS number"
            sub="Enter during sign-in"
            active={otpChannel === 'sms'}
            onClick={() => setOtpChannel('sms')}
          />

          <label className="isb-check" style={{ marginTop: 20 }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
            />
            I agree to the{' '}
            <a href="#" className="isb-link" style={{ marginLeft: 4 }}>
              Data Processing Consent
            </a>
          </label>

          <button
            className="isb-btn primary full"
            style={{ marginTop: 22 }}
            onClick={handleSetup}
            disabled={loading || !consent}
          >
            {loading ? 'Finishing setup…' : <>Finish setup <Icon name="check" size={15} color="#fff" /></>}
          </button>
        </>
      )}
    </PanelA>
  )
}

export default function ActivatePageWrapper() {
  return (
    <Suspense>
      <ActivatePage />
    </Suspense>
  )
}
