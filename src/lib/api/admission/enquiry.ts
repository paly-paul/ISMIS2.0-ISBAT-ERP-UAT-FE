import { apiGet, apiPost, apiPut } from '../client'

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
  remarks: string | null
  programGuid: string | null
  // Isbat Enquiry Source guid (enquirySource.ts's isbatSourceGuid) — a
  // genuinely different master from enquirySourceGuid above. Confirmed as
  // a guid field (not the previously-assumed unconfirmed int), but the
  // create forms don't have an Isbat Enquiry Source picker, so this is
  // still always sent null.
  isbatSourceGuid: string | null
  // enquirySourceName from the (separate) Enquiry Source master.
  sourceName: string | null
  enquiryTag: string | null
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
  dob: string
  remarks: string | null
  programGuid: string | null
  advisorGuid: string | null
  followUpStatusGuid: string | null
  enquiryStatusGuid: string | null
  nextFollowDate: string | null
  enquiryTag: string | null
  isbatSourceGuid: string | null
  sourceName: string | null
  campusName: string | null
  campusCode: string | null
  programName: string | null
  programCode: string | null
  enquiryStatusName: string | null
  enquiryStatusCode: string | null
  followUpStatusName: string | null
  followUpStatusCode: string | null
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

// Confirmed via Update.bru — a materially different, narrower shape than
// EnquiryInput: "assign advisor, change status, assign program/campus."
// All fields optional except campusGuid per the docs. enquiryStatus is
// deliberately left out — it's a number with no confirmed source (the
// Enquiry Status master only exposes a guid) — until that's resolved.
export interface EnquiryUpdateInput {
  advisorGuid?: string | null
  programGuid?: string | null
  campusGuid: string
}

let mockEnquirySeq = 1

// In-memory list used only when mock auth is enabled, so the list query has
// something to show after a mock create.
const mockEnquiries: Enquiry[] = []

export function createEnquiry(input: EnquiryInput): Promise<unknown> {
  if (MOCK_AUTH) {
    const enquiry: Enquiry = {
      enquiryGuid: String(mockEnquirySeq),
      enquiryCode: `EQ-MOCK-${mockEnquirySeq++}`,
      intakeGuid: input.intakeGuid,
      campusGuid: input.campusGuid,
      enquirySourceGuid: input.enquirySourceGuid,
      studentName: input.studentName,
      enquiryDate: input.enquiryDate,
      mobile: input.mobile,
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
  return apiPost<unknown>('/api/v1/admissions/enquiries', input)
}

// List query for the enquiry-list page. Real: paginated, page/pageSize
// passed straight through (confirmed via List.bru + a real sample response).
export function getEnquiries(page = 1, pageSize = 10): Promise<EnquiryListResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({ items: mockEnquiries, totalCount: mockEnquiries.length, pageNumber: page, pageSize })
  }
  return apiGet<EnquiryListResult | null>(`/api/v1/admissions/enquiries?page=${page}&pageSize=${pageSize}`)
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

// Assign advisor/programme/campus and (once confirmed) status on an
// existing enquiry.
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
