import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via VettingApiDocs.md — GET /api/v1/admissions/vetting/applications.
// `type` is "Direct" or "ODL" only; there is no "Transfer" value anywhere on
// the wire (the old mock UI's "Transfer" badge was fabricated).
export interface VettingQueueItem {
  intApplication: number
  applicationGuid: string
  appRefNo: string
  studentName: string
  programGuid: string
  programName: string
  intakeGuid?: string
  intakeName?: string
  intakeCode?: string
  intake?: string
  type: string
  documentsUploaded: number
  documentsTotal: number
  submittedDate: string
  action: number | null
}

export interface VettingQueueSummary {
  pendingCount: number
  oldestSubmittedDate: string | null
}

interface VettingQueueResponse {
  items: VettingQueueItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
  summary: VettingQueueSummary
}

export interface VettingDocument {
  documentType: string
  uploaded: boolean
  url: string | null
}

export interface VettingQualification {
  intApplicationQual: number
  applicationQualGuid: string
  institution: string
  university: string
  passYear: number
  grade: string
  yearsTaken: number
  proofUserFileName: string | null
  proofUrl: string | null
}

// Confirmed via GET /api/v1/admissions/vetting/applications/{guid}. Fields
// deliberately NOT included here because they don't exist on the wire (see
// VettingApiDocs.md "Fields that do not exist"): Address, a structured
// Qualification "Type", Index No, and any Family/Guardian entity — don't
// add UI for any of these without a fresh confirmed response.
export interface VettingApplicationDetail {
  intApplication: number
  applicationGuid: string
  appRefNo: string
  firstName: string
  lastName: string
  dob: string | null
  // Seen both as a raw int (e.g. 0) and, in the 2026-10 country-fields
  // handoff sample, as the "Male"/"Female" label. Displayed as-is.
  gender: number | string | null
  // Looked up from the application's countryGuid (2026-10). nationality is
  // the demonym ("Ugandan"); countryName the country ("Uganda"). Use
  // countryGuid as the key, never the name. All three null when the
  // application has no country.
  countryGuid?: string | null
  countryName?: string | null
  nationality: string | null
  nationalId: string | null
  phone: string | null
  emailId: string | null
  admissionType: string
  programGuid: string
  programName: string
  intakeGuid: string
  intakeName?: string | null
  intakeCode?: string | null
  intake?: string | null
  campusGuid: string
  campusName: string
  submittedDate: string
  spName: string | null
  spEmail: string | null
  spPhone: string | null
  vStartDate: string | null
  vEndDate: string | null
  semesterGuid: string | null
  batchGuid: string | null
  batchTimeGuid: string | null
  feeHdGuid: string | null
  action: number | null
  justificationReg: string | null
  approveDateReg: string | null
  // Generic "documents verified" flag auto-set on Approve — not
  // qualification-specific, not UNEB-specific (see docs).
  docVerified: boolean | null
  verifiedDate: string | null
  docRemarks: string | null
  // Existence of a non-deleted payment/exemption row — not a status enum.
  // Confirmed via a real response that this key is entirely absent when
  // false (a common ASP.NET default-value JSON omission) — `detail.feePaid`
  // reading as `undefined` in that case still renders correctly as "No"
  // wherever it's used with a truthy check, so no `?? false` guard needed.
  feePaid: boolean
  documents: VettingDocument[]
  qualifications: VettingQualification[]
}

// The request's own action now matches the persisted `action` byte the
// response echoes back (EnumApplicationStatus: 2=Approved, 3=Rejected) —
// previously a separate RegistrarAction enum (1=Approved, 2=Rejected) with
// its own numbering; both sides now use the same 2/3 values.
export type RegistrarDecision = 2 | 3

export interface VetApplicationInput {
  action: RegistrarDecision
  // Required by the backend when action = 3 (Rejected); optional otherwise.
  justificationReg?: string | null
}

export interface VetApplicationResponse {
  intApplication: number
  appRefNo: string
  action: number
}

