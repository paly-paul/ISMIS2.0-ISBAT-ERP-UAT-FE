'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import { staffLogin, AuthError, MOCK_CREDENTIALS } from '@/lib/auth'
import { setFlowState, setSessionIdentity } from '@/lib/session'
import { authErrorMessage, validateStaffId, validatePassword } from '@/lib/errorMessages'
import SuccessScreen from '@/components/SuccessScreen'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export default function StaffLoginPage() {
  const router = useRouter()
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const [trust, setTrust] = useState(true)
  const [loading, setLoading] = useState(false)
  const [idError, setIdError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [successState, setSuccessState] = useState<{ displayName?: string; redirect: string } | null>(null)

  const disabled = loading || !staffId.trim() || !password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // const idErr = validateStaffId(staffId)
    // if (idErr) { setIdError(idErr); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setPasswordError(pwErr); return }
    setIdError(null)
    setPasswordError(null)
    setLoading(true)

    try {
      const result = await staffLogin(staffId, password, trust)
      if (result.requiresOtp) {
        setFlowState({
          challengeId: result.challengeId,
          otpChannel: result.otpChannel,
          maskedTarget: result.maskedTarget,
          returnTo: '/login/staff',
        })
        router.push('/login/otp')
      } else {
        if (result.displayName) setSessionIdentity({ displayName: result.displayName })
        setSuccessState({ displayName: result.displayName, redirect: result.redirect })
      }
    } catch (err) {
      setPasswordError(err instanceof AuthError ? authErrorMessage(err.code) : authErrorMessage('unknown'))
    } finally {
      setLoading(false)
    }
  }

  if (successState) {
    return (
      <PanelA eyebrow="Staff & Faculty" headline="Signed in." centered>
        <SuccessScreen
          subtitle={successState.displayName ? `Welcome back, ${successState.displayName}.` : 'Welcome back.'}
          redirectTo={successState.redirect}
        />
      </PanelA>
    )
  }

  return (
    <PanelA eyebrow="Staff & Faculty" headline="Sign in to ERP.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 12 }}>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="isb-btn link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Icon name="back" size={13} /> All portals
        </button>
      </div>

      {/* {MOCK_AUTH && (
        <div className="isb-error-banner" style={{ background: 'var(--isb-paper-2)', borderColor: 'var(--isb-line-2)', color: 'var(--isb-muted)', marginBottom: 16 }}>
          <Icon name="shield" size={16} color="var(--isb-muted)" />
          <span>
            Mock mode &mdash; ID: <b style={{ color: 'var(--isb-ink)', fontFamily: 'monospace' }}>{MOCK_CREDENTIALS.staff.id}</b>
            {' '}· Password: <b style={{ color: 'var(--isb-ink)', fontFamily: 'monospace' }}>{MOCK_CREDENTIALS.staff.password}</b>
          </span>
        </div>
      )} */}

      <form onSubmit={handleSubmit}>
        <div className="isb-field">
          <label className="isb-label" htmlFor="staff-id">Staff ID</label>
          <input
            id="staff-id"
            className="isb-input"
            value={staffId}
            onChange={e => { setStaffId(e.target.value); setIdError(null) }}
            placeholder="e.g. AR-2019-0042"
            autoComplete="username"
            autoFocus
          />
          {idError && <div className="err">{idError}</div>}
        </div>

        <div className="isb-field">
          <label
            className="isb-label"
            htmlFor="password"
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <span>Password</span>
            <button
              type="button"
              onClick={() => router.push('/login/forgot')}
              className="isb-btn link"
              style={{ fontSize: 11 }}
            >
              Forgot password?
            </button>
          </label>
          <div className="isb-pw-wrap">
            <input
              id="password"
              className="isb-input"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError(null) }}
              onKeyUp={e => setCaps(e.getModifierState('CapsLock'))}
              style={{ paddingRight: 62 }}
              autoComplete="current-password"
            />
            <button type="button" className="toggle" onClick={() => setShow(s => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {passwordError && <div className="err">{passwordError}</div>}
          {caps && (
            <div className="err">
              <Icon name="caps" size={12} color="var(--isb-red)" /> Caps Lock is on
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 22px' }}>
          <label className="isb-check">
            <input
              type="checkbox"
              checked={trust}
              onChange={e => setTrust(e.target.checked)}
            />
            Trust this device for 30 days
          </label>
        </div>

        <button
          type="submit"
          className="isb-btn primary full"
          disabled={disabled}
        >
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
                Verifying credentials…
              </>
            : <>Continue <Icon name="arrow" size={15} color="#fff" /></>
          }
        </button>

        <div className="isb-divider">Single sign-on</div>

        <button type="button" className="isb-btn ghost full">
          <svg width="14" height="14" viewBox="0 0 23 23">
            <path fill="#F25022" d="M1 1h10v10H1z"/>
            <path fill="#7FBA00" d="M12 1h10v10H12z"/>
            <path fill="#00A4EF" d="M1 12h10v10H1z"/>
            <path fill="#FFB900" d="M12 12h10v10H12z"/>
          </svg>
          Continue with ISBAT Microsoft 365
        </button>
      </form>

      <div style={{
        marginTop: 28, padding: 14,
        background: 'var(--isb-paper-2)', border: '1px solid var(--isb-line-2)',
        borderRadius: 8, fontSize: 11.5, color: 'var(--isb-muted)', lineHeight: 1.55,
      }}>
        By signing in you consent to ISBAT's processing of your data for ERP operations.
        See our{' '}
        <a href="#" className="isb-link">Data Processing Consent</a>
        {' '}and{' '}
        <a href="#" className="isb-link">Privacy Policy</a>.
      </div>
    </PanelA>
  )
}
