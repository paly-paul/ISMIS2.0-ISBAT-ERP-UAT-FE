import { apiGet, apiPut } from '../client'
import { getIntakesDropdown } from '../academic/intake'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Exam Grievance Management (exam-grievance-management-page.md). The exam
// office works through the exam grievances students raise from the portal.
// The APIs are not deployed yet, so every call has a mock branch; shapes
// follow the fields the page doc names — confirm against
// get-exam-grievances.md / get-exam-grievance.md / put-exam-grievance-status.md /
// get-exam-grievance-statuses.md once they're available.

// 1 Open · 2 Closed · 3 In Progress · 4 Pending (page doc, Business logic).
export type GrievanceStatusName = 'Open' | 'Closed' | 'InProgress' | 'Pending'

// GET /students/exam-grievances/statuses
export interface GrievanceStatusOption {
  value: number
  name: GrievanceStatusName | string
}

// Status tab filter — `Active` is Open + In Progress + Pending.
export type GrievanceStatusFilter = 'Active' | 'Open' | 'InProgress' | 'Pending' | 'Closed' | 'All'

// Payment filter — omitted for All.
export type GrievancePaymentFilter = 'Paid' | 'NotPaid'

export interface ExamGrievanceListItem {
  grievanceGuid: string
  grievanceCode: string
  grievanceDate: string
  studentGuid: string
  studentName: string | null
  studentNum: string | null
  programCode: string | null
  batchCode: string | null
  unitCode: string | null
  unitName: string | null
  status: number
  statusName: GrievanceStatusName | string
  // null = not paid.
  receiptNumber: string | null
}

export interface ExamGrievanceDetail extends ExamGrievanceListItem {
  programName: string | null
  email: string | null
  universityEmail: string | null
  phone: string | null
  // Answer booklet number for the student's UE in this unit; null until the
  // student has an exam result for the unit.
  matchingCode: string | null
  grievanceText: string
  // Latest saved response; all null until the first save.
  responseText: string | null
  respondedByName: string | null
  respondedDate: string | null
}

// Tab counts — they follow the session, payment and search filters.
export interface GrievanceSummary {
  active: number
  open: number
  inProgress: number
  pending: number
  closed: number
  all: number
}

export interface ExamGrievancesResponse {
  summary: GrievanceSummary
  grievances: {
    items: ExamGrievanceListItem[]
    totalCount: number
    pageNumber: number
    pageSize: number
  }
}

export interface ExamGrievancesParams {
  intakeGuid: string
  status: GrievanceStatusFilter
  paymentStatus?: GrievancePaymentFilter
  search?: string
  page?: number
  pageSize?: number
}

// PUT /students/exam-grievances/{grievanceGuid}/status
export interface UpdateGrievanceStatusRequest {
  status: number
  response: string
}

export interface UpdateGrievanceStatusResult {
  grievanceGuid: string
  status: number
  statusName: string
  // false when the student has neither email address — the save still worked.
  emailQueued: boolean
}

// ── Mock store (NEXT_PUBLIC_AUTH_MOCK) ─────────────────────────────────────
// All mock grievances belong to the current intake, so other sessions show
// the "none raised" empty state. Mutable so a save round-trips.

const MOCK_STATUSES: GrievanceStatusOption[] = [
  { value: 1, name: 'Open' },
  { value: 2, name: 'Closed' },
  { value: 3, name: 'InProgress' },
  { value: 4, name: 'Pending' },
]

const PROGRAMMES: Record<string, string> = {
  BIT: 'Bachelor of Information Technology',
  BBA: 'Bachelor of Business Administration',
  BSCAI: 'Bachelor of Science in Artificial Intelligence and Machine Learning',
  BNCS: 'BSc Networks and Cyber Security',
}

interface MockSeed {
  n: number
  date: string
  student: [string, string]
  prog: keyof typeof PROGRAMMES
  batch: string
  unit: [string, string]
  status: GrievanceStatusName
  receipt: string | null
  matching: string | null
  text: string
  email?: boolean // default true
  response?: [string, string, string] // text, by, date
}

