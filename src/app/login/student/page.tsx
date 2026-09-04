'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import { studentLogin, AuthError, MOCK_CREDENTIALS } from '@/lib/auth'
import { setFlowState, setSessionIdentity } from '@/lib/session'
import { authErrorMessage, validateStudentId, validatePassword } from '@/lib/errorMessages'
import SuccessScreen from '@/components/SuccessScreen'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export default function StudentLoginPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [idError, setIdError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [successState, setSuccessState] = useState<{ displayName?: string; redirect: string } | null>(null)

  const disabled = loading || !studentId.trim() || !password

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const idErr = validateStudentId(studentId)
    if (idErr) { setIdError(idErr); return }
    const pwErr = validatePassword(password)
    if (pwErr) { setPasswordError(pwErr); return }
    setIdError(null)
    setPasswordError(null)
    setLoading(true)

    try {
      const result = await studentLogin(studentId, password)
      if (result.requiresOtp) {
        setFlowState({
          challengeId: result.challengeId,
          otpChannel: result.otpChannel,
          maskedTarget: result.maskedTarget,
          returnTo: '/login/student',
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
      <PanelA eyebrow="Students" headline="Signed in." centered>
        <SuccessScreen
          subtitle={successState.redirect
            ? (successState.displayName ? `Welcome back, ${successState.displayName}.` : 'Welcome back.')
            : 'The Student Portal is still being built. Check back soon.'}
          redirectTo={successState.redirect || undefined}
        />
      </PanelA>
    )
  }

  return (
    <PanelA eyebrow="Students" headline="Student Portal sign-in.">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 12 }}>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="isb-btn link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Icon name="back" size={13} /> All portals
        </button>
        <span style={{ color: 'var(--isb-line)' }}>·</span>
        <span className="isb-chip" style={{ background: '#E4F4EB', color: '#1D6B3E' }}>
          /frmStudentLogin.aspx
        </span>
      </div>

      {/* {MOCK_AUTH && (
        <div className="isb-error-banner" style={{ background: 'var(--isb-paper-2)', borderColor: 'var(--isb-line-2)', color: 'var(--isb-muted)', marginBottom: 16 }}>
          <Icon name="shield" size={16} color="var(--isb-muted)" />
          <span>
            Mock mode &mdash; ID: <b style={{ color: 'var(--isb-ink)', fontFamily: 'monospace' }}>{MOCK_CREDENTIALS.student.id}</b>
            {' '}· Password: <b style={{ color: 'var(--isb-ink)', fontFamily: 'monospace' }}>{MOCK_CREDENTIALS.student.password}</b>
          </span>
        </div>
      )} */}

      <form onSubmit={handleSubmit}>
        <div className="isb-field">
          <label className="isb-label" htmlFor="student-id">Student ID</label>
          <input
            id="student-id"
            className="isb-input"
            value={studentId}
            onChange={e => { setStudentId(e.target.value); setIdError(null) }}
            placeholder="ISB/YYYY/PROG/NNNN"
            autoComplete="username"
            autoFocus
          />
          {idError
            ? <div className="err">{idError}</div>
            : <div className="hint">Printed on your admission letter and ID card.</div>
          }
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
              placeholder="Enter your password"
              style={{ paddingRight: 62 }}
              autoComplete="current-password"
            />
            <button type="button" className="toggle" onClick={() => setShow(s => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {passwordError && <div className="err">{passwordError}</div>}
        </div>

        <button
          type="submit"
          className="isb-btn primary full"
          disabled
          style={{ background: '#2EA862', boxShadow: '0 2px 4px rgba(46,168,98,.25)', marginTop: 12 }}
        >
          <>Continue <Icon name="arrow" size={15} color="#fff" /></>
        </button>

        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--isb-muted)', textAlign: 'center' }}>
          First time signing in?{' '}
          <a href="/login/activate" className="isb-link">Activate your student account</a>
        </div>
      </form>

      <div style={{
        marginTop: 28, padding: 14,
        background: 'var(--isb-paper-2)', border: '1px solid var(--isb-line-2)',
        borderRadius: 8, fontSize: 11.5, color: 'var(--isb-muted)',
      }}>
        Having trouble? Email{' '}
        <a href="mailto:studentsupport@isbatuniversity.ac.ug" className="isb-link">
          studentsupport@isbatuniversity.ac.ug
        </a>
        {' '}or call <span className="nums">+256 414 532 500</span>.
      </div>
    </PanelA>
  )
}
