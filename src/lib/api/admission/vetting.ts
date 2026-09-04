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
  // Confirmed via a real authenticated response: comes back as a raw int
  // (e.g. 0), NOT the "Male"/"Female"/"Other" string the docs describe —
  // same "int-encoded enum, no confirmed label mapping" caution as
  // enquiry.ts's enquiryStatus. Display raw, don't guess a mapping.
  gender: number | null
  // Always null today — ApplicationEntity.CountryGuid has no matching guid
  // on the Academic side. Kept typed so a future backend fix "just works",
  // but don't build UI that assumes this is ever populated right now.
  nationality: string | null
  nationalId: string | null
  phone: string | null
  emailId: string | null
  admissionType: string
  programGuid: string
  programName: string
  intakeGuid: string
  // Confirmed via a real authenticated response: the docs' sample shows
  // `intakeName`, but the real payload has no such field at all — only
  // `intakeCode` (e.g. "20222"), same shape as the queue list's own
  // programName/programCode split elsewhere in this app.
  intakeCode: string
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
  { intApplication: 1041, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000041', appRefNo: 'APP-2025-0041', studentName: 'Nakato Sarah',     programGuid: 'prog-bscs', programName: 'BSc Computer Science',            type: 'Direct', documentsUploaded: 3, documentsTotal: 4, submittedDate: new Date(Date.now() - 6 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1042, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000042', appRefNo: 'APP-2025-0042', studentName: 'Ouma Brian',        programGuid: 'prog-bba',  programName: 'BBA Accounting',                   type: 'ODL',    documentsUploaded: 4, documentsTotal: 4, submittedDate: new Date(Date.now() - 5 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1043, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000043', appRefNo: 'APP-2025-0043', studentName: 'Ainembabazi Grace', programGuid: 'prog-bsit', programName: 'BSc Information Technology',      type: 'Direct', documentsUploaded: 4, documentsTotal: 4, submittedDate: new Date(Date.now() - 4 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1044, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000044', appRefNo: 'APP-2025-0044', studentName: 'Mugisha David',     programGuid: 'prog-dba',  programName: 'Diploma in Business Admin',       type: 'Direct', documentsUploaded: 2, documentsTotal: 4, submittedDate: new Date(Date.now() - 3 * 3600_000).toISOString(), action: 1 },
  { intApplication: 1045, applicationGuid: 'a1b2c3d4-vet-0000-0000-000000000045', appRefNo: 'APP-2025-0045', studentName: 'Kyomuhendo Faith',  programGuid: 'prog-bscs', programName: 'BSc Computer Science',            type: 'Direct', documentsUploaded: 4, documentsTotal: 4, submittedDate: new Date(Date.now() - 1 * 3600_000).toISOString(), action: 1 },
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
    intakeGuid: 'intake-mock',
    intakeCode: '20261',
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
  console.log('[vetting API] getVettingQueue request', { url, page, pageSize, filters })
  return apiGet<VettingQueueResponse | null>(url)
    .then(data => {
      const result = data ?? { items: [], totalCount: 0, pageNumber: page, pageSize, summary: { pendingCount: 0, oldestSubmittedDate: null } }
      console.log('[vetting API] getVettingQueue response', result)
      return result
    })
}

export function getVettingApplicationDetail(applicationGuid: string): Promise<VettingApplicationDetail> {
  if (MOCK_AUTH) {
    const found = mockDetails[applicationGuid]
    if (!found) return Promise.reject(new Error('Application not found'))
    console.log('[vetting API] getVettingApplicationDetail mock', { applicationGuid })
    return Promise.resolve(found)
  }
  const url = `/api/v1/admissions/vetting/applications/${applicationGuid}`
  console.log('[vetting API] getVettingApplicationDetail request', { url, applicationGuid })
  return apiGet<VettingApplicationDetail>(url)
    .then(data => {
      console.log('[vetting API] getVettingApplicationDetail response', { applicationGuid, data })
      return data
    })
}

// Non-terminal — sets action=0 (Waiting), which drops the application out of
// the Submitted-only (action==1) vetting queue.
export function waitApplication(applicationGuid: string, remarks?: string | null): Promise<boolean> {
  if (MOCK_AUTH) {
    console.debug('[vetting API] waitApplication mock', { applicationGuid, remarks })
    return Promise.resolve(true)
  }
  const url = `/api/v1/admissions/vetting/applications/${applicationGuid}/wait`
  console.debug('[vetting API] waitApplication request', { url, applicationGuid, remarks })
  return apiPost<boolean>(url, { remarks: remarks ?? null })
    .then(result => {
      console.debug('[vetting API] waitApplication response', { applicationGuid, result })
      return result
    })
}

// Terminal Approve/Reject. Note this hits Application Filling's base path,
// not Vetting's — confirmed in VettingApiDocs.md ("lives in Application
// Filling, not Vetting").
export function vetApplication(applicationGuid: string, input: VetApplicationInput): Promise<VetApplicationResponse> {
  if (MOCK_AUTH) {
    console.debug('[vetting API] vetApplication mock', { applicationGuid, input })
    const item = mockQueue.find(i => i.applicationGuid === applicationGuid)
    return Promise.resolve({ intApplication: item?.intApplication ?? 0, appRefNo: item?.appRefNo ?? '', action: input.action })
  }
  const url = `/api/v1/admissions/application-filling/${applicationGuid}/vet`
  console.debug('[vetting API] vetApplication request', { url, applicationGuid, input })
  return apiPost<VetApplicationResponse>(url, input)
    .then(result => {
      console.debug('[vetting API] vetApplication response', { applicationGuid, result })
      return result
    })
}
