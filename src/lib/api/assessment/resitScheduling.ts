import { apiGet, apiPost, apiPut, AuthError } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Resit Scheduling (resit-scheduling-page.md) — University Exam, Class Test
// and Coursework schedules for the active resit of the current intake.

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface ResitContextDto {
  resitConfigGuid: string
  refCode: string
  academicIntakeGuid: string
}

export interface ResitScheduleListItemDto {
  resitScheduleGuid: string
  courseUnitGuid: string
  unitCode: string
  unitName: string
  ueType: number // 0 Theory, 1 Practical
  examDate: string | null
  startTime: string | null
  endTime: string | null
  maxMark: number | null
  examType: number | null // 0 Online, 1 Offline
  publishStatus: number // 1 Published, 0 Not published
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface ResitSchedulesResponse {
  resit: ResitContextDto | null
  schedules: PagedResult<ResitScheduleListItemDto>
}

export interface ResitScheduleCourseUnitDto {
  courseUnitGuid: string
  unitCode: string
  unitName: string
  isTheoryPracticalUnit: boolean
  theoryScheduled: boolean
  practicalScheduled: boolean
}

export interface ResitScheduleSaveCommand {
  courseUnitGuid?: string // only for create
  ueType?: number // only for create
  examDate: string
  startTime: string
  endTime: string
  maxMark: number
  examType: number
  publishStatus: number
  examRuleGuid: string
}

export interface ResitScheduleDetailDto extends ResitScheduleListItemDto {
  marksEntered: boolean
}

export interface ResitCwScheduleDto {
  resitCourseworkScheduleGuid: string
  startDateTime: string
  endDateTime: string
  testType: number // 0 Online, 1 Offline
  publishStatus: number
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface ResitCwScheduleResponse {
  resit: ResitContextDto | null
  schedule: ResitCwScheduleDto | null
  studentsStarted: number
  locked: boolean
}

export interface ResitCwScheduleSaveCommand {
  startDateTime: string
  endDateTime: string
  testType: number
  publishStatus: number
  examRuleGuid: string
}

export interface ResitCtScheduleDto {
  resitClassTestScheduleGuid: string
  startDateTime: string
  endDateTime: string
  durationMinutes: number
  testType: number
  publishStatus: number
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface ResitCtScheduleResponse {
  resit: ResitContextDto | null
  schedule: ResitCtScheduleDto | null
  studentsStarted: number
  locked: boolean
}

export interface ResitCtScheduleSaveCommand {
  startDateTime: string
  endDateTime: string
  durationMinutes: number
  testType: number
  publishStatus: number
  examRuleGuid: string
}

// ── Mock store (NEXT_PUBLIC_AUTH_MOCK) ─────────────────────────────────────
// Keeps state across calls and follows the page's business rules, so every
// flow can be tried: duplicate unit/part (409), marks entered (409 on rule or
// mark change), Class Test locked after start (409 on locked fields),
// Coursework not yet scheduled (tab dot).

// Same guid as the exam-rule mock, so the picker shows the saved rule.
const MOCK_RULE = { examRuleGuid: 'f7739fed-421b-48ca-9c02-7f5fa1e514ce', examRuleCode: 'R101', examRuleName: 'Standard MCQ Test' }
const MOCK_RESIT: ResitContextDto = { resitConfigGuid: 'rs-cfg-1', refCode: 'Resit Spring 2026', academicIntakeGuid: 'rs-intake-1' }

interface MockUnit { courseUnitGuid: string; unitCode: string; unitName: string; isTheoryPracticalUnit: boolean }
const MOCK_UNITS: MockUnit[] = [
  { courseUnitGuid: 'rs-cu-01', unitCode: 'BFX2221', unitName: 'Motion Design', isTheoryPracticalUnit: true },
  { courseUnitGuid: 'rs-cu-02', unitCode: 'BIT2203', unitName: 'Database Systems', isTheoryPracticalUnit: true },
  { courseUnitGuid: 'rs-cu-03', unitCode: 'BIT2116', unitName: 'Data Communication & Networking', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-04', unitCode: 'BIT2208', unitName: 'Web Programming', isTheoryPracticalUnit: true },
  { courseUnitGuid: 'rs-cu-05', unitCode: 'BBA2218', unitName: 'Business Taxation', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-06', unitCode: 'BBA2205', unitName: 'Business Statistics', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-07', unitCode: 'BBA2210', unitName: 'International Marketing', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-08', unitCode: 'BAI2113', unitName: 'Advanced Artificial Intelligence', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-09', unitCode: 'BAI2118', unitName: 'Artificial Intelligence Laboratory using Python', isTheoryPracticalUnit: true },
  { courseUnitGuid: 'rs-cu-10', unitCode: 'BCS1104', unitName: 'Programming Fundamentals', isTheoryPracticalUnit: true },
  { courseUnitGuid: 'rs-cu-11', unitCode: 'BCS1101', unitName: 'Discrete Mathematics', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-12', unitCode: 'BCS2207', unitName: 'Operating Systems', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-13', unitCode: 'BBA1102', unitName: 'Principles of Accounting', isTheoryPracticalUnit: false },
  { courseUnitGuid: 'rs-cu-14', unitCode: 'BIT1105', unitName: 'Computer Applications', isTheoryPracticalUnit: true },
]

type MockSchedule = ResitScheduleDetailDto

let mockSeq = 100
function mockSchedule(unitIdx: number, ueType: number, examDate: string, start: string, end: string, extra: Partial<MockSchedule> = {}): MockSchedule {
  const u = MOCK_UNITS[unitIdx]
  return {
    resitScheduleGuid: `rs-sch-${++mockSeq}`,
    courseUnitGuid: u.courseUnitGuid, unitCode: u.unitCode, unitName: u.unitName,
    ueType, examDate, startTime: `${start}:00`, endTime: `${end}:00`,
    maxMark: 100, examType: 1, publishStatus: 1, ...MOCK_RULE, marksEntered: false,
    ...extra,
  }
}

const mockSchedules: MockSchedule[] = [
  mockSchedule(0, 0, '2026-10-12', '09:00', '12:00'),
  mockSchedule(1, 0, '2026-10-12', '14:00', '17:00', { marksEntered: true }),
  mockSchedule(1, 1, '2026-10-13', '09:00', '11:00', { maxMark: 50 }),
  mockSchedule(2, 0, '2026-10-13', '14:00', '17:00', { publishStatus: 0 }),
  mockSchedule(4, 0, '2026-10-14', '09:00', '12:00'),
  mockSchedule(5, 0, '2026-10-14', '14:00', '17:00', { examType: 0 }),
  mockSchedule(7, 0, '2026-10-15', '09:00', '12:00'),
  mockSchedule(8, 0, '2026-10-15', '14:00', '17:00'),
  mockSchedule(8, 1, '2026-10-16', '09:00', '12:00', { maxMark: 60, marksEntered: true }),
  mockSchedule(10, 0, '2026-10-16', '14:00', '17:00'),
  mockSchedule(11, 0, '2026-10-17', '09:00', '12:00'),
  mockSchedule(12, 0, '2026-10-17', '14:00', '17:00'),
]

// UTC windows (the server stores UTC).
let mockCt: ResitCtScheduleDto | null = {
  resitClassTestScheduleGuid: 'rs-ct-1',
  startDateTime: '2026-03-10T11:00:00Z', endDateTime: '2026-03-15T14:00:00Z',
  durationMinutes: 60, testType: 0, publishStatus: 1, ...MOCK_RULE,
}
const MOCK_CT_STARTED = 20
let mockCw: ResitCwScheduleDto | null = null
const MOCK_CW_STARTED = 0

function mockError(code: string, ...errors: string[]): AuthError {
  return new AuthError(code, errors[0], errors)
}

const delay = <T,>(v: T, ms = 250) => new Promise<T>(r => setTimeout(() => r(v), ms))
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function mockRule(guid: string) {
  return guid === MOCK_RULE.examRuleGuid ? MOCK_RULE : { examRuleGuid: guid, examRuleCode: null, examRuleName: null }
}

function toListItem({ marksEntered: _m, ...s }: MockSchedule): ResitScheduleListItemDto {
  return s
}

// ── API ────────────────────────────────────────────────────────────────────

export function getResitSchedules(params?: { page?: number; pageSize?: number; search?: string }): Promise<ResitSchedulesResponse> {
  if (MOCK_AUTH) {
    const page = params?.page ?? 1
    const pageSize = params?.pageSize ?? 10
    const q = params?.search?.trim().toLowerCase() ?? ''
    const rows = mockSchedules
      .filter(s => !q || s.unitCode.toLowerCase().includes(q) || s.unitName.toLowerCase().includes(q))
      .sort((a, b) => a.unitCode.localeCompare(b.unitCode) || a.ueType - b.ueType)
    return delay({
      resit: MOCK_RESIT,
      schedules: { items: rows.slice((page - 1) * pageSize, page * pageSize).map(s => clone(toListItem(s))), totalCount: rows.length, pageNumber: page, pageSize },
    })
  }
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', params.page.toString())
  if (params?.pageSize) qs.set('pageSize', params.pageSize.toString())
  if (params?.search) qs.set('search', params.search)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<ResitSchedulesResponse>(`/api/v1/assessment/resit-schedule${query}`)
}

export function getResitScheduleCourseUnits(): Promise<ResitScheduleCourseUnitDto[]> {
  if (MOCK_AUTH) {
    return delay(MOCK_UNITS.map(u => ({
      ...u,
      theoryScheduled: mockSchedules.some(s => s.courseUnitGuid === u.courseUnitGuid && s.ueType === 0),
      practicalScheduled: mockSchedules.some(s => s.courseUnitGuid === u.courseUnitGuid && s.ueType === 1),
    })), 400)
  }
  return apiGet<ResitScheduleCourseUnitDto[] | null>(`/api/v1/assessment/resit-schedule/course-units`).then(d => d ?? [])
}

export function createResitSchedule(data: ResitScheduleSaveCommand): Promise<ResitScheduleListItemDto> {
  if (MOCK_AUTH) {
    const u = MOCK_UNITS.find(x => x.courseUnitGuid === data.courseUnitGuid)
    if (!u) return Promise.reject(mockError('not_found', 'Course unit not found.'))
    const ueType = data.ueType ?? 0
    if (ueType === 1 && !u.isTheoryPracticalUnit) return Promise.reject(mockError('bad_request', 'Practical can be scheduled only for theory + practical units.'))
    if (mockSchedules.some(s => s.courseUnitGuid === u.courseUnitGuid && s.ueType === ueType)) {
      return Promise.reject(mockError('conflict', `${u.unitCode} ${ueType === 1 ? 'Practical' : 'Theory'} is already scheduled for this resit.`))
    }
    const row: MockSchedule = {
      resitScheduleGuid: `rs-sch-${++mockSeq}`,
      courseUnitGuid: u.courseUnitGuid, unitCode: u.unitCode, unitName: u.unitName, ueType,
      examDate: data.examDate, startTime: data.startTime, endTime: data.endTime, maxMark: data.maxMark,
      examType: data.examType, publishStatus: data.publishStatus, ...mockRule(data.examRuleGuid), marksEntered: false,
    }
    mockSchedules.push(row)
    return delay(clone(toListItem(row)))
  }
  return apiPost<ResitScheduleListItemDto>(`/api/v1/assessment/resit-schedule`, data)
}

export function getResitSchedule(resitScheduleGuid: string): Promise<ResitScheduleDetailDto> {
  if (MOCK_AUTH) {
    const row = mockSchedules.find(s => s.resitScheduleGuid === resitScheduleGuid)
    return row ? delay(clone(row)) : Promise.reject(mockError('not_found', 'Resit schedule not found.'))
  }
  return apiGet<ResitScheduleDetailDto>(`/api/v1/assessment/resit-schedule/${resitScheduleGuid}`)
}

export function updateResitSchedule(resitScheduleGuid: string, data: ResitScheduleSaveCommand): Promise<ResitScheduleListItemDto> {
  if (MOCK_AUTH) {
    const row = mockSchedules.find(s => s.resitScheduleGuid === resitScheduleGuid)
    if (!row) return Promise.reject(mockError('not_found', 'Resit schedule not found.'))
    if (row.marksEntered && (row.examRuleGuid !== data.examRuleGuid || row.maxMark !== data.maxMark)) {
      return Promise.reject(mockError('conflict', 'Marks are already entered for this exam. The exam rule and exam mark cannot be changed.'))
    }
    Object.assign(row, {
      examDate: data.examDate, startTime: data.startTime, endTime: data.endTime, maxMark: data.maxMark,
      examType: data.examType, publishStatus: data.publishStatus, ...mockRule(data.examRuleGuid),
    })
    return delay(clone(toListItem(row)))
  }
  return apiPut<ResitScheduleListItemDto>(`/api/v1/assessment/resit-schedule/${resitScheduleGuid}`, data)
}

export function getResitCwSchedule(): Promise<ResitCwScheduleResponse> {
  if (MOCK_AUTH) return delay({ resit: MOCK_RESIT, schedule: clone(mockCw), studentsStarted: MOCK_CW_STARTED, locked: MOCK_CW_STARTED > 0 })
  return apiGet<ResitCwScheduleResponse>(`/api/v1/assessment/resit-cw-schedule`)
}

export function updateResitCwSchedule(data: ResitCwScheduleSaveCommand): Promise<ResitCwScheduleDto> {
  if (MOCK_AUTH) {
    if (MOCK_CW_STARTED > 0 && mockCw && (mockCw.examRuleGuid !== data.examRuleGuid || mockCw.testType !== data.testType)) {
      return Promise.reject(mockError('conflict', 'Students have already started the coursework. The exam rule and test type cannot be changed.'))
    }
    mockCw = { resitCourseworkScheduleGuid: mockCw?.resitCourseworkScheduleGuid ?? 'rs-cw-1', ...data, ...mockRule(data.examRuleGuid) }
    return delay(clone(mockCw))
  }
  return apiPut<ResitCwScheduleDto>(`/api/v1/assessment/resit-cw-schedule`, data)
}

export function getResitCtSchedule(): Promise<ResitCtScheduleResponse> {
  if (MOCK_AUTH) return delay({ resit: MOCK_RESIT, schedule: clone(mockCt), studentsStarted: MOCK_CT_STARTED, locked: MOCK_CT_STARTED > 0 })
  return apiGet<ResitCtScheduleResponse>(`/api/v1/assessment/resit-ct-schedule`)
}

export function updateResitCtSchedule(data: ResitCtScheduleSaveCommand): Promise<ResitCtScheduleDto> {
  if (MOCK_AUTH) {
    if (MOCK_CT_STARTED > 0 && mockCt && (mockCt.examRuleGuid !== data.examRuleGuid || mockCt.testType !== data.testType || mockCt.durationMinutes !== data.durationMinutes)) {
      return Promise.reject(mockError('conflict', 'Students have already started the class test. The exam rule, duration and test type cannot be changed.'))
    }
    mockCt = { resitClassTestScheduleGuid: mockCt?.resitClassTestScheduleGuid ?? 'rs-ct-1', ...data, ...mockRule(data.examRuleGuid) }
    return delay(clone(mockCt))
  }
  return apiPut<ResitCtScheduleDto>(`/api/v1/assessment/resit-ct-schedule`, data)
}