const SEEDS: MockSeed[] = [
  { n: 494, date: '2026-02-21T09:10:00Z', student: ['LOJUM NATHANAEL JOSHUA', '011240294'], prog: 'BSCAI', batch: 'BSCAI&MLF24DA', unit: ['BAI2114', 'Data Communication and Networking'], status: 'Open', receipt: null, matching: '4512 4890', text: 'Remarking of my exam paper.\nI believe question 3 was not marked.' },
  { n: 493, date: '2026-02-21T08:40:00Z', student: ['AARYAN', '012240747'], prog: 'BSCAI', batch: 'BSCAI&MLF24DA', unit: ['BAI2113', 'Advanced Artificial Intelligence'], status: 'Open', receipt: '108955', matching: '4512 4852', text: 'Remarking of my exam paper.' },
  { n: 488, date: '2026-02-19T14:05:00Z', student: ['NAKIBUUKA HAJARAH', '012230213'], prog: 'BBA', batch: 'BBA-JAN24', unit: ['BBA2101', 'Financial Accounting'], status: 'InProgress', receipt: '108712', matching: '3301 2245', text: 'My mark of 38 does not reflect my performance. Please re-mark the paper.', response: ['Your paper has been sent for re-marking.', 'JOAN', '2026-02-22T10:30:00Z'] },
  { n: 481, date: '2026-02-17T11:20:00Z', student: ['BAGUMA STEPHEN', '011240168'], prog: 'BNCS', batch: 'BNCS-SEP24', unit: ['BNCS3234', 'Intellectual Property Rights'], status: 'Pending', receipt: null, matching: '5120 0071', text: 'I was marked absent for the exam although I sat it in Room B204. Please check the attendance sheet.', response: ['Please pay the grievance fee at the finance office and share the receipt number so we can proceed.', 'JOAN', '2026-02-18T09:00:00Z'] },
  { n: 476, date: '2026-02-15T16:45:00Z', student: ['ALFRED EKANYA', '012221590'], prog: 'BIT', batch: 'BIT-SEP23', unit: ['BIT2203', 'Database Systems'], status: 'Open', receipt: '108430', matching: null, text: 'My exam result for BIT2203 has not been published yet, although other units are out.' },
  { n: 470, date: '2026-02-12T10:00:00Z', student: ['KATO JOSEPH', '012220626'], prog: 'BIT', batch: 'BIT-SEP23', unit: ['BIT2116', 'Data Communication & Networking'], status: 'Closed', receipt: '108201', matching: '4471 3302', text: 'Remarking of my exam paper.', response: ['The paper was re-marked. Your mark has been revised from 41 to 52 and the result updated.', 'JOAN', '2026-02-16T12:15:00Z'] },
  { n: 466, date: '2026-02-10T13:30:00Z', student: ['AMONG GRACE', '012230118'], prog: 'BNCS', batch: 'BNCS-SEP23', unit: ['BNCS1211', 'Data and Storage Security'], status: 'InProgress', receipt: '108055', matching: '5102 9934', text: 'Two pages of my answer booklet seem to be missing from the marked script.', response: ['We are locating the full answer booklet with the examinations office.', 'MARTIN', '2026-02-12T08:45:00Z'] },
  { n: 461, date: '2026-02-08T09:25:00Z', student: ['OKELLO JAMES', '012230541'], prog: 'BBA', batch: 'BBA-SEP23', unit: ['BBA2205', 'Business Statistics'], status: 'Open', receipt: null, matching: '3388 1209', text: 'Request for re-marking. The total on the script does not match the result on the portal.', email: false },
  { n: 455, date: '2026-02-05T15:50:00Z', student: ['NANTUME BRIDGET', '012240133'], prog: 'BIT', batch: 'BIT-JAN24', unit: ['BIT1103', 'Problem Solving Methodologies Using C'], status: 'Closed', receipt: '107760', matching: '4402 5517', text: 'Remarking of my exam paper.', response: ['After re-marking, the original mark of 47 stands.', 'JOAN', '2026-02-09T11:00:00Z'] },
  { n: 449, date: '2026-02-03T08:15:00Z', student: ['ISAAC GIIR AKOL GIIR', '011250077'], prog: 'BNCS', batch: 'BNCS-JAN25', unit: ['BNCS2118', 'Introduction to IOT'], status: 'Pending', receipt: '107512', matching: '5144 7720', text: 'I need my script re-marked; I scored highly in coursework but failed the exam.', response: ['Waiting for the answer booklet from the external examiner.', 'MARTIN', '2026-02-06T14:20:00Z'] },
  { n: 442, date: '2026-01-30T12:00:00Z', student: ['TIBALIRA MARK JONATHAN', '011240512'], prog: 'BSCAI', batch: 'BSCAI&MLF24DA', unit: ['BAI2118', 'Artificial Intelligence Laboratory using Python'], status: 'Closed', receipt: '107301', matching: '4519 0083', text: 'Remarking of my practical exam.', response: ['The practical exam was re-marked. Your mark has been revised from 44 to 50.', 'JOAN', '2026-02-02T10:10:00Z'] },
  { n: 437, date: '2026-01-28T10:45:00Z', student: ['NAKATO SARAH', '012240901'], prog: 'BBA', batch: 'BBA-JAN24', unit: ['BBA2101', 'Financial Accounting'], status: 'Open', receipt: '107188', matching: '3301 2290', text: 'Remarking of my exam paper.' },
  { n: 430, date: '2026-01-25T09:30:00Z', student: ['RUHINDA DAUDI KIRENZI', '012230649'], prog: 'BIT', batch: 'BIT-SEP23', unit: ['BIT2203', 'Database Systems'], status: 'Closed', receipt: null, matching: '4475 1102', text: 'I want to withdraw my earlier complaint.', response: ['Withdrawn at the student\'s request.', 'MARTIN', '2026-01-27T15:00:00Z'] },
  { n: 426, date: '2026-01-22T14:10:00Z', student: ['CHAN ABRAHAM KUOL CHAN', '011230465'], prog: 'BNCS', batch: 'BNCS-SEP23', unit: ['BNCS3235', 'Digital Transformation and Overview'], status: 'Open', receipt: null, matching: '5130 6648', text: 'Remarking of my exam paper.' },
]

