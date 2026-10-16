import { apiDelete, apiGet, apiGetBlob, apiPost, apiPostForm } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via a real GET /payment-search response — a genuinely different,
// much richer shape than first guessed (no intApplication/status/studentName
// fields at all; name is split firstName/lastName, email is emailId, and it
// carries the full set of fields SaveGeneral needs — intake/campus/program/
// semester/feeHd guids, dob, gender, nationalId, passportNo, countryGuid,
// refugee/refugeeId). saveStatus/action/studCategory/intRegistrar are
// int-encoded with no confirmed label mapping — display raw, don't guess,
// same caution as Enquiry's enquiryStatus. Used to prefill the Personal
// Info tab when an application is selected, since all this data is already
// known — the user can still edit anything afterward.
// enquiryGuid/batchTimeGuid/batchGuid and the four *UserFileName fields
// mirror the richer ApplicationListItem shape below (same underlying
// application entity, just a narrower DTO on this endpoint per the .bru
// sample) — added so this page can lock Enquiry/Batch Time/Batch as
// non-editable per the backend team's Application Filling requirements
// doc, and so previously-uploaded documents can be shown in the Documents
// tab. Not independently confirmed for THIS endpoint's response — if the
// live payment-search response doesn't actually carry them, they'll come
// back undefined/null and the corresponding field simply won't prefill.
export interface FilingApplicationSearchResult {
  applicationGuid: string
  appRefNo: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  emailId: string | null
  whatsApp: string | null
  intakeCode: string | null
  yearCode: string | null
  intakeGuid: string | null
  enquiryGuid: string | null
  campusGuid: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  batchTimeGuid: string | null
  batchGuid: string | null
  feeHdGuid: string | null
  action: number | null
  saveStatus: number | null
  refugee: number | null
  refugeeId: string | null
  studCategory: number | null
  gender: number | null
  nationalId: string | null
  idUserFileName: string | null
  passportNo: string | null
  passUserFileName: string | null
  visaUserFileName: string | null
  studUserFileName: string | null
  countryGuid: string | null
  universityEmail: string | null
  dob: string | null
  justificationReg: string | null
  approveDateReg: string | null
  intRegistrar: number | null
  docVerified: boolean | null
  verifiedDate: string | null
  docRemarks: string | null
  admLetterSend: number | null
  provLetterSend: number | null
  accLetterSend: number | null
  createdDate: string
  // From the application-payment record (Filing's search source): decides
  // whether the payment's receipt can be printed after submitting — a normal
  // payment with a receipt number. Undefined for other search sources.
  receiptNo?: number | null
  exemptionType?: unknown
}