const mockQueue: VettingQueueItem[] = [
  { intApplication: 1041, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000041', appRefNo: 'APP-2025-0041', studentName: 'Nakato Sarah',     programGuid: 'prog-bscs', programName: 'BSc Computer Science',       intakeGuid: 'a1b2c3d4-0000-4000-8000-000000000002', intakeName: 'January 2026', intakeCode: '20261',     type: 'Direct', documentsUploaded: 3, documentsTotal: 4, submittedDate: new Date(Date.now() - 6 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1042, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000042', appRefNo: 'APP-2025-0042', studentName: 'Ouma Brian',        programGuid: 'prog-bba',  programName: 'BBA Accounting',              intakeGuid: 'a1b2c3d4-0000-4000-8000-000000000002', intakeName: 'January 2026', intakeCode: '20261',     type: 'ODL',    documentsUploaded: 4, documentsTotal: 4, submittedDate: new Date(Date.now() - 5 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1043, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000043', appRefNo: 'APP-2025-0043', studentName: 'Ainembabazi Grace', programGuid: 'prog-bsit', programName: 'BSc Information Technology', intakeGuid: 'a1b2c3d4-0000-4000-8000-000000000001', intakeName: 'May 2026',     intakeCode: '20262',     type: 'Direct', documentsUploaded: 4, documentsTotal: 4, submittedDate: new Date(Date.now() - 4 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1044, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000044', appRefNo: 'APP-2025-0044', studentName: 'Mugisha David',     programGuid: 'prog-dba',  programName: 'Diploma in Business Admin',  intakeGuid: 'a1b2c3d4-0000-4000-8000-000000000002', intakeName: 'January 2026', intakeCode: '20261',     type: 'Direct', documentsUploaded: 2, documentsTotal: 4, submittedDate: new Date(Date.now() - 3 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1045, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000045', appRefNo: 'APP-2025-0045', studentName: 'Kyomuhendo Faith',  programGuid: 'prog-bscs', programName: 'BSc Computer Science',       intakeGuid: 'a1b2c3d4-0000-4000-8000-000000000001', intakeName: 'May 2026',     intakeCode: '20262',     type: 'Direct', documentsUploaded: 4, documentsTotal: 4, submittedDate: new Date(Date.now() - 1 * 3600_000).toISOString(), action: 1 },
]

const mockDetails: Record<string, VettingApplicationDetail> = Object.fromEntries(
  mockQueue.map(q => [q.applicationGuid, {
    intApplication: q.intApplication,
    applicationGuid: q.applicationGuid,
    appRefNo: q.appRefNo,
    firstName: q.studentName.split(' ')[0] ?? q.studentName,
    lastName: q.studentName.split(' ').slice(1).join(' '),
    dob: '2005-03-12T00:00:00',
    gender: 0,
    nationality: null,
    nationalId: 'CM05031201234',
    phone: '+256700000000',
    emailId: `${q.studentName.split(' ')[0]?.toLowerCase()}@example.com`,
    admissionType: q.type,
    programGuid: q.programGuid,
    programName: q.programName,
    intakeGuid: q.intakeGuid ?? 'intake-mock',
    intakeName: q.intakeName ?? 'January 2026',
    intakeCode: q.intakeCode ?? '20261',
    campusGuid: 'campus-mock',
    campusName: 'Main Campus',
    submittedDate: q.submittedDate,
    spName: null,
    spEmail: null,
    spPhone: null,
    vStartDate: null,
    vEndDate: null,
    semesterGuid: null,
    batchGuid: null,
    batchTimeGuid: null,
    feeHdGuid: null,
    action: q.action,
    justificationReg: null,
    approveDateReg: null,
    docVerified: null,
    verifiedDate: null,
    docRemarks: null,
    feePaid: true,
    documents: [
      { documentType: 'NationalId', uploaded: q.documentsUploaded >= 1, url: q.documentsUploaded >= 1 ? 'https://example.com/mock.pdf' : null },
      { documentType: 'Passport', uploaded: q.documentsUploaded >= 2, url: q.documentsUploaded >= 2 ? 'https://example.com/mock.pdf' : null },
      { documentType: 'Photo', uploaded: q.documentsUploaded >= 3, url: q.documentsUploaded >= 3 ? 'https://example.com/mock.jpg' : null },
    ],
    qualifications: [
      { intApplicationQual: 1, applicationQualGuid: `${q.applicationGuid}-q1`, institution: 'O Level', university: 'Some High School', passYear: 2020, grade: 'Div 2', yearsTaken: 4, proofUserFileName: 'cert.pdf', proofUrl: q.documentsUploaded >= 4 ? 'https://example.com/mock.pdf' : null },
    ],
  } satisfies VettingApplicationDetail]),
)

// Backs /admission/vetting's queue table. appRefNo is an exact-match filter
// and studentName a partial match on the backend — sending the same typed
// search term as studentName (partial match is more forgiving for a single
// search box) rather than appRefNo.
export function getVettingQueue(page = 1, pageSize = 10, filters?: { appRefNo?: string; studentName?: string }): Promise<VettingQueueResponse> {
  if (MOCK_AUTH) {
    let items = mockQueue
    if (filters?.appRefNo) items = items.filter(i => i.appRefNo === filters.appRefNo)
    if (filters?.studentName) items = items.filter(i => i.studentName.toLowerCase().includes(filters.studentName!.toLowerCase()))
    return Promise.resolve({
      items,
      totalCount: items.length,
      pageNumber: page,
      pageSize,
      summary: {
        pendingCount: mockQueue.length,
        oldestSubmittedDate: mockQueue.reduce<string | null>((oldest, i) => (!oldest || i.submittedDate < oldest ? i.submittedDate : oldest), null),
      },
    })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters?.appRefNo) params.set('appRefNo', filters.appRefNo)
  if (filters?.studentName) params.set('studentName', filters.studentName)
  const url = `/api/v1/admissions/vetting/applications?${params.toString()}`
  return apiGet<VettingQueueResponse | null>(url)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize, summary: { pendingCount: 0, oldestSubmittedDate: null } })
}

export function getVettingApplicationDetail(applicationGuid: string): Promise<VettingApplicationDetail> {
  if (MOCK_AUTH) {
    const found = mockDetails[applicationGuid]
    if (!found) return Promise.reject(new Error('Application not found'))
    return Promise.resolve(found)
  }
  return apiGet<VettingApplicationDetail>(`/api/v1/admissions/vetting/applications/${applicationGuid}`)
}

// Non-terminal — sets action=0 (Waiting), which drops the application out of
// the Submitted-only (action==1) vetting queue.
export function waitApplication(applicationGuid: string, remarks?: string | null): Promise<boolean> {
  if (MOCK_AUTH) {
    return Promise.resolve(true)
  }
  const url = `/api/v1/admissions/vetting/applications/${applicationGuid}/wait`
  return apiPost<boolean>(url, { remarks: remarks ?? null })
}

// Server messages when Approve (action 2) is refused (2026-10 handoff): only
// applications — and so payments — of the current admission intake can be
// approved. Reject (action 3) has no such restriction.
export const NOT_CURRENT_INTAKE_MESSAGE = 'Only applications and payments of the current admission intake can be approved.'
export const NO_CURRENT_INTAKE_MESSAGE = 'No current admission intake is configured.'

// Terminal Approve/Reject. Note this hits Application Filling's base path,
// not Vetting's — confirmed in VettingApiDocs.md ("lives in Application
// Filling, not Vetting").
export function vetApplication(applicationGuid: string, input: VetApplicationInput): Promise<VetApplicationResponse> {
  if (MOCK_AUTH) {
    const item = mockQueue.find(i => i.applicationGuid === applicationGuid)
    if (input.action === 2 && item?.intakeGuid !== 'a1b2c3d4-0000-4000-8000-000000000002') {
      return Promise.reject(new Error(NOT_CURRENT_INTAKE_MESSAGE))
    }
    return Promise.resolve({ intApplication: item?.intApplication ?? 0, appRefNo: item?.appRefNo ?? '', action: input.action })
  }
  const url = `/api/v1/admissions/application-filling/${applicationGuid}/vet`
  return apiPost<VetApplicationResponse>(url, input)
}

// ---- Rejections (GET /api/v1/admissions/vetting/rejections) ----
// Backs the Vetting Desk's "Rejections" tab so staff can follow up with the
// candidate on the reason. Newest rejection first, paged.

export interface VettingRejectionItem {
  applicationGuid: string
  appRefNo: string
  studentName: string
  phone: string | null
  emailId: string | null
  programGuid: string
  programName: string
  // "Direct" or "ODL"
  type: string
  submittedDate: string | null
  rejectedDate: string | null
  rejectionReason: string | null
}

export interface VettingRejectionFilters {
  // Exact match on ref no / phone / email, or contains on applicant name.
  search?: string
  intakeGuid?: string
  campusGuid?: string
  programGuid?: string
}

export interface VettingRejectionsResponse {
  items: VettingRejectionItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockRejections: VettingRejectionItem[] = [
  { applicationGuid: 'a1b2c3d4-rej-0000-0000-000000000031', appRefNo: 'APP-2025-0031', studentName: 'Namuli Esther',  phone: '256772100031', emailId: 'esther.n@example.com', programGuid: 'prog-bscs', programName: 'BSc Computer Science', type: 'Direct', submittedDate: new Date(Date.now() - 9 * 86400_000).toISOString(), rejectedDate: new Date(Date.now() - 1 * 86400_000).toISOString(), rejectionReason: 'O-Level certificate is unreadable. Ask the candidate to upload a clearer scan.' },
  { applicationGuid: 'a1b2c3d4-rej-0000-0000-000000000027', appRefNo: 'APP-2025-0027', studentName: 'Okello James',   phone: '256701200027', emailId: null,                   programGuid: 'prog-bba',  programName: 'BBA Accounting',       type: 'ODL',    submittedDate: new Date(Date.now() - 20 * 86400_000).toISOString(), rejectedDate: new Date(Date.now() - 6 * 86400_000).toISOString(), rejectionReason: 'Does not meet the minimum entry requirement (2 principal passes).' },
]

export function getVettingRejections(page = 1, pageSize = 10, filters?: VettingRejectionFilters): Promise<VettingRejectionsResponse> {
  if (MOCK_AUTH) {
    const term = filters?.search?.trim().toLowerCase()
    const items = mockRejections.filter(r => !term
      || [r.appRefNo, r.phone, r.emailId].some(v => v?.toLowerCase() === term)
      || r.studentName.toLowerCase().includes(term))
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters?.search?.trim()) params.set('search', filters.search.trim())
  if (filters?.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters?.campusGuid) params.set('campusGuid', filters.campusGuid)
  if (filters?.programGuid) params.set('programGuid', filters.programGuid)
  return apiGet<VettingRejectionsResponse | null>(`/api/v1/admissions/vetting/rejections?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}
