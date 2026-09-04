export function authErrorMessage(code: string): string {
  switch (code) {
    case 'bad_credentials':
    case 'unauthorized':
      return 'Incorrect ID or password. Please check and try again.'
    case 'account_locked':
      return 'Your account has been locked after too many failed attempts. Contact IT support at itsupport@isbatuniversity.ac.ug.'
    case 'must_activate':
      return 'You must activate your account before signing in. Check your email for an activation link.'
    case 'invalid_code':
      return 'Incorrect code. Please check and try again.'
    case 'expired_code':
      return 'This code has expired. Please request a new one.'
    default:
      return 'An unexpected error occurred. Please try again or contact IT support.'
  }
}

export function validateStaffId(id: string): string | null {
  if (!id.trim()) return 'Staff ID is required.'
  // if (process.env.NEXT_PUBLIC_AUTH_MOCK === 'true' && !/^[A-Z]{2,4}-\d{4}-\d{4}$/.test(id)) {
  //   return 'Format: ROLE-YYYY-NNNN · e.g. AR-2019-0042. Case-sensitive.'
  // }
  return null
}

export function validateStudentId(id: string): string | null {
  if (!id.trim()) return 'Student ID is required.'
  // if (process.env.NEXT_PUBLIC_AUTH_MOCK === 'true' && !/^ISB\/\d{4}\/[A-Z]{2,6}\/\d{4}$/.test(id)) {
  //   return 'Format: ISB/YYYY/PROG/NNNN · e.g. ISB/2024/BSCS/0142'
  // }
  return null
}

// Keystroke filter for phone number inputs — strips anything that isn't a
// digit, space, or hyphen (formatting only), plus a leading '+' when the
// field has no separate country-code selector alongside it (allowPlus).
// Fields that already pair with a country-code SearchSelect (e.g. Filing/
// Payment's "+256" dropdown) should pass allowPlus=false so the number
// itself stays digits-only. Applied on every real phone field in the
// admission module — previously each one accepted free text, letters
// included.
export function sanitizePhoneInput(value: string, allowPlus = true): string {
  return allowPlus ? value.replace(/[^0-9+\s-]/g, '') : value.replace(/[^0-9\s-]/g, '')
}

export function validatePassword(pw: string): string | null {
  if (!pw) return 'Password is required.'
  // if (pw.length < 8) return 'Password must be at least 8 characters.'
  // // if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.'
  // if (!/\d/.test(pw)) return 'Password must contain at least one number.'
  // if (!/[^a-zA-Z0-9]/.test(pw)) return 'Password must contain at least one special character.'
  return null
}
