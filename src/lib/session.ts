const KEY = 'isbat_login_flow'

export interface LoginFlowState {
  challengeId?: string
  otpChannel?: 'email' | 'sms'
  maskedTarget?: string
  forgotChallengeId?: string
  forgotResetToken?: string
  returnTo?: string
}

export function getFlowState(): LoginFlowState {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as LoginFlowState
  } catch {
    return {}
  }
}

export function setFlowState(data: Partial<LoginFlowState>) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(KEY, JSON.stringify({ ...getFlowState(), ...data }))
}

export function clearFlowState() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(KEY)
}

// Session identity — set once login/OTP verification succeeds, so the
// academic layout can read displayName on mount without an extra network
// call. Kept separate from LoginFlowState because that gets cleared as soon
// as the login flow completes, while identity must survive until logout.
const IDENTITY_KEY = 'isbat_session_identity'

export interface SessionIdentity {
  displayName: string
}

export function getSessionIdentity(): SessionIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(IDENTITY_KEY)
    return raw ? (JSON.parse(raw) as SessionIdentity) : null
  } catch {
    return null
  }
}

export function setSessionIdentity(identity: SessionIdentity) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
}

export function clearSessionIdentity() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(IDENTITY_KEY)
}
