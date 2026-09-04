import { AuthError, post, apiPost, refreshAccessTokenWithRetry } from './api/client'

export { AuthError }

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export const MOCK_CREDENTIALS = {
  staff: { id: 'AR-2024-0001', password: 'Admin@1234',   challengeId: 'mock-staff-challenge'   },
  student: { id: 'ISB/2024/BSCS/0142', password: 'Student@1234', challengeId: 'mock-student-challenge' },
  otp: '123456',
} as const

// Staff login

export type StaffLoginResult =
  | { requiresOtp: true; challengeId: string; otpChannel: 'email' | 'sms'; maskedTarget: string }
  | { requiresOtp: false; displayName?: string; redirect: string }

export function staffLogin(staffId: string, password: string, trustDevice: boolean): Promise<StaffLoginResult> {
  if (MOCK_AUTH) {
    if (staffId !== MOCK_CREDENTIALS.staff.id || password !== MOCK_CREDENTIALS.staff.password)
      return Promise.reject(new AuthError('bad_credentials'))
    return Promise.resolve({
      requiresOtp: true,
      challengeId: MOCK_CREDENTIALS.staff.challengeId,
      otpChannel: 'email',
      maskedTarget: 'm***@isbat.ac.ug',
    })
  }
  // The API may return no body on success. We keep displayName optional.
  return apiPost<{ displayName: string } | null>('/api/v1/users/auth/login', {
    Username: staffId,
    Password: password,
  }).then(data => ({ requiresOtp: false, displayName: data?.displayName, redirect: '/academic' }))
}

// Student login

export type StudentLoginResult =
  | { requiresOtp: true; challengeId: string; otpChannel: 'email' | 'sms'; maskedTarget: string }
  | { requiresOtp: false; displayName?: string; redirect: string }

export function studentLogin(studentId: string, password: string): Promise<StudentLoginResult> {
  if (MOCK_AUTH) {
    if (studentId !== MOCK_CREDENTIALS.student.id || password !== MOCK_CREDENTIALS.student.password)
      return Promise.reject(new AuthError('bad_credentials'))
    return Promise.resolve({
      requiresOtp: true,
      challengeId: MOCK_CREDENTIALS.student.challengeId,
      otpChannel: 'email',
      maskedTarget: 's***@student.isbat.ac.ug',
    })
  }
  // The API may respond with no body on success.
  return apiPost<{ displayName: string } | null>('/api/v1/users/auth/login', {
    Username: studentId,
    Password: password,
  }).then(data => ({ requiresOtp: false, displayName: data?.displayName, redirect: '' }))
}

// Session refresh — relies on the httpOnly refresh-token cookie set at login;
// no body needed. Used to silently restore/validate a session (e.g. on layout mount).

export interface RefreshResult {
  displayName?: string
}

export function refreshSession(): Promise<RefreshResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({ displayName: 'Mock User' })
  }
  // Routed through refreshAccessTokenWithRetry() (not a direct apiPost call)
  // so every caller — the mount-time check AND the proactive keep-alive
  // interval in every module layout — shares both the in-flight dedup and
  // the retry-once-after-500ms tolerance for a racy rotation collision
  // (confirmed live: two /auth/refresh calls with the same still-valid
  // token race 200/401 against each other). Without the retry, a call here
  // that lost that race would be treated as a genuinely dead session and
  // log the user out — which is exactly what happened before this used the
  // retrying variant; see the note on refreshAccessTokenWithRetry in
  // client.ts.
  return refreshAccessTokenWithRetry()
}

// Logout — invalidates the httpOnly session cookie; no body needed.

export function logout(): Promise<boolean> {
  if (MOCK_AUTH) return Promise.resolve(true)
  return apiPost<boolean>('/api/v1/users/auth/logout', {})
}

// OTP verify

export interface OtpVerifyResult {
  sessionId: string
  role: string
  redirect: string
  displayName: string
}

export function otpVerify(challengeId: string, code: string) {
  if (MOCK_AUTH) {
    if (code !== MOCK_CREDENTIALS.otp)
      return Promise.reject(new AuthError('invalid_code'))
    const isStudent = challengeId === MOCK_CREDENTIALS.student.challengeId
    return Promise.resolve<OtpVerifyResult>({
      sessionId: 'mock-session-id',
      role: isStudent ? 'student' : 'staff',
      redirect: isStudent ? '' : '/academic',
      displayName: isStudent ? 'Mock Student' : 'Mock User',
    })
  }
  return post<OtpVerifyResult>('/api/auth/otp/verify', { challengeId, code })
}

// Forgot password

export interface ForgotStartResult {
  challengeId: string
}

export function forgotStart(staffId: string, channel: 'email' | 'sms') {
  if (MOCK_AUTH) {
    return Promise.resolve<ForgotStartResult>({ challengeId: 'mock-challenge-id' })
  }
  return post<ForgotStartResult>('/api/auth/forgot/start', { staffId, channel })
}

export interface ForgotVerifyResult {
  resetToken: string
}

export function forgotVerify(challengeId: string, code: string) {
  if (MOCK_AUTH) {
    return Promise.resolve<ForgotVerifyResult>({ resetToken: 'mock-reset-token' })
  }
  return post<ForgotVerifyResult>('/api/auth/forgot/verify', { challengeId, code })
}

export function forgotReset(resetToken: string, newPassword: string) {
  if (MOCK_AUTH) return Promise.resolve()
  return post<void>('/api/auth/forgot/reset', { resetToken, newPassword })
}

// Account activation

export interface ActivateProfile {
  fullName: string
  role: string
  staffId: string
  email: string
  department: string
  createdAt: string
}

export function activateConfirm(activationToken: string) {
  if (MOCK_AUTH) {
    return Promise.resolve<ActivateProfile>({
      fullName: 'Mock User',
      role: 'Staff',
      staffId: activationToken,
      email: 'mock@isbat.ac.ug',
      department: 'Academic Affairs',
      createdAt: new Date().toISOString(),
    })
  }
  return post<ActivateProfile>('/api/auth/activate/confirm', { activationToken })
}

export interface ActivateSetupResult {
  sessionId: string
  redirect: string
}

export function activateSetup(
  activationToken: string,
  password: string,
  otpChannel: 'email' | 'sms',
  consent: boolean,
) {
  if (MOCK_AUTH) {
    return Promise.resolve<ActivateSetupResult>({
      sessionId: 'mock-session-id',
      redirect: '/academic',
    })
  }
  return post<ActivateSetupResult>('/api/auth/activate/setup', {
    activationToken,
    password,
    otpChannel,
    consent,
  })
}