export interface FilingApplicationSearchResponse {
  items: FilingApplicationSearchResult[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Confirmed via a real GET /api/v1/admissions/application-filling/ list
// response — the admin-facing "all applications" list (backs
// /admission/applicants), a genuinely richer shape than
// FilingApplicationSearchResult above: adds intApplication, enquiryGuid,
// whatsApp, id/passport/visa file names, sponsor + two reference-contact
// blocks, semesterGuid/batchTimeGuid/batchGuid, per-letter send flags/dates,
// and modifiedDate. saveStatus/action/studCategory/intRegistrar/gender are
// int-encoded with no confirmed label mapping anywhere — display raw,
// don't guess, same caution as FilingApplicationSearchResult and Enquiry's
// enquiryStatus.
export interface ApplicationListItem {
  intApplication: number
  applicationGuid: string
  appRefNo: string
  enquiryGuid: string | null
  intakeCode: string | null
  yearCode: string | null
  emailId: string | null
  dob: string | null
  firstName: string | null
  lastName: string | null
  gender: number | null
  countryGuid: string | null
  phone: string | null
  whatsApp: string | null
  nationalId: string | null
  idUserFileName: string | null
  passportNo: string | null
  passUserFileName: string | null
  visaUserFileName: string | null
  vStartDate: string | null
  vEndDate: string | null
  spName: string | null
  spEmail: string | null
  spCountryGuid: string | null
  spPhone: string | null
  ref1Name: string | null
  ref1Pos: string | null
  ref1Org: string | null
  ref1CountryCode: string | null
  ref1Phone: string | null
  ref1Add: string | null
  ref2Name: string | null
  ref2Pos: string | null
  ref2Org: string | null
  ref2CountryCode: string | null
  ref2Phone: string | null
  ref2Add: string | null
  intakeGuid: string | null
  campusGuid: string | null
  programGuid: string | null
  semesterGuid: string | null
  feeHdGuid: string | null
  // Resolved fee head code/description. Only GET /by-payment/{paymentGuid}
  // fills these; GET /application-filling/{applicationGuid} returns them
  // null. Also null when feeHdGuid is null or the fee head can't be found.
  feeCode?: string | null
  feeName?: string | null
  batchTimeGuid: string | null
  batchGuid: string | null
  refugee: number | null
  refugeeId: string | null
  studUserFileName: string | null
  saveStatus: number | null
  action: number | null
  justificationReg: string | null
  approveDateReg: string | null
  intRegistrar: number | null
  docVerified: boolean | null
  verifiedDate: string | null
  docRemarks: string | null
  admLetterSend: number | null
  admLetterDate: string | null
  provLetterSend: number | null
  provLetterDate: string | null
  accLetterSend: number | null
  accLetterDate: string | null
  studCategory: number | null
  universityEmail: string | null
  createdDate: string | null
  modifiedDate: string | null
  actionLabel?: string | null
  saveStatusLabel?: string | null
  programName?: string | null
  intakeName?: string | null
  campusName?: string | null
  countryName?: string | null
  // Sponsor fallback (2026-10-15): with no sponsor details of its own, an
  // application created from an enquiry returns the enquiry's spName/
  // spEmail/spCountryGuid/spPhone, per field (the application's own values
  // win). spPhoneCountryGuid is the sponsor phone's dial-code country — null
  // when spPhone is the application's own. The two names are only filled on
  // /{guid}, /{int}/detail and /by-payment; finance + list send null.
  spPhoneCountryGuid?: string | null
  spCountryName?: string | null
  spPhoneCountryName?: string | null
  genderLabel?: string | null
  refugeeLabel?: string | null
  docVerifiedLabel?: string | null
  admLetterSendLabel?: string | null
  provLetterSendLabel?: string | null
  accLetterSendLabel?: string | null
}

interface ApplicationListResponse {
  items: ApplicationListItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockApplications: ApplicationListItem[] = []

// Per get-application-by-guid.md — GET /api/v1/admissions/application-filling/{applicationGuid}
// (GetCompletedApplicationByIdQuery). The doc describes the response only as
// "the full record: identifiers, personal details, identity documents, visa
// dates, academic placement and status" without enumerating every field, so
// this reuses ApplicationListItem's already-confirmed shape (same underlying
// application entity, the admin "all applications" list) as the base and
// adds only what the doc explicitly calls out beyond that: `actionLabel`.
// NOT independently confirmed field-by-field against a real completed-
// application response — if a real call comes back missing/renaming
// something here, trust the live response over this interface.
export interface ApplicationDetailDto extends ApplicationListItem {
  actionLabel: string | null
}

// Only ever returns data for an application whose Action == Submitted — a
// narrower window than "completed" might suggest. Confirmed by the backend
// team (2026-09-10): an application still being filled in 400s here, AND so
// does one that has already moved past Submitted (vetted/rejected/
// registered) — both come back as the same "not found or not completed."
// message (see get-application-by-guid.md), indistinguishable from each
// other or from a bad guid. Callers should treat any rejection here as
// "nothing to enrich with", not a hard failure — this is a best-effort
// prefill source usable only in that narrow submitted-but-not-yet-vetted
// window, never a general "fetch this application" lookup.
//
// 2026-09-11: moved from GET /application-filling/{applicationGuid} to GET
// /application-filling/by-payment/{paymentGuid} — the Filing page's own
// search source (application-payments, see mapApplicationPaymentToSearchResult)
// only ever has a paymentGuid to offer, not a real application-filling guid;
// that value was previously sent to the {applicationGuid} route disguised
// as one (via FilingApplicationSearchResult.applicationGuid), which "worked"
// only in the sense that a mismatched guid and a not-yet-submitted
// application both 400 identically here — this dedicated by-payment route
// removes that guesswork instead of relying on the coincidence.
export function getApplicationByPaymentGuid(paymentGuid: string): Promise<ApplicationDetailDto> {
  if (MOCK_AUTH) {
    // Nothing in this UI-only prototype's mock data represents a genuinely
    // completed application (mockApplications is empty, mockSearchResults'
    // entries are mid-filing) — reject the same way the real endpoint does
    // for an incomplete/unknown guid, so callers exercise the same
    // best-effort fallback path in mock mode as they will for real.
    return Promise.reject(new Error('Application not found or not completed.'))
  }
  return apiGet<ApplicationDetailDto>(`/api/v1/admissions/application-filling/by-payment/${paymentGuid}`)
}

// GET /api/v1/admissions/application-filling/{applicationGuid} — the full
// record behind All Applicants' View modal (get-application-by-guid.md).
// Completed applications only: one still being filled in is a 400 "Application
// not found or not completed.", so the modal falls back to the list row it
// already has rather than treating that as a hard failure.
export function getApplicationByGuid(applicationGuid: string): Promise<ApplicationDetailDto> {
  if (MOCK_AUTH) return Promise.reject(new Error('Application not found or not completed.'))
  return apiGet<ApplicationDetailDto>(`/api/v1/admissions/application-filling/${applicationGuid}`)
}

// Confirmed via Application-Filling/SaveGeneral.bru — countryGuid/
// spCountryGuid ARE real fields ("countryGuid replaces old intCountry +
// countryCode fields", "spCountryGuid replaces old spCountryCode field").
// The dedicated Application-Filling/Countries.bru dropdown (GET
// .../application-filling/countries, see CountryDropdownDto below) turned
// out to have NO guid at all, only the legacy intCountry int — the real
// guid-bearing source is GET /api/v1/users/countries (lib/api/academic/
// country.ts, useCountries()), confirmed end-to-end: sending its
// countryGuid on Application-Payments' Create produced a real successful
// payment. Both this form and Application-Payments now source their
// Country dropdown from useCountries() instead.
export interface SaveGeneralInput {
  appRefNo: string
  enquiryGuid: string | null
  intakeCode: string | null
  emailId: string | null
  dob: string | null
  firstName: string | null
  lastName: string | null
  gender: number | null
  countryGuid: string | null
  phone: string | null
  nationalId: string | null
  nationalIdFile: File | null
  passportNo: string | null
  passportFile: File | null
  vStartDate: string | null
  vEndDate: string | null
  visaFile: File | null
  spName: string | null
  spEmail: string | null
  spCountryGuid: string | null
  spPhone: string | null
  campusGuid: string
  programGuid: string
  feeHdGuid: string
  semesterGuid: string | null
  batchTimeGuid: string | null
  batchGuid: string | null
  refugee: number
  refugeeId: string | null
  refugeeFile: File | null
}

// SUPERSEDED for countryGuid purposes — confirmed via a real response that
// this endpoint has no guid field at all, only the legacy intCountry int,
// despite SaveGeneral.bru/Create.bru both requiring a countryGuid. The real
// guid-bearing Country source is GET /api/v1/users/countries instead (see
// lib/api/academic/country.ts, useCountries()) — use that for any new
// country dropdown. Kept defined here (and still fetchable via
// getFilingCountries()) in case this endpoint's intCountry/dialCode data is
// useful for something else later, but no current caller uses it.
export interface CountryDropdownDto {
  intCountry: number
  countryName: string
  dialCode: string
  isDefault: boolean
}

export interface SaveGeneralResponse {
  intApplication: number
  applicationGuid: string
  isFirstSave: boolean
  saveStep: number
}

export interface SaveQualificationInput {
  appRefNo: string
  institution: string
  university: string
  passYear: number
  grade: string
  yearsTaken: number
  proofFile: File
}

export interface SaveQualificationResponse {
  intApplicationQual: number
  appRefNo: string
}

export interface SubmitApplicationResponse {
  intApplication: number
  appRefNo: string
}

const mockSearchResults: FilingApplicationSearchResult[] = [
  {
    applicationGuid: 'mock-app-1', appRefNo: 'APP2026/1', firstName: 'Sarah', lastName: 'Nakato',
    phone: '700000001', emailId: 'nakato.s@example.com', whatsApp: null,
    intakeCode: '20261', yearCode: '2026', intakeGuid: null, enquiryGuid: null, campusGuid: null, programGuid: null,
    programName: 'Bachelor of Science in Information Technology',
    semesterGuid: null, batchTimeGuid: null, batchGuid: null, feeHdGuid: null,
    action: 1, saveStatus: 4, refugee: 0, refugeeId: '', studCategory: 1, gender: 0,
    nationalId: 'NATIONAL ID', idUserFileName: null, passportNo: '', passUserFileName: null, visaUserFileName: null,
    studUserFileName: null, countryGuid: null, universityEmail: null, dob: '2000-01-01T00:00:00',
    justificationReg: null, approveDateReg: null, intRegistrar: null, docVerified: null, verifiedDate: null, docRemarks: null,
    admLetterSend: null, provLetterSend: null, accLetterSend: null, createdDate: '2026-01-01T00:00:00',
  },
]

const mockCountries: CountryDropdownDto[] = [
  { intCountry: 1, countryName: 'Uganda', dialCode: 'UG', isDefault: true },
  { intCountry: 3, countryName: 'Kenya', dialCode: 'KEN', isDefault: false },
  { intCountry: 4, countryName: 'Tanzania', dialCode: 'TZ', isDefault: false },
]

// Optional ?search= on country name (case-insensitive contains, 2026-10).
export function getFilingCountries(search?: string): Promise<CountryDropdownDto[]> {
  const term = search?.trim()
  if (MOCK_AUTH) return Promise.resolve(term ? mockCountries.filter(c => c.countryName.toLowerCase().includes(term.toLowerCase())) : mockCountries)
  return apiGet<CountryDropdownDto[] | null>(`/api/v1/admissions/application-filling/countries${term ? `?search=${encodeURIComponent(term)}` : ''}`).then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Backs /admission/applicants — confirmed via a real GET response (see
// ApplicationListItem above). page/pageSize are real server-side pagination
// (confirmed) — this used to be called with a single large pageSize
// (FETCH_ALL_PAGE_SIZE = 1000) and paginated/searched entirely client-side,
// which silently dropped anything past row 1000 once the real table grew
// past that (same "confirmed live" gap enquiry-list and course-units hit
// with the identical pattern). Switched to real per-page fetches, same fix
// as enquiry-list's getEnquiries. `search` is CONFIRMED (2026-10 backend
// handoff): exact match on reference number, phone or email, or a
// case-insensitive "contains" on the applicant name.
export function getApplications(page = 1, pageSize = 10, search = ''): Promise<ApplicationListResponse> {
  if (MOCK_AUTH) {
    return Promise.resolve({ items: mockApplications, totalCount: mockApplications.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<ApplicationListResponse | null>(`/api/v1/admissions/application-filling/?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Backs /admission/applicants since ADM-027 (get-applicants.md, 2026-10-16).
// Unlike getApplications above (Submitted only), this returns every
// application whatever its status, so vetted and registered applicants stay
// in the list. Newest first. status is null while an application is still
// being filled in; studentGuid is null until the applicant is registered.
export type ApplicantStatus = 'Waiting' | 'Submitted' | 'Vetted' | 'Rejected' | 'Registered'

export interface ApplicantListItem {
  applicationGuid: string
  studentGuid: string | null
  appRefNo: string
  name: string | null
  phone: string | null
  email: string | null
  programName: string | null
  intakeCode: string | null
  status: ApplicantStatus | null
  applicationDate: string
}

export interface ApplicantListResponse {
  items: ApplicantListItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// pageSize is capped at 100 server-side (400 above that). search matches
// ref no / phone / email (exact), name (contains), and student reg no or
// student number.
export function getApplicants(page = 1, pageSize = 10, search = ''): Promise<ApplicantListResponse> {
  if (MOCK_AUTH) {
    const items: ApplicantListItem[] = mockApplications.map(a => ({
      applicationGuid: a.applicationGuid,
      studentGuid: null,
      appRefNo: a.appRefNo,
      name: `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || null,
      phone: a.phone,
      email: a.emailId,
      programName: a.programName ?? null,
      intakeCode: a.intakeCode,
      status: 'Submitted',
      applicationDate: a.createdDate ?? new Date().toISOString(),
    }))
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(Math.min(pageSize, 100)) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<ApplicantListResponse | null>(`/api/v1/admissions/application-filling/applicants?${params.toString()}`)
    .then(data => ({ items: data?.items ?? [], totalCount: data?.totalCount ?? 0, pageNumber: data?.pageNumber ?? page, pageSize: data?.pageSize ?? pageSize }))
}

// Confirmed via a real GET /api/v1/admissions/application-payments response
// (no query params, bare page/pageSize) — a genuinely different, richer
// record than FilingApplicationSearchResult in most of the guid fields that
// actually matter for locking Academic Details (campusGuid/programGuid/
// semesterGuid/batchTimeGuid/batchGuid/feeHdGuid/countryGuid are ALL real
// here — batchTimeGuid/batchGuid specifically were never confirmed on
// payment-search, which is why those two stayed editable there). Trade-off:
// no applicationGuid at all (paymentGuid isn't the same guid space), no
// split firstName/lastName (just studentName), and none of the personal-
// detail fields payment-search had (dob/gender/nationalId/passportNo/
// refugee/refugeeId/*UserFileName) — those simply won't prefill through
// this source. intEnquiry is present but as a raw int, same "no confirmed
// guid" gap enquiryGuid already had. No confirmed search/filter query param
// on this endpoint (the sample call took none) — fetched once, unfiltered,
// and matched client-side instead of trusting an unconfirmed searchTerm
// param the way payment-search's own param was confirmed.
export interface ApplicationPaymentRecord {
  intApplication: number
  paymentGuid: string
  appRefNo: string
  paymentCode: string
  intEnquiry: number | null
  payDate: string
  intReceipt: number | null
  receiptNo: number | null
  amount: number
  amountUsh: number
  currencyGuid: string | null
  exRate: number | null
  remarks: string | null
  intProgram: number
  programGuid: string
  programName?: string | null
  countryGuid: string
  mobile: number
  email: string
  studentName: string
  intBank: number
  fileType: string | null
  fileName: string | null
  userFileName: string | null
  iStatus: number
  intakeCode: number
  intCampus: number
  campusGuid: string
  intSem: number
  semesterGuid: string
  intBatchTime: number
  batchTimeGuid: string
  intBatch: number
  batchGuid: string
  intFee: number
  feeHdGuid: string
  payType: number
  exemptionType: number | null
  oDelIntApplication: number | null
  isDeleted: boolean
  createdDate: string
  createdBy: string | null
  modifiedDate: string | null
  modifiedBy: string | null
}

interface ApplicationPaymentListResponse {
  items: ApplicationPaymentRecord[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// intakeCode is a CONFIRMED real server-side filter on this endpoint (a live
// ?intakeCode=20261 request returned a properly scoped/paginated result —
// totalCount dropped to just that intake's own count). Optional here since
// the unfiltered call is still valid (used the fallback way before this was
// confirmed), but callers should pass it whenever they have one — scoping
// to the current intake instead of fetching every intake's payments at once
// is the whole point.
// searchTerm is now ALSO a CONFIRMED real server-side param (2026-09-08) —
// combining it with intakeCode in the same request isn't independently
// verified, only each param on its own, but both are standard query filters
// on the same list endpoint so they're assumed combinable here.
function getApplicationPayments(page = 1, pageSize = 20, intakeCode?: number | string, searchTerm?: string): Promise<ApplicationPaymentListResponse> {
  const intakeParam = intakeCode != null ? `&intakeCode=${intakeCode}` : ''
  const searchParam = searchTerm?.trim() ? `&searchTerm=${encodeURIComponent(searchTerm.trim())}` : ''
  return apiGet<ApplicationPaymentListResponse | null>(`/api/v1/admissions/application-payments?page=${page}&pageSize=${pageSize}${intakeParam}${searchParam}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Adapts a payment record onto the FilingApplicationSearchResult shape this
// page already knows how to consume — every field this source genuinely
// doesn't have (see the note above) comes through null rather than guessed.
function mapApplicationPaymentToSearchResult(r: ApplicationPaymentRecord): FilingApplicationSearchResult {
  const nameParts = (r.studentName || '').trim().split(/\s+/)
  const firstName = nameParts[0] || null
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

  return {
    applicationGuid: r.paymentGuid,
    appRefNo: r.appRefNo,
    firstName,
    lastName,
    phone: r.mobile != null ? String(r.mobile) : null,
    emailId: r.email,
    whatsApp: null,
    intakeCode: r.intakeCode != null ? String(r.intakeCode) : null,
    yearCode: null,
    intakeGuid: null,
    enquiryGuid: (r as any).enquiryGuid ?? (r as any).guidEnquiry ?? null,
    campusGuid: r.campusGuid,
    programGuid: r.programGuid,
    programName: r.programName ?? (r as any).programmeName ?? (r as any).program ?? null,
    semesterGuid: r.semesterGuid,
    batchTimeGuid: r.batchTimeGuid,
    batchGuid: r.batchGuid,
    feeHdGuid: r.feeHdGuid,
    action: null,
    saveStatus: null,
    refugee: null,
    refugeeId: null,
    studCategory: null,
    gender: null,
    nationalId: null,
    idUserFileName: null,
    passportNo: null,
    passUserFileName: null,
    visaUserFileName: null,
    studUserFileName: null,
    countryGuid: r.countryGuid,
    universityEmail: null,
    dob: (r as any).dob ?? (r as any).dateOfBirth ?? null,
    justificationReg: null,
    approveDateReg: null,
    intRegistrar: null,
    docVerified: null,
    verifiedDate: null,
    docRemarks: null,
    admLetterSend: null,
    provLetterSend: null,
    accLetterSend: null,
    createdDate: r.createdDate,
    receiptNo: r.receiptNo ?? null,
    exemptionType: r.exemptionType ?? null,
  }
}

// Dedicated "current intake" search endpoint — the backend scopes to the
// current academic intake itself, so no intakeCode param is sent (or
// needed) here. Backs only the Filing page's interactive applicant-search
// dropdown (via getFilingApplicationsPage below), which was already meant
// to be current-intake-scoped client-side via effectiveIntakeCode before
// this endpoint existed. Deliberately NOT used for the appRefNo-prefill
// lookup (searchApplicationsForFiling/getApplicationPayments) — that path
// intentionally searches across every intake (see its own comment on why
// scoping it broke prefill for an older-intake application), and this
// endpoint's auto-scoping would reintroduce exactly that bug. searchTerm
// param name/shape assumed to match the sibling /application-payments
// endpoint's own CONFIRMED searchTerm convention — not independently
// confirmed against a real response yet.
function getApplicationPaymentsCurrentIntake(page = 1, pageSize = 20, searchTerm?: string): Promise<ApplicationPaymentListResponse> {
  const searchParam = searchTerm?.trim() ? `&searchTerm=${encodeURIComponent(searchTerm.trim())}` : ''
  return apiGet<ApplicationPaymentListResponse | null>(`/api/v1/admissions/application-payments/current-intake?page=${page}&pageSize=${pageSize}${searchParam}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Reinstated payment-search for the appRefNo-prefill lookup only (per the
// user, 2026-09-10) — this endpoint doesn't carry the academic guids
// (campusGuid/programGuid/semesterGuid/batchTimeGuid/batchGuid/feeHdGuid)
// that /application-payments has, so Academic Details no longer locks for
// an applicant sourced through this path; those fields simply come back
// null/editable instead. Traded deliberately for payment-search's richer
// personal-detail fields (dob/gender/nationalId/passportNo/refugee, split
// firstName/lastName) and native FilingApplicationSearchResult shape — no
// mapping step needed, unlike the /application-payments-backed path below.
// Deliberately NOT switched for the interactive dropdown search
// (getFilingApplicationsPage/getApplicationPaymentsCurrentIntake) — that one
// still needs the academic guids to lock Academic Details on selection.
// intakeCode is intentionally NOT passed here — this lookup searches across
// every intake (see the comment on its caller for the bug this fixed when
// it was scoped to one intake).
export function searchApplicationsForFiling(searchTerm: string, pageNumber = 1, pageSize = 20): Promise<FilingApplicationSearchResponse> {
  if (MOCK_AUTH) {
    const items = searchTerm.trim()
      ? mockSearchResults.filter(r => `${r.appRefNo} ${r.firstName} ${r.emailId} ${r.phone}`.toLowerCase().includes(searchTerm.toLowerCase()))
      : mockSearchResults
    return Promise.resolve({ items, totalCount: items.length, pageNumber, pageSize })
  }
  return apiGet<FilingApplicationSearchResponse | null>(
    `/api/v1/admissions/application-filling/payment-search?searchTerm=${encodeURIComponent(searchTerm)}&pageNumber=${pageNumber}&pageSize=${pageSize}`,
  ).then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// GET /admissions/application-filling/vetted-registered-search
// (get-vetted-registered-search.md) — applications already vetted or
// registered. Backs the Transaction Report's one-student picker, which keeps
// the chosen applicationGuid. searchTerm must be ≥ 2 chars when non-blank;
// pageSize ≤ 100. Items are application summaries, the same shape as
// payment-search's.
export function searchVettedRegisteredApplications(searchTerm: string, pageNumber = 1, pageSize = 20): Promise<FilingApplicationSearchResponse> {
  if (MOCK_AUTH) return searchApplicationsForFiling(searchTerm, pageNumber, pageSize)
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (searchTerm.trim()) params.set('searchTerm', searchTerm.trim())
  return apiGet<FilingApplicationSearchResponse | null>(`/api/v1/admissions/application-filling/vetted-registered-search?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// What Payment hands to Filing after "Proceed to Filing": the just-created
// payment, straight from the POST response plus the form values it came
// from. No lookup on the Filing side: a just-paid applicant exists only as a
// payment record (no application row until General Details is saved), and
// searching for it by appRefNo proved unreliable.
export interface NewPaymentHandoff {
  paymentGuid: string
  appRefNo: string
  studentName: string
  mobile: string | null
  email: string | null
  intakeCode: number | null
  intakeGuid: string | null
  enquiryGuid: string | null
  countryGuid: string | null
  campusGuid: string
  programGuid: string
  programName: string | null
  semesterGuid: string
  batchTimeGuid: string
  batchGuid: string
  feeHdGuid: string
  // For the receipt print after submitting; null/undefined when exempt or
  // no receipt was issued.
  receiptNo?: number | null
  isExemption?: boolean
}

// Same shape a dropdown pick produces (mapApplicationPaymentToSearchResult),
// so selecting it behaves identically. applicationGuid is the paymentGuid,
// which is what the by-payment detail lookup takes.
export function filingResultFromNewPayment(p: NewPaymentHandoff): FilingApplicationSearchResult {
  return {
    ...mapApplicationPaymentToSearchResult({
      paymentGuid: p.paymentGuid,
      appRefNo: p.appRefNo,
      studentName: p.studentName,
      mobile: p.mobile ? Number(p.mobile) : null,
      email: p.email,
      intakeCode: p.intakeCode,
      enquiryGuid: p.enquiryGuid,
      countryGuid: p.countryGuid,
      campusGuid: p.campusGuid,
      programGuid: p.programGuid,
      programName: p.programName,
      semesterGuid: p.semesterGuid,
      batchTimeGuid: p.batchTimeGuid,
      batchGuid: p.batchGuid,
      feeHdGuid: p.feeHdGuid,
      receiptNo: p.receiptNo ?? null,
      // Any non-null value marks an exemption; the exact type isn't needed.
      exemptionType: p.isExemption ? 1 : null,
      createdDate: new Date().toISOString(),
    } as unknown as ApplicationPaymentRecord),
    intakeGuid: p.intakeGuid,
  }
}

// Real server page of application-payments/current-intake, filtered
// server-side by searchTerm (name and AppRefNo both match, per the backend
// team) and mapped onto the Filing search shape — backs the Filing page's
// applicant-search dropdown's scroll-to-load-more
// (useSearchApplicationsForFilingInfinite), same convention as
// useSearchCourseUnitsInfinite/useSearchStudentsInfinite elsewhere in the
// app. No intakeCode param — the /current-intake endpoint scopes to the
// current academic intake itself now, replacing the old client-computed
// effectiveIntakeCode fallback (see getApplicationPaymentsCurrentIntake's
// own comment).
export function getFilingApplicationsPage(pageNumber = 1, pageSize = 20, searchTerm?: string): Promise<FilingApplicationSearchResponse> {
  if (MOCK_AUTH) {
    const items = searchTerm?.trim()
      ? mockSearchResults.filter(r => `${r.appRefNo} ${r.firstName} ${r.emailId} ${r.phone}`.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      : mockSearchResults
    return Promise.resolve({ items, totalCount: items.length, pageNumber, pageSize })
  }
  return getApplicationPaymentsCurrentIntake(pageNumber, pageSize, searchTerm).then(res => ({
    items: res.items.map(mapApplicationPaymentToSearchResult),
    totalCount: res.totalCount,
    pageNumber,
    pageSize,
  }))
}

export function saveGeneral(input: SaveGeneralInput): Promise<SaveGeneralResponse> {
  if (MOCK_AUTH) {
    return Promise.resolve({ intApplication: 1, applicationGuid: 'mock-app-1', isFirstSave: true, saveStep: 1 })
  }

  // Every optional/nullable field is always present in the payload — an
  // empty value is sent as the literal string "null" rather than omitted
  // or sent as "". NOTE: this is the opposite of the "Guid?-must-be-omitted"
  // convention used by programMaster.ts/applicationPayment.ts (there, even
  // a literal "null" string fails ASP.NET's Guid.Parse binder) — confirmed
  // deliberately for this endpoint specifically; revisit if SaveGeneral
  // starts 400ing on an empty guid field the same way those did.
  const asStr = (v: string | null | undefined) => v || 'null'
  const formData = new FormData()
  formData.append('appRefNo', input.appRefNo)
  formData.append('enquiryGuid', asStr(input.enquiryGuid))
  formData.append('intakeCode', asStr(input.intakeCode))
  formData.append('emailId', asStr(input.emailId))
  formData.append('dob', asStr(input.dob))
  formData.append('firstName', asStr(input.firstName))
  formData.append('lastName', asStr(input.lastName))
  formData.append('gender', input.gender != null ? String(input.gender) : 'null')
  formData.append('countryGuid', asStr(input.countryGuid))
  formData.append('phone', asStr(input.phone))
  formData.append('nationalId', asStr(input.nationalId))
  if (input.nationalIdFile) formData.append('nationalIdFile', input.nationalIdFile)
  formData.append('passportNo', asStr(input.passportNo))
  if (input.passportFile) formData.append('passportFile', input.passportFile)
  formData.append('vStartDate', asStr(input.vStartDate))
  formData.append('vEndDate', asStr(input.vEndDate))
  if (input.visaFile) formData.append('visaFile', input.visaFile)
  formData.append('spName', asStr(input.spName))
  formData.append('spEmail', asStr(input.spEmail))
  formData.append('spCountryGuid', asStr(input.spCountryGuid))
  formData.append('spPhone', asStr(input.spPhone))
  formData.append('campusGuid', input.campusGuid)
  formData.append('programGuid', input.programGuid)
  formData.append('feeHdGuid', input.feeHdGuid)
  formData.append('semesterGuid', asStr(input.semesterGuid))
  formData.append('batchTimeGuid', asStr(input.batchTimeGuid))
  formData.append('batchGuid', asStr(input.batchGuid))
  formData.append('refugee', String(input.refugee))
  formData.append('refugeeId', asStr(input.refugeeId))
  if (input.refugeeFile) formData.append('refugeeFile', input.refugeeFile)

  return apiPostForm<SaveGeneralResponse>('/api/v1/admissions/application-filling/general', formData)
}

export function saveQualification(input: SaveQualificationInput): Promise<SaveQualificationResponse> {
  if (MOCK_AUTH) {
    return Promise.resolve({ intApplicationQual: Math.floor(Math.random() * 100000), appRefNo: input.appRefNo })
  }

  const formData = new FormData()
  formData.append('appRefNo', input.appRefNo)
  formData.append('institution', input.institution)
  formData.append('university', input.university)
  formData.append('passYear', String(input.passYear))
  formData.append('grade', input.grade)
  formData.append('yearsTaken', String(input.yearsTaken))
  formData.append('proofFile', input.proofFile)

  return apiPostForm<SaveQualificationResponse>('/api/v1/admissions/application-filling/qualifications', formData)
}

export function deleteQualification(intApplicationQual: number): Promise<unknown> {
  if (MOCK_AUTH) return Promise.resolve({ success: true })
  return apiDelete<unknown>(`/api/v1/admissions/application-filling/qualifications/${intApplicationQual}`)
}

export function uploadPhoto(appRefNo: string, photo: File): Promise<unknown> {
  if (MOCK_AUTH) return Promise.resolve({ success: true })
  const formData = new FormData()
  formData.append('appRefNo', appRefNo)
  formData.append('photo', photo)
  return apiPostForm<unknown>('/api/v1/admissions/application-filling/photo', formData)
}

export function submitApplication(intApplication: number, appRefNo: string): Promise<SubmitApplicationResponse> {
  if (MOCK_AUTH) return Promise.resolve({ intApplication, appRefNo })
  return apiPost<SubmitApplicationResponse>(`/api/v1/admissions/application-filling/${intApplication}/submit`, {
    appRefNo,
    declarationAccepted: true,
  })
}

// Confirmed via get-export-csv.md — streams ALL applications across every
// status (Submitted/Vetted/Rejected/Registered) as one CSV file; there's no
// pagination on this endpoint, the whole matching set comes back in a
// single response. All four query params are optional and ANDed together
// when supplied; omitting all of them (what the Export CSV button on
// /admission/applicants does today, since that page has no filter UI of
// its own yet) exports the full dataset. Response is a raw file (see
// apiGetBlob's own comment for why this doesn't go through apiGet), not
// the app's usual JSON envelope.
export interface ExportApplicationsCsvParams {
  intakeGuid?: string | null
  programGuid?: string | null
  fromDate?: string | null
  toDate?: string | null
}

// Splits raw CSV text into rows, respecting RFC 4180 double-quoted fields
// that can themselves contain the newline being split on (get-export-csv.md:
// "Fields that contain a comma, double-quote, or newline are RFC
// 4180-quoted") — a naive text.split('\n') would cut a quoted multi-line
// field in half.
function splitCsvRows(text: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') inQuotes = !inQuotes
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      rows.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) rows.push(current)
  return rows
}

export function exportApplicationsCsv(params: ExportApplicationsCsvParams = {}): Promise<{ blob: Blob; filename: string }> {
  if (MOCK_AUTH) {
    // Nothing meaningful to fabricate for a raw file download in a UI-only
    // prototype — a header-only CSV is enough to exercise the download
    // flow (button → file saved) without a backend.
    const header = 'App Ref,Applicant Name,Phone,Email,Programme,Intake,Gender,Date,Status\n'
    return Promise.resolve({ blob: new Blob([header], { type: 'text/csv' }), filename: 'applications_mock.csv' })
  }
  const qs = new URLSearchParams()
  if (params.intakeGuid) qs.set('intakeGuid', params.intakeGuid)
  if (params.programGuid) qs.set('programGuid', params.programGuid)
  if (params.fromDate) qs.set('fromDate', params.fromDate)
  if (params.toDate) qs.set('toDate', params.toDate)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGetBlob(`/api/v1/admissions/application-filling/export/csv${suffix}`)
    .then(async ({ blob, filename }) => {
      // The endpoint's own default order is CreatedDate ASCENDING — oldest
      // first (get-export-csv.md) — and there's no sort-direction query
      // param to ask it for the reverse. Re-ordered here to newest-first
      // instead, same "newest to oldest" convention just applied to
      // Course Allocation's table, so the exported file reads consistently
      // with the rest of the app rather than needing backend support for it.
      const rows = splitCsvRows(await blob.text())
      const [header, ...dataRows] = rows
      const reordered = header !== undefined ? [header, ...dataRows.reverse()].join('\r\n') : ''
      return {
        blob: reordered ? new Blob([reordered], { type: 'text/csv' }) : blob,
        filename: filename ?? 'applications.csv',
      }
    })
}
