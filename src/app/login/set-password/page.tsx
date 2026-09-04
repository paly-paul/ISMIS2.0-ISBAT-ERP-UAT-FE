'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PanelA from '@/components/PanelA'
import Icon from '@/components/Icon'
import StrengthBar, { computeStrength } from '@/components/StrengthBar'
import { validatePassword } from '@/lib/errorMessages'

export default function SetPasswordPage() {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [employeeIdError, setEmployeeIdError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  const strength = computeStrength(password)
  const disabled = !employeeId.trim() || !password || !confirmPassword

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const idErr = employeeId.trim() ? null : 'Employee ID is required.'
    const pwErr = validatePassword(password)
    const confirmErr = !confirmPassword
      ? 'Please confirm your password.'
      : confirmPassword !== password
        ? 'Passwords do not match.'
        : null

    setEmployeeIdError(idErr)
    setPasswordError(pwErr)
    setConfirmPasswordError(confirmErr)
    if (idErr || pwErr || confirmErr) return

    // This is still a UI-only shell until the password endpoint is available.
    router.push('/login')
  }

  return (
    <PanelA eyebrow="Verify & set password" headline="Verify your identity, set a password.">
      <p style={{ color: 'var(--isb-muted)', fontSize: 14, margin: '0 0 24px', lineHeight: 1.55 }}>
        Enter your Employee ID and choose a new password to set up sign-in for the ERP.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="isb-field">
          <label className="isb-label" htmlFor="employee-id">Employee ID</label>
          <input
            id="employee-id"
            className="isb-input"
            value={employeeId}
            onChange={e => { setEmployeeId(e.target.value); setEmployeeIdError(null) }}
            placeholder="e.g. AD/00121"
            autoComplete="username"
            autoFocus
          />
          {employeeIdError && <div className="err">{employeeIdError}</div>}
        </div>

        <div className="isb-field">
          <label className="isb-label" htmlFor="set-password">Password</label>
          <div className="isb-pw-wrap">
            <input
              id="set-password"
              className="isb-input"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError(null) }}
              placeholder="At least 10 characters"
              style={{ paddingRight: 62 }}
              autoComplete="new-password"
            />
            <button type="button" className="toggle" onClick={() => setShowPw(s => !s)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          {password && <StrengthBar level={strength} />}
          {passwordError && <div className="err">{passwordError}</div>}
        </div>

        <div className="isb-field">
          <label className="isb-label" htmlFor="confirm-password">Confirm Password</label>
          <div className="isb-pw-wrap">
            <input
              id="confirm-password"
              className="isb-input"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setConfirmPasswordError(null) }}
              placeholder="Repeat your password"
              style={{ paddingRight: 62 }}
              autoComplete="new-password"
            />
            <button type="button" className="toggle" onClick={() => setShowConfirm(s => !s)}>
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {confirmPasswordError && <div className="err">{confirmPasswordError}</div>}
        </div>

        <button
          type="submit"
          className="isb-btn primary full"
          style={{ marginTop: 4 }}
          disabled={disabled}
        >
          Verify &amp; Set Password <Icon name="arrow" size={15} color="#fff" />
        </button>
      </form>

      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13.5, color: 'var(--isb-muted)' }}>
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="isb-btn link"
          style={{ fontSize: 13.5 }}
        >
          Login
        </button>
      </div>
    </PanelA>
  )
}
