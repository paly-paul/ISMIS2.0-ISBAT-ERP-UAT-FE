'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import { staffLogin, AuthError } from '@/lib/auth'
import { setFlowState, setSessionIdentity } from '@/lib/session'
import { authErrorMessage } from '@/lib/errorMessages'
import SuccessScreen from '@/components/SuccessScreen'

const LAST_USER = {
  initials: 'RM',
  name: 'Rebecca Muwanguzi',
  role: 'Asst. Registrar',
  started: '14:02',
  expired: '14:32',
  staffId: 'ARA-2026-0108',
}

export default function SessionExpiredPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successState, setSuccessState] = useState<{ displayName?: string; redirect: string } | null>(null)

  async function handleResume(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setError(null)
    setLoading(true)

    try {
      const result = await staffLogin(LAST_USER.staffId, password, false)
      if (result.requiresOtp) {
        setFlowState({
          challengeId: result.challengeId,
          otpChannel: result.otpChannel,
          maskedTarget: result.maskedTarget,
        })
        router.push('/login/otp')
      } else {
        if (result.displayName) setSessionIdentity({ displayName: result.displayName })
        setSuccessState({ displayName: result.displayName ?? LAST_USER.name, redirect: result.redirect })
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setError(authErrorMessage(err.code))
      } else {
        setError(authErrorMessage('unknown'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (successState) {
    return (
      <PanelA eyebrow="Session" headline="Signed in." centered>
        <SuccessScreen
          subtitle={`Welcome back, ${successState.displayName}.`}
          redirectTo={successState.redirect}
        />
      </PanelA>
    )
  }

  return (
    <PanelA eyebrow="Session" headline="Your session has expired.">
      <div style={{
        padding: 18, background: '#FFF6EA', border: '1px solid #F3DDB7',
        borderRadius: 10, fontSize: 13, color: '#7A4B11', marginBottom: 22,
        display: 'flex', gap: 12,
      }}>
        <Icon name="clock" size={20} color="#B87914" />
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Signed out for inactivity</div>
          You were inactive for 30 minutes. For the security of student and university records,
          we automatically signed you out.
        </div>
      </div>

      <div style={{
        padding: 14, background: 'var(--isb-paper-2)', border: '1px solid var(--isb-line-2)',
        borderRadius: 8, marginBottom: 18,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'var(--isb-muted)', marginBottom: 10,
        }}>
          Last active session
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, alignItems: 'center' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 99,
            background: 'var(--isb-blue)', color: '#fff',
            display: 'grid', placeContent: 'center',
            fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 13,
            flexShrink: 0,
          }}>
            {LAST_USER.initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{LAST_USER.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--isb-muted)' }}>
              {LAST_USER.role} · Started {LAST_USER.started} · Expired {LAST_USER.expired}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="isb-error-banner">
          <Icon name="alert" size={16} color="var(--isb-red)" />
          {error}
        </div>
      )}

      <form onSubmit={handleResume}>
        <div className="isb-field">
          <label className="isb-label" htmlFor="exp-pw">
            Continue as {LAST_USER.name.split(' ')[0]} — enter your password
          </label>
          <div className="isb-pw-wrap">
            <input
              id="exp-pw"
              className="isb-input"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{ paddingRight: 62 }}
              autoComplete="current-password"
              autoFocus
            />
            <button type="button" className="toggle" onClick={() => setShow(s => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="isb-btn primary full"
          disabled={loading || !password}
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
                Resuming…
              </>
            : <>Resume session <Icon name="arrow" size={15} color="#fff" /></>
          }
        </button>
      </form>

      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <button
          type="button"
          className="isb-btn link"
          onClick={() => router.push('/login')}
          style={{ fontSize: 12.5 }}
        >
          Sign in as someone else
        </button>
      </div>
    </PanelA>
  )
}
