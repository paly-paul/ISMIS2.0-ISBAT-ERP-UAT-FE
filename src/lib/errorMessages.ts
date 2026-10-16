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

// Amount fields: drop leading zeros as they're typed ("05" → "5",
// "007.5" → "7.5"), but keep a lone "0" and the zero in "0.5".
export function stripLeadingZeros(value: string): string {
  return value.replace(/^0+(?=\d)/, '')
}

// Person-name fields: letters (any script, so accented names work), spaces,
// apostrophes, hyphens and dots — "O'Brien", "Mary-Jane", "Nakato Jr.".
// Digits and other symbols are dropped as they're typed or pasted.
export function sanitizeNameInput(value: string): string {
  return value.replace(/[^\p{L}\p{M}\s'’.-]/gu, '')
}

// Enquiry student names (POST /admissions/enquiries, 2026-10-15) are
// stricter: letters (accented included) and spaces only — apostrophes,
// hyphens, dots and digits are rejected, so "O'Brien"/"Mary-Anne" fail.
// Typing still goes through sanitizeNameInput (which lets ' - . through),
// so this check is what tells the user why on save, using the backend's
// own message. Callers send the NFC form, so a decomposed accent
// (e + U+0301) reaches the backend as one letter, not a combining mark.
export const ENQUIRY_NAME_MESSAGE = 'Student name must contain only letters and spaces.'

export function isValidEnquiryName(value: string): boolean {
  return /^[\p{L} ]+$/u.test(value.normalize('NFC'))
}

export function validatePassword(pw: string): string | null {
  if (!pw) return 'Password is required.'
  // if (pw.length < 8) return 'Password must be at least 8 characters.'
  // // if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.'
  // if (!/\d/.test(pw)) return 'Password must contain at least one number.'
  // if (!/[^a-zA-Z0-9]/.test(pw)) return 'Password must contain at least one special character.'
  return null
}
