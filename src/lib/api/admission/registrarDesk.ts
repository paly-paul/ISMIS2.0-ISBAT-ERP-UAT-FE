import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via registrar-desk-api-docs.html — GET
// /api/v1/admissions/registrar-desk/applications. regPaid gates the
// Register action client-side (a UX convenience — POST /register
// independently re-checks this server-side, so it's not the source of
// truth). There is no admission-type field on this list DTO at all — don't
// add a column for one without a confirmed source.
export interface RegistrarDeskQueueItem {
  applicationGuid: string
  appRefNo: string
  studentName: string
  programName: string
  intakeName: string
  regPaid: boolean
}

interface RegistrarDeskQueueResult {
  items: RegistrarDeskQueueItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// EnumApplicationStatus, scoped to this desk's own queue filter — the
// registrar desk only ever expects RegistrarVetted (2) in the queue and
// only ever moves an application to Registered (4).
export const REGISTRAR_APPLICATION_STATUS = {
  Received: 1,
  RegistrarVetted: 2,
  RejectedByRegistrar: 3,
  Registered: 4,
} as const

export interface RegistrarDeskQueueFilters {
  appRefNo?: string
  studentName?: string
  email?: string
  phone?: string
  programGuid?: string
  intakeGuid?: string
  intakeName?: string
  status?: number
}

export interface RegistrarDeskCounts {
  regFeePaidCount: number
  regFeeNotPaidCount: number
  registeredCount: number
}

export interface RegistrationFeeLine {
  ledgerGuid: string
  ledgerName: string
  ledgerNum: number
  currencyName: string
  amount: number
}

// Confirmed via registrar-desk-api-docs.html — GET
// /registrar-desk/applications/{guid}/registration-detail. admissionTypes
// is returned but deliberately unused: the frontend notes explicitly say to
// drop Admission Type from both the Personal Information and Application
// Detail cards on this screen. Everything under "Registration payment &
// readiness" (regPaymentTypeName..academicDocumentsVerified) is a read-out
// of what already happened in Payment Console — render as plain labels,
// never as editable inputs; same for semesterName/batchName.
export interface RegistrationDetail {
  appRefNo: string
  studentName: string
  firstName: string | null
  lastName: string | null
  dob: string | null
  gender: string | null
  countryGuid: string | null
  nationality: string | null
  nationalId: string | null
  phone: string | null
  emailId: string | null
  submitted: string
  campusName: string | null
  intakeCode: string | null
  intakeGuid: string | null
  programName: string | null
  semesterName: string | null
  batchName: string | null
  refugee: boolean
  refugeeId: string | null
  admissionTypes: unknown[]
  admissionFee: number | null
  regFee: number | null
  feeLines: RegistrationFeeLine[]
  regPaymentTypeName: string | null
  regReceiptBookCode: string | null
  regReceiptNo: string | null
  regPaymentAmount: number | null
  regPaymentDate: string | null
  provisionalLetterIssued: boolean
  registrationFeeConfirmed: boolean
  academicDocumentsVerified: boolean
}

export interface RegisterStudentInput {
  registrationTypeId: number
  isRefugee: boolean
  refugeeId: string | null
  aptech: boolean
}

export interface RegisterStudentResponse {
  studentGuid: string
  registrationNumber: string
  studentNumber: string
  username: string
  studentName: string
  email: string
  applicationGuid: string
}

const mockQueue: RegistrarDeskQueueItem[] = [
  { applicationGuid: 'reg-mock-0019', appRefNo: 'ADM-26-0019', studentName: 'Esther Tumukunde', programName: 'BSc Computer Science',       intakeName: 'Spring 2026', regPaid: true },
  { applicationGuid: 'reg-mock-0017', appRefNo: 'ADM-26-0017', studentName: 'Grace Nampijja',   programName: 'BBA Business Administration', intakeName: 'Fall 2026',   regPaid: true },
  { applicationGuid: 'reg-mock-0016', appRefNo: 'ADM-26-0016', studentName: 'James Okello',      programName: 'BSc Information Technology',  intakeName: 'Spring 2026', regPaid: false },
]

const mockDetails: Record<string, RegistrationDetail> = Object.fromEntries(
  mockQueue.map(q => [q.applicationGuid, {
    appRefNo: q.appRefNo,
    studentName: q.studentName,
    firstName: q.studentName.split(' ')[0] ?? q.studentName,
    lastName: q.studentName.split(' ').slice(1).join(' '),
    dob: '2005-02-22T00:00:00',
    gender: 'Female',
    countryGuid: null,
    nationality: 'Ugandan',
    nationalId: 'CM05022212345',
    phone: '+256701556234',
    emailId: `${q.studentName.split(' ')[0]?.toLowerCase()}@example.com`,
    submitted: new Date(Date.now() - 21 * 86_400_000).toISOString(),
    campusName: 'Main Campus',
    intakeCode: '20261',
    intakeGuid: 'intake-mock',
    programName: q.programName,
    semesterName: 'Semester 1',
    batchName: 'BSCVFXS27DA',
    refugee: false,
    refugeeId: null,
    admissionTypes: [],
    admissionFee: 250,
    regFee: 250,
    feeLines: [
      { ledgerGuid: 'ledger-mock-1', ledgerName: 'Registration Fee', ledgerNum: 1, currencyName: 'US Dollars', amount: 250 },
      { ledgerGuid: 'ledger-mock-2', ledgerName: 'Library / IT Levy', ledgerNum: 2, currencyName: 'Uganda Shillings', amount: 150000 },
    ],
    regPaymentTypeName: q.regPaid ? 'Cash' : null,
    regReceiptBookCode: q.regPaid ? 'RB-2026-001' : null,
    regReceiptNo: q.regPaid ? 'RCT-0001' : null,
    regPaymentAmount: q.regPaid ? 250 : null,
    regPaymentDate: q.regPaid ? new Date(Date.now() - 2 * 86_400_000).toISOString() : null,
    provisionalLetterIssued: true,
    registrationFeeConfirmed: q.regPaid,
    academicDocumentsVerified: true,
  } satisfies RegistrationDetail]),
)

export function getRegistrarDeskApplications(page = 1, pageSize = 10, filters?: RegistrarDeskQueueFilters): Promise<RegistrarDeskQueueResult> {
  if (MOCK_AUTH) {
    let items = mockQueue
    if (filters?.appRefNo) items = items.filter(i => i.appRefNo === filters.appRefNo)
    if (filters?.studentName) items = items.filter(i => i.studentName.toLowerCase().includes(filters.studentName!.toLowerCase()))
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (filters?.appRefNo) params.set('appRefNo', filters.appRefNo)
  if (filters?.studentName) params.set('studentName', filters.studentName)
  if (filters?.email) params.set('email', filters.email)
  if (filters?.phone) params.set('phone', filters.phone)
  if (filters?.programGuid) params.set('programGuid', filters.programGuid)
  if (filters?.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters?.intakeName) params.set('intakeName', filters.intakeName)
  if (filters?.status != null) params.set('status', String(filters.status))
  return apiGet<RegistrarDeskQueueResult | null>(`/api/v1/admissions/registrar-desk/applications?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getRegistrarDeskCounts(): Promise<RegistrarDeskCounts> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      regFeePaidCount: mockQueue.filter(i => i.regPaid).length,
      regFeeNotPaidCount: mockQueue.filter(i => !i.regPaid).length,
      registeredCount: 0,
    })
  }
  return apiGet<RegistrarDeskCounts | null>('/api/v1/admissions/registrar-desk/applications/counts')
    .then(data => data ?? { regFeePaidCount: 0, regFeeNotPaidCount: 0, registeredCount: 0 })
}

export function getRegistrationDetail(applicationGuid: string): Promise<RegistrationDetail> {
  if (MOCK_AUTH) {
    const found = mockDetails[applicationGuid]
    if (!found) return Promise.reject(new Error('Application not found'))
    return Promise.resolve(found)
  }
  return apiGet<RegistrationDetail>(`/api/v1/admissions/registrar-desk/applications/${applicationGuid}/registration-detail`)
}

// On success the application flips to Registered server-side — callers
// should invalidate/refetch the queue (see useRegisterStudent) so it drops
// out of the RegistrarVetted-only list. Known server-side rejections (all
// surfaced as errors[0], HTTP 400) are listed in registrar-desk-api-docs.html
// — already human-readable registrar-facing messages, shown as-is via
// AuthError, no client-side translation needed.
export function registerStudent(applicationGuid: string, input: RegisterStudentInput): Promise<RegisterStudentResponse> {
  if (MOCK_AUTH) {
    const item = mockQueue.find(i => i.applicationGuid === applicationGuid)
    const detail = mockDetails[applicationGuid]
    return Promise.resolve({
      studentGuid: crypto.randomUUID(),
      registrationNumber: `REG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      studentNumber: `S${String(Math.floor(10000000 + Math.random() * 89999999))}`,
      username: (item?.studentName ?? 'student').toLowerCase().replace(/\s+/g, '.'),
      studentName: item?.studentName ?? '',
      email: detail?.emailId ?? '',
      applicationGuid,
    })
  }
  return apiPost<RegisterStudentResponse>(`/api/v1/admissions/registrar-desk/applications/${applicationGuid}/register`, input)
}