let mockStore: (ExamGrievanceDetail & { intakeGuid: string })[] | null = null

async function getMockStore() {
  if (mockStore) return mockStore
  const intakes = await getIntakesDropdown()
  const current = intakes.find(i => i.currentIntake) ?? intakes[0]
  const code = current?.intakeCode ?? 20261
  mockStore = SEEDS.map(s => {
    const st = MOCK_STATUSES.find(x => x.name === s.status)!
    const hasEmail = s.email !== false
    return {
      intakeGuid: current?.intakeGuid ?? '',
      grievanceGuid: `grv-mock-${s.n}`,
      grievanceCode: `GR${code}/${s.n}`,
      grievanceDate: s.date,
      studentGuid: `stu-mock-${s.student[1]}`,
      studentName: s.student[0],
      studentNum: s.student[1],
      programCode: s.prog,
      programName: PROGRAMMES[s.prog],
      batchCode: s.batch,
      unitCode: s.unit[0],
      unitName: s.unit[1],
      status: st.value,
      statusName: st.name,
      receiptNumber: s.receipt,
      email: hasEmail ? `${s.student[0].split(' ')[0].toLowerCase()}@gmail.com` : null,
      universityEmail: hasEmail ? `${s.student[1]}@isbatuniversity.ac.ug` : null,
      phone: `0700 ${s.student[1].slice(-6, -3)} ${s.student[1].slice(-3)}`,
      matchingCode: s.matching,
      grievanceText: s.text,
      responseText: s.response?.[0] ?? null,
      respondedByName: s.response?.[1] ?? null,
      respondedDate: s.response?.[2] ?? null,
    }
  })
  return mockStore
}

const ACTIVE = new Set<string>(['Open', 'InProgress', 'Pending'])

function matchesStatus(name: string, filter: GrievanceStatusFilter) {
  if (filter === 'All') return true
  if (filter === 'Active') return ACTIVE.has(name)
  return name === filter
}

function toListItem(g: ExamGrievanceDetail): ExamGrievanceListItem {
  const {
    programName: _p, email: _e, universityEmail: _u, phone: _ph, matchingCode: _m,
    grievanceText: _g, responseText: _r, respondedByName: _rb, respondedDate: _rd, ...item
  } = g
  return item
}

function mockError(message: string, code: string, errors?: string[]) {
  return Object.assign(new Error(message), { code, errors })
}

