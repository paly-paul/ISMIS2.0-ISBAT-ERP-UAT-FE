import { apiGet, apiPost, apiPut, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed field-for-field against a real Create.bru sample payload —
// note there's no top-level `enquirySource` int on create (that field only
// appears on the read-side Enquiry DTO below); don't add it back in.
export interface EnquiryInput {
  intakeGuid: string
  campusGuid: string
  // Required — confirmed via a real validation_error ("'Request Enquiry
  // Source Guid' must not be empty.") when omitted. The guid of the
  // selected Enquiry Source master record (enquirySourceMaster.ts /
  // /config/enquiry-source-master), not the Isbat one below.
  enquirySourceGuid: string
  studentName: string
  enquiryDate: string
  mobile: string
  // Required (2026-10): Country GUID of the phone's dial code — separate from
  // countryGuid (the student's country). mobile itself stays digits only.
  // 400 "Mobile country is required." / 404 "Mobile country not found.".
  mobileCountryGuid: string
  email: string | null
  // Confirmed via a real validation_error ("'Request Country Guid' must not
  // be empty.") — the create payload takes a guid here, not the plain
  // 'UG'-style code the three enquiry forms used to hardcode. Same
  // countryCode-string → countryGuid fix already made for Application-
  // Payments (see the note on ApplicationPaymentInput.countryGuid in
  // applicationPayment.ts) — sourced from the same GET /api/v1/users/countries
  // master (useCountries()), not the Application-Filling Countries dropdown
  // (which has no guid at all).
  countryGuid: string
  dob: string
  // Optional per post-enquiry.md: 0 = Male, 1 = Female, 2 = Other.
  gender: number | null
  remarks: string | null
  programGuid: string | null
  // Isbat Enquiry Source guid (enquirySource.ts's isbatSourceGuid) — a
  // genuinely different master from enquirySourceGuid above. Optional
  // picker on the create forms; null when not chosen.
  isbatSourceGuid: string | null
  // Free-text source typed on the form (e.g. who referred the candidate) —
  // not the Enquiry Source master's name, which the server resolves itself
  // and returns as enquirySourceName.
  sourceName: string | null
  enquiryTag: string | null
  // Required since the 2026-10 enquiry handoff: the verificationToken from
  // POST /enquiries/email-otp/verify (see verifyEnquiryEmailOtp below). Must
  // have been issued for this same email (trimmed, case-insensitive) within
  // the last 30 minutes, or the create is rejected and nothing is saved.
  emailVerificationToken: string
  // Optional sponsor details (post-enquiry.md, EnquirySponsorFields).
  // spPhoneCountryGuid is required only when spPhone is given.
  spName?: string | null
  spPhone?: string | null
  spPhoneCountryGuid?: string | null
  spEmail?: string | null
  spCountryGuid?: string | null
}

// Confirmed field-for-field against a real GET /api/v1/admissions/enquiries/:guid
// response — supersedes the earlier guess that enquirySource/enquiryStatus/
// followUpStatus/intIsbatSource were unconfirmed ints. They're all guids
// (or absent entirely, in enquirySource's case — there's no int on read
// either, only enquirySourceGuid). campusName/campusCode/programName/
// programCode come back null on every row on the LIST endpoint (GET
// /enquiries, paginated) — the backend isn't resolving them there — but a
// later real single-record sample (GET /enquiries/:guid) shows them
// genuinely populated on that endpoint, along with enquiryStatusName/
// enquiryStatusCode/followUpStatusName/followUpStatusCode (all absent from
// the earlier sample). No intakeName/intakeCode field exists on either
// endpoint though — resolve intakeGuid via the Intake master
// (useIntakes()) client-side, same pattern already used for
// programGuid/campusGuid on the list page.
export interface Enquiry {
  enquiryGuid: string
  enquiryCode: string
  intakeGuid: string
  campusGuid: string
  enquirySourceGuid: string | null
  studentName: string
  enquiryDate: string
  mobile: string
  email: string
  // Was typed as a guaranteed string on the assumption that create always
  // sent the hardcoded 'UG' — now that create sends countryGuid instead
  // (see EnquiryInput.countryGuid above), the read side isn't confirmed to
  // still echo back a code for every row. Confirmed nullable the hard way:
  // payment/page.tsx's matchedCountry lookup crashed on
  // selectedEnquiry.countryCode.trim() for a real enquiry where this came
  // back undefined.
  countryCode: string | null
  countryGuid?: string | null
  countryName?: string | null
  dob: string
  remarks: string | null
  programGuid: string | null
  // From the enquiry's latest follow-up. advisorName is resolved on GET only
  // (null on POST/PUT responses).
  advisorGuid: string | null
  advisorName?: string | null
  followUpStatusGuid: string | null
  enquiryStatusGuid: string | null
  nextFollowDate: string | null
  enquiryTag: string | null
  isbatSourceGuid: string | null
  // Free-text source typed on the enquiry — unchanged by the 2026-10
  // handoff. The two names below are the resolved master-record names for
  // enquirySourceGuid / isbatSourceGuid, returned on list, get, create and
  // update. Optional so older cached rows/mocks still type-check.
  sourceName: string | null
  enquirySourceName?: string | null
  isbatSourceName?: string | null
  campusName: string | null
  campusCode: string | null
  programName: string | null
  programCode: string | null
  enquiryStatusName: string | null
  enquiryStatusCode: string | null
  followUpStatusName: string | null
  followUpStatusCode: string | null
  // Always true for enquiries created since email verification became a
  // precondition of create (2026-10). Older enquiries may still be false,
  // and there's no longer any endpoint to verify an existing enquiry.
  emailVerified?: boolean | null
  // Phone dial-code countries (2026-10) — all null on older enquiries, and
  // names/prefixes null on the PUT response. Display as
  // `${mobileCountryPrefix} ${mobile}` (formatEnquiryPhone).
  mobileCountryGuid?: string | null
  mobileCountryName?: string | null
  mobileCountryPrefix?: string | null
  spPhoneCountryGuid?: string | null
  spPhoneCountryName?: string | null
  spPhoneCountryPrefix?: string | null
}

// Full number for display — just the digits when there's no prefix (older
// enquiries). Some master prefixes aren't real dial codes (e.g. "IND"); that's
// a data fix on the backend's side.
export function formatEnquiryPhone(e: Pick<Enquiry, 'mobile' | 'mobileCountryPrefix'>): string {
  const prefix = e.mobileCountryPrefix?.trim()
  return prefix ? `${prefix} ${e.mobile}` : e.mobile
}

interface EnquiryListResult {
  items: Enquiry[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Confirmed via a real GET /api/v1/admissions/enquiries/counts response —
// backs the enquiry-list page's stats row. A dedicated summary endpoint, not
// derived from the paginated list's own totalCount (which only ever covers
// "all enquiries", not the converted/closed/pending/ODL breakdowns).
export interface EnquiryCounts {
  totalCount: number
  convertedCount: number
  closedCount: number
  pendingFollowUpCount: number
  odelSourceCount: number
}

// UpdateEnquiryRequest (put-enquiry.md): campusGuid required, the rest
// optional. advisorGuid is an employee guid that reassigns the advisor;
// null or omitted keeps the current one — there's no way to clear it here.
// 404 "Advisor not found." for an unknown guid (nothing saved). The PUT
// response still has null advisorName/campusName/programName — refetch GET
// /enquiries/{guid} for names (useUpdateEnquiry invalidates it).
export interface EnquiryUpdateInput {
  advisorGuid?: string | null
  enquiryStatusGuid?: string | null
  programGuid?: string | null
  campusGuid: string
}

let mockEnquirySeq = 1

// In-memory list used only when mock auth is enabled, so the list query has
// something to show after a mock create.
const mockEnquiries: Enquiry[] = []

// 201 returns the saved enquiry with the server-generated enquiryCode
// (EQ{intakeCode}/{n}). campusName/programName/countryName come back null on
// this response (enquiry-create-page.md) — use the form's own selections.
export function createEnquiry(input: EnquiryInput): Promise<Enquiry> {
  if (MOCK_AUTH) {
    const verifiedFor = mockVerificationTokens.get(input.emailVerificationToken)
    if (!verifiedFor || verifiedFor.expiresAt < Date.now() || verifiedFor.email !== normalizeEmail(input.email ?? '')) {
      return Promise.reject(new AuthError('bad_request', NOT_VERIFIED_MESSAGE))
    }
    const enquiry: Enquiry = {
      enquiryGuid: String(mockEnquirySeq),
      enquiryCode: `EQ-MOCK-${mockEnquirySeq++}`,
      intakeGuid: input.intakeGuid,
      campusGuid: input.campusGuid,
      enquirySourceGuid: input.enquirySourceGuid,
      studentName: input.studentName,
      enquiryDate: input.enquiryDate,
      mobile: input.mobile,
      mobileCountryGuid: input.mobileCountryGuid,
      email: input.email ?? '',
      // Mock-only stand-in — the read-side DTO's countryCode is a plain
      // code string (confirmed on GET), but create now only takes
      // input.countryGuid, so there's no code here to echo back without
      // resolving it against the Country master. Not worth wiring up just
      // for the mock list to display; only the real backend response
      // matters for actual saves.
      countryCode: '',
      dob: input.dob,
      remarks: input.remarks,
      programGuid: input.programGuid,
      enquiryTag: input.enquiryTag,
      isbatSourceGuid: input.isbatSourceGuid,
      sourceName: input.sourceName,
      enquirySourceName: null,
      isbatSourceName: null,
      emailVerified: true,
      advisorGuid: null,
      followUpStatusGuid: null,
      enquiryStatusGuid: null,
      nextFollowDate: null,
      campusName: null,
      campusCode: null,
      programName: null,
      programCode: null,
      enquiryStatusName: null,
      enquiryStatusCode: null,
      followUpStatusName: null,
      followUpStatusCode: null,
    }
    mockEnquiries.unshift(enquiry)
    return Promise.resolve(enquiry)
  }
  return apiPost<Enquiry>('/api/v1/admissions/enquiries', input)
}

// GET /admissions/enums/genders (get-enum-values.md) — `value` is what goes
// out as EnquiryInput.gender (0 Male, 1 Female, 2 Other), `name` the label.
export interface GenderOption {
  value: number
  name: string
}

const MOCK_GENDERS: GenderOption[] = [
  { value: 0, name: 'Male' },
  { value: 1, name: 'Female' },
  { value: 2, name: 'Other' },
]

export function getEnquiryGenders(): Promise<GenderOption[]> {
  if (MOCK_AUTH) return Promise.resolve(MOCK_GENDERS.map(g => ({ ...g })))
  return apiGet<GenderOption[] | null>('/api/v1/admissions/enums/genders').then(data => data ?? [])
}

// ---- Email verification (post-enquiry-email-otp-request.md / -verify.md) ----
//
// Verification now happens BEFORE an enquiry exists: request an OTP for an
// email, verify it, then pass the verificationToken to createEnquiry. The old
// per-enquiry endpoints (/enquiries/{guid}/email-otp/...) were removed.

export interface EnquiryEmailOtpChallenge {
  // Needed to verify; a resend returns a new one that replaces the old.
  challengeToken: string
  maskedEmail: string
  expiryMinutes: number
}

export interface EnquiryEmailVerification {
  verificationToken: string
  validityMinutes: number
}

// Exact server message for a missing/expired/mismatched token on create, so
// callers can tell it apart from other bad_request failures.
export const NOT_VERIFIED_MESSAGE = 'Email is not verified. Verify the email with an OTP before submitting the enquiry.'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return domain ? `${local.slice(0, 2)}***@${domain}` : email
}

// Mock-only stand-ins for server state: sends per email (the real limit is 5
// per email per 24h, shared by Send and Resend) and issued tokens.
const MOCK_MAX_SENDS = 5
const mockOtpSends = new Map<string, number>()
const mockChallenges = new Map<string, { email: string; expiresAt: number }>()
const mockVerificationTokens = new Map<string, { email: string; expiresAt: number }>()
let mockTokenSeq = 1

// POST /enquiries/email-otp/request — emails a 6-digit OTP valid for
// expiryMinutes (10). 400 too_many_requests once the email has had 5 sends in
// 24h; that response is the only source of truth for the limit (it survives
// refreshes and other browsers), so the UI must not keep its own counter.
export function requestEnquiryEmailOtp(email: string): Promise<EnquiryEmailOtpChallenge> {
  if (MOCK_AUTH) {
    const key = normalizeEmail(email)
    const sends = mockOtpSends.get(key) ?? 0
    if (sends >= MOCK_MAX_SENDS) {
      return Promise.reject(new AuthError('too_many_requests', 'Too many OTP requests for this email. Please try again later.'))
    }
    mockOtpSends.set(key, sends + 1)
    const challengeToken = `mock-challenge-${mockTokenSeq++}`
    mockChallenges.set(challengeToken, { email: key, expiresAt: Date.now() + 10 * 60_000 })
    return Promise.resolve({ challengeToken, maskedEmail: maskEmail(key), expiryMinutes: 10 })
  }
  return apiPost<EnquiryEmailOtpChallenge>('/api/v1/admissions/enquiries/email-otp/request', { email: email.trim() })
}

// POST /enquiries/email-otp/verify — email must be the one the challenge was
// issued for. 400 bad_request "Invalid or expired OTP." on a wrong code, an
// expired challenge or a different email. There is no per-challenge guess
// limit. Mock mode accepts 123456, same as login.
export function verifyEnquiryEmailOtp(email: string, challengeToken: string, otp: string): Promise<EnquiryEmailVerification> {
  if (MOCK_AUTH) {
    const key = normalizeEmail(email)
    const challenge = mockChallenges.get(challengeToken)
    if (otp !== '123456' || !challenge || challenge.email !== key || challenge.expiresAt < Date.now()) {
      return Promise.reject(new AuthError('bad_request', 'Invalid or expired OTP.'))
    }
    const verificationToken = `mock-verified-${mockTokenSeq++}`
    mockVerificationTokens.set(verificationToken, { email: key, expiresAt: Date.now() + 30 * 60_000 })
    return Promise.resolve({ verificationToken, validityMinutes: 30 })
  }
  return apiPost<EnquiryEmailVerification>('/api/v1/admissions/enquiries/email-otp/verify', { email: email.trim(), challengeToken, otp })
}

// List query for the enquiry-list page. Real: paginated, page/pageSize
// passed straight through (confirmed via List.bru + a real sample response).
// `search` is NOT confirmed against a real backend sample the way page/
// pageSize are — appended as `&search=` to match the convention already used
// by other real master lists in this app (see getExamRules) on the
// assumption an unrecognized param is just ignored server-side rather than
// erroring, so this degrades to today's unfiltered-page behavior if the
// backend doesn't actually support it.
// enquiryStatusGuid (2026-10, get-enquiries.md): server-side status filter,
// ANDed with the rest; totalCount reflects it. Left out entirely for "All"
// (never sent as ''). Enquiries with no status drop out when it's set; an
// unknown guid just returns an empty list.
export function getEnquiries(page = 1, pageSize = 10, search = '', enquiryStatusGuid = ''): Promise<EnquiryListResult> {
  if (MOCK_AUTH) {
    const items = enquiryStatusGuid ? mockEnquiries.filter(e => e.enquiryStatusGuid === enquiryStatusGuid) : mockEnquiries
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  if (enquiryStatusGuid) params.set('enquiryStatusGuid', enquiryStatusGuid)
  return apiGet<EnquiryListResult | null>(`/api/v1/admissions/enquiries?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

const EMPTY_COUNTS: EnquiryCounts = { totalCount: 0, convertedCount: 0, closedCount: 0, pendingFollowUpCount: 0, odelSourceCount: 0 }

export interface EnquiryCountsFilters {
  intakeGuid?: string
  sourceGuid?: string
}

// Backs the enquiry-list page's stats row (Total/Converted/Pending Follow-up/
// ODL Specific/Closed) — independent of the paginated list query above.
// Confirmed to accept intakeGuid/sourceGuid query params — same guid fields
// as the enquiry row's own intakeGuid/enquirySourceGuid, so the stats row
// can be scoped to whatever the page's Intake/Channel filters currently
// have selected instead of always showing the unfiltered global totals.
export function getEnquiryCounts(filters?: EnquiryCountsFilters): Promise<EnquiryCounts> {
  if (MOCK_AUTH) {
    return Promise.resolve({ ...EMPTY_COUNTS, totalCount: mockEnquiries.length })
  }
  const params = new URLSearchParams()
  if (filters?.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters?.sourceGuid) params.set('sourceGuid', filters.sourceGuid)
  const qs = params.toString()
  return apiGet<EnquiryCounts | null>(`/api/v1/admissions/enquiries/counts${qs ? `?${qs}` : ''}`)
    .then(data => data ?? EMPTY_COUNTS)
}

// Fetch one enquiry by its GUID — same EnquiryDto shape as the list items.
export function getEnquiryById(guid: string): Promise<Enquiry> {
  if (MOCK_AUTH) {
    const existing = mockEnquiries.find(e => e.enquiryGuid === guid)
    if (!existing) return Promise.reject(new Error('Enquiry not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Enquiry>(`/api/v1/admissions/enquiries/${guid}`)
}

// Change status/programme/campus on an existing enquiry.
export function updateEnquiry(guid: string, input: EnquiryUpdateInput): Promise<Enquiry> {
  if (MOCK_AUTH) {
    const existing = mockEnquiries.find(e => e.enquiryGuid === guid)
    if (!existing) return Promise.reject(new Error('Enquiry not found'))
    if (input.advisorGuid !== undefined) existing.advisorGuid = input.advisorGuid
    if (input.programGuid !== undefined) existing.programGuid = input.programGuid
    existing.campusGuid = input.campusGuid
    return Promise.resolve(existing)
  }
  return apiPut<Enquiry>(`/api/v1/admissions/enquiries/${guid}`, input)
}