const delay = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 250))

// ── API ────────────────────────────────────────────────────────────────────

export function getGrievanceStatuses(): Promise<GrievanceStatusOption[]> {
  if (MOCK_AUTH) return delay(MOCK_STATUSES.map(s => ({ ...s })))
  return apiGet<GrievanceStatusOption[] | null>('/api/v1/students/exam-grievances/statuses').then(data => data ?? [])
}

export async function getExamGrievances(params: ExamGrievancesParams): Promise<ExamGrievancesResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) {
    const q = params.search?.trim().toLowerCase() ?? ''
    // Counts follow session, payment and search — not the status tab.
    const scoped = (await getMockStore())
      .filter(g => g.intakeGuid === params.intakeGuid)
      .filter(g => !params.paymentStatus || (params.paymentStatus === 'Paid') === (g.receiptNumber !== null))
      .filter(g => !q || [g.grievanceCode, g.studentNum, g.studentName, g.unitCode, g.unitName].some(v => v?.toLowerCase().includes(q)))
    const count = (f: GrievanceStatusFilter) => scoped.filter(g => matchesStatus(g.statusName, f)).length
    // Unpaid first, then oldest grievance date first.
    const items = scoped
      .filter(g => matchesStatus(g.statusName, params.status))
      .sort((a, b) => Number(a.receiptNumber !== null) - Number(b.receiptNumber !== null) || a.grievanceDate.localeCompare(b.grievanceDate))
    return delay({
      summary: { active: count('Active'), open: count('Open'), inProgress: count('InProgress'), pending: count('Pending'), closed: count('Closed'), all: count('All') },
      grievances: { items: items.slice((page - 1) * pageSize, page * pageSize).map(toListItem), totalCount: items.length, pageNumber: page, pageSize },
    })
  }
  const qs = new URLSearchParams({ intakeGuid: params.intakeGuid, status: params.status, page: String(page), pageSize: String(pageSize) })
  if (params.paymentStatus) qs.set('paymentStatus', params.paymentStatus)
  if (params.search?.trim()) qs.set('search', params.search.trim().slice(0, 100))
  return apiGet<ExamGrievancesResponse | null>(`/api/v1/students/exam-grievances?${qs}`)
    .then(data => data ?? {
      summary: { active: 0, open: 0, inProgress: 0, pending: 0, closed: 0, all: 0 },
      grievances: { items: [], totalCount: 0, pageNumber: page, pageSize },
    })
}

export async function getExamGrievance(grievanceGuid: string): Promise<ExamGrievanceDetail> {
  if (MOCK_AUTH) {
    const g = (await getMockStore()).find(x => x.grievanceGuid === grievanceGuid)
    if (!g) throw mockError('Grievance not found.', 'not_found')
    const { intakeGuid: _i, ...detail } = g
    return delay(detail)
  }
  return apiGet<ExamGrievanceDetail>(`/api/v1/students/exam-grievances/${grievanceGuid}`)
}

export async function updateExamGrievanceStatus(grievanceGuid: string, payload: UpdateGrievanceStatusRequest): Promise<UpdateGrievanceStatusResult> {
  if (MOCK_AUTH) {
    const g = (await getMockStore()).find(x => x.grievanceGuid === grievanceGuid)
    if (!g) throw mockError('Grievance not found.', 'not_found')
    const status = MOCK_STATUSES.find(s => s.value === payload.status)
    const errors: string[] = []
    if (!status) errors.push('Select a status.')
    if (!payload.response.trim()) errors.push('Enter a response for the student.')
    else if (payload.response.length > 5000) errors.push('Response must be 5000 characters or fewer.')
    if (errors.length) throw mockError(errors[0], 'validation_error', errors)
    Object.assign(g, {
      status: status!.value,
      statusName: status!.name,
      responseText: payload.response,
      respondedByName: 'JOAN',
      respondedDate: new Date().toISOString(),
    })
    return delay({ grievanceGuid, status: status!.value, statusName: status!.name, emailQueued: !!(g.email || g.universityEmail) })
  }
  return apiPut<UpdateGrievanceStatusResult>(`/api/v1/students/exam-grievances/${grievanceGuid}/status`, payload)
}
