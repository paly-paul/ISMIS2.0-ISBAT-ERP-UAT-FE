import { apiDeleteWithMessage, apiGet, apiPost } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Student Exam Cancel / Extra Time (exam-cancel/*.md) — port of legacy
// frmTrnStudentExamCancel. Staff pick a student and a course unit, see the
// Class Test status, then cancel a Class Test / CW1 / CW2 attempt so the
// student can sit it again, or give extra time on the Class Test. The server
// always works in the current academic intake.

// ── Types ──────────────────────────────────────────────────────────────────

// GET /exam-cancel/students?searchTerm= (max 50, by name)
export interface ExamCancelStudentHit {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  programName: string | null
  batchCode: string | null
  semesterCode: string | null
}

// GET /exam-cancel/students/{studentGuid}
export interface ExamCancelStudent {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
}

// GET .../course-units — `label` is the legacy "UnitName(UnitCode)".
export interface ExamCancelCourseUnit {
  courseUnitGuid: string
  courseUnitName: string
  courseUnitCode: string
  label: string
}

// GET .../status — Class Test (Test 1) only.
// 0 Not submitted · 1 Submitted · 2 Evaluated
export type ClassTestStatus = 0 | 1 | 2

export interface ExamStatus {
  status: ClassTestStatus
  mark: number | null
  message: string
}

// DELETE .../attempts/{category}
// 1 Class Test · 2 CW1 · 3 CW2
export type AttemptCategory = 1 | 2 | 3

// Minimum-length rule relaxed for testing — 0 lists students as soon as the
// search box is focused, before anything is typed. The Students service still
// returns [] for terms under 3 characters, so on the real backend the list
// stays empty until the third character. Restore the 3 when done.
// export const SEARCH_MIN_CHARS = 3
export const SEARCH_MIN_CHARS = 0
export const SEARCH_MAX_RESULTS = 50

// ── Mock store (NEXT_PUBLIC_AUTH_MOCK) ─────────────────────────────────────
// Per student + unit: the Class Test state (submitted / evaluated / balance
// time against a 60-minute duration) and whether CW1 / CW2 attempts exist.
// The rules follow the docs, so cancel and extra time change what the
// status call returns next.

interface MockStudent extends ExamCancelStudent {
  batchCode: string
  semesterCode: string
  units: ExamCancelCourseUnit[]
}

const unit = (guid: string, code: string, name: string): ExamCancelCourseUnit => ({ courseUnitGuid: guid, courseUnitCode: code, courseUnitName: name, label: `${name}(${code})` })

const BBA_UNITS = [
  unit('ec-cu-bba2218', 'BBA2218', 'Business Taxation'),
  unit('ec-cu-bba2205', 'BBA2205', 'Business Statistics'),
  unit('ec-cu-bba2210', 'BBA2210', 'International Marketing'),
  unit('ec-cu-bba2212', 'BBA2212', 'Global Supply Chain Management'),
]
const BIT_UNITS = [
  unit('ec-cu-bit2203', 'BIT2203', 'Database Systems'),
  unit('ec-cu-bit2116', 'BIT2116', 'Data Communication & Networking'),
  unit('ec-cu-bit2208', 'BIT2208', 'Web Programming'),
]
const BAI_UNITS = [
  unit('ec-cu-bai2113', 'BAI2113', 'Advanced Artificial Intelligence'),
  unit('ec-cu-bai2114', 'BAI2114', 'Data Communication and Networking'),
  unit('ec-cu-bai2118', 'BAI2118', 'Artificial Intelligence Laboratory using Python'),
]

const BBA = { programGuid: 'ec-prog-bba', programName: 'Bachelor of Business Administration in International Business - S22', semesterGuid: 'ec-sem-bba-4', semesterName: 'Year Two - Semester Two', batchCode: 'BBAIBF23DA', semesterCode: '4', units: BBA_UNITS }
const BIT = { programGuid: 'ec-prog-bit', programName: 'Bachelor of Information Technology', semesterGuid: 'ec-sem-bit-3', semesterName: 'Year Two - Semester One', batchCode: 'BIT-SEP23', semesterCode: '3', units: BIT_UNITS }
const BAI = { programGuid: 'ec-prog-bai', programName: 'Bachelor of Science in Artificial Intelligence and Machine Learning - S22', semesterGuid: 'ec-sem-bai-4', semesterName: 'Year Two - Semester Two', batchCode: 'BSCAI&MLF24DA', semesterCode: '4', units: BAI_UNITS }

const MOCK_STUDENTS: MockStudent[] = [
  { studentGuid: 'ec-stu-1', studentRegNo: '012240490', studentName: 'FATIMA VAKIL', ...BBA },
  { studentGuid: 'ec-stu-2', studentRegNo: '012230171', studentName: 'ALFAF ABDO MOHAMMED SHANNAN', ...BBA },
  { studentGuid: 'ec-stu-3', studentRegNo: '012230213', studentName: 'NAKIBUUKA HAJARAH', ...BBA },
  { studentGuid: 'ec-stu-4', studentRegNo: '012221590', studentName: 'ALFRED EKANYA', ...BIT },
  { studentGuid: 'ec-stu-5', studentRegNo: '012220626', studentName: 'KATO JOSEPH', ...BIT },
  { studentGuid: 'ec-stu-6', studentRegNo: '012240747', studentName: 'AARYAN', ...BAI },
  { studentGuid: 'ec-stu-7', studentRegNo: '011240294', studentName: 'LOJUM NATHANAEL JOSHUA', ...BAI },
  // No programme / semester on record — course units and status return 404.
  { studentGuid: 'ec-stu-8', studentRegNo: '012250099', studentName: 'MUKISA ANNET', programGuid: null, programName: null, semesterGuid: null, semesterName: null, batchCode: 'HECF25DA', semesterCode: '', units: [] },
]

interface MockAttempt {
  hasAssessment: boolean // a T_IA for the unit in the current intake
  hasTest: boolean // Test 1 exists
  submitted: boolean
  evaluatedMark: number | null
  balanceSeconds: number | null // null = no balance-time row
  durationMinutes: number | null
  cw1: boolean | null // null = the assessment has no CW1
  cw2: boolean | null
}

const mockAttempts = new Map<string, MockAttempt>()

function mockAttempt(studentGuid: string, courseUnitGuid: string): MockAttempt {
  const key = `${studentGuid}|${courseUnitGuid}`
  let a = mockAttempts.get(key)
  if (!a) {
    // Spread a few states across units: evaluated, submitted, in progress,
    // not started, no assessment.
    const n = [...key].reduce((s, c) => s + c.charCodeAt(0), 0) % 5
    a = n === 0 ? { hasAssessment: true, hasTest: true, submitted: true, evaluatedMark: 10, balanceSeconds: 0, durationMinutes: 60, cw1: true, cw2: false }
      : n === 1 ? { hasAssessment: true, hasTest: true, submitted: true, evaluatedMark: null, balanceSeconds: 600, durationMinutes: 60, cw1: true, cw2: true }
      : n === 2 ? { hasAssessment: true, hasTest: true, submitted: false, evaluatedMark: null, balanceSeconds: 1500, durationMinutes: 60, cw1: false, cw2: null }
      : n === 3 ? { hasAssessment: true, hasTest: true, submitted: false, evaluatedMark: null, balanceSeconds: null, durationMinutes: 60, cw1: false, cw2: false }
      : { hasAssessment: false, hasTest: false, submitted: false, evaluatedMark: null, balanceSeconds: null, durationMinutes: null, cw1: null, cw2: null }
    mockAttempts.set(key, a)
  }
  return a
}

function mockError(message: string, code: string) {
  return Object.assign(new Error(message), { code })
}

const delay = <T,>(v: T, ms = 250) => new Promise<T>(r => setTimeout(() => r(v), ms))

function findMockStudent(studentGuid: string, needsContext = false): MockStudent {
  const s = MOCK_STUDENTS.find(x => x.studentGuid === studentGuid)
  if (!s || (needsContext && (!s.programGuid || !s.semesterGuid))) throw mockError('No Student found!!', 'not_found')
  return s
}

// Resolves the assessment + Test 1 the way status / cancel / extra time do.
function resolveTest(studentGuid: string, courseUnitGuid: string): MockAttempt {
  findMockStudent(studentGuid, true)
  const a = mockAttempt(studentGuid, courseUnitGuid)
  if (!a.hasAssessment) throw mockError('No assessment found for this course unit.', 'not_found')
  return a
}

function fmtMark(n: number) {
  return String(Number(n.toFixed(2)))
}

// ── API ────────────────────────────────────────────────────────────────────

export function searchExamCancelStudents(searchTerm: string): Promise<ExamCancelStudentHit[]> {
  const term = searchTerm.trim()
  if (MOCK_AUTH) {
    if (term.length < SEARCH_MIN_CHARS) return delay([])
    const q = term.toLowerCase()
    // Number / reg no exact, name partial — as the Students service does.
    const hits = MOCK_STUDENTS
      .filter(s => s.studentRegNo === term || (s.studentName ?? '').toLowerCase().includes(q))
      .sort((a, b) => (a.studentName ?? '').localeCompare(b.studentName ?? ''))
      .slice(0, SEARCH_MAX_RESULTS)
      .map(({ studentGuid, studentRegNo, studentName, programName, batchCode, semesterCode }) => ({ studentGuid, studentRegNo, studentName, programName, batchCode, semesterCode }))
    return delay(hits)
  }
  return apiGet<ExamCancelStudentHit[] | null>(`/api/v1/assessment/exam-cancel/students?${new URLSearchParams({ searchTerm: term })}`)
    .then(d => d ?? [])
}

export async function getExamCancelStudent(studentGuid: string): Promise<ExamCancelStudent> {
  if (MOCK_AUTH) {
    const { batchCode: _b, semesterCode: _s, units: _u, ...student } = findMockStudent(studentGuid)
    return delay(student)
  }
  return apiGet<ExamCancelStudent>(`/api/v1/assessment/exam-cancel/students/${studentGuid}`)
}

export async function getExamCancelCourseUnits(studentGuid: string): Promise<ExamCancelCourseUnit[]> {
  if (MOCK_AUTH) return delay(findMockStudent(studentGuid, true).units.map(u => ({ ...u })))
  return apiGet<ExamCancelCourseUnit[] | null>(`/api/v1/assessment/exam-cancel/students/${studentGuid}/course-units`)
    .then(d => d ?? [])
}

export async function getExamStatus(studentGuid: string, courseUnitGuid: string): Promise<ExamStatus> {
  if (MOCK_AUTH) {
    const a = resolveTest(studentGuid, courseUnitGuid)
    if (!a.hasTest) throw mockError('No class test found for this course unit.', 'not_found')
    if (a.evaluatedMark !== null) return delay({ status: 2, mark: a.evaluatedMark, message: `Evaluated and scored ${fmtMark(a.evaluatedMark)} Marks` })
    if (a.submitted) return delay({ status: 1, mark: null, message: 'Exam Submitted' })
    return delay({ status: 0, mark: null, message: 'Exam Not Yet Submitted' })
  }
  return apiGet<ExamStatus>(`/api/v1/assessment/exam-cancel/students/${studentGuid}/course-units/${courseUnitGuid}/status`)
}

// No server-side confirmation — the page confirms first.
export async function cancelAttempt(studentGuid: string, courseUnitGuid: string, category: AttemptCategory): Promise<{ deleted: boolean; message: string | null }> {
  if (MOCK_AUTH) {
    const a = resolveTest(studentGuid, courseUnitGuid)
    if (category === 1) {
      if (!a.hasTest) throw mockError('No class test found for this course unit.', 'not_found')
      if (!a.submitted && a.evaluatedMark === null && a.balanceSeconds === null) throw mockError('Could not delete.....!', 'not_found')
      Object.assign(a, { submitted: false, evaluatedMark: null, balanceSeconds: null })
    } else {
      const k = category === 2 ? 'cw1' : 'cw2'
      if (a[k] === null) throw mockError('No coursework found for this course unit.', 'not_found')
      if (!a[k]) throw mockError('Could not delete.....!', 'not_found')
      a[k] = false
    }
    return delay({ deleted: true, message: 'Deleted successfully......!' })
  }
  const res = await apiDeleteWithMessage<boolean>(`/api/v1/assessment/exam-cancel/students/${studentGuid}/course-units/${courseUnitGuid}/attempts/${category}`)
  return { deleted: res.data === true, message: res.message }
}

// Class Test only. Reopens the test and adds time to the balance.
export async function grantExtraTime(studentGuid: string, courseUnitGuid: string, extraMinutes: number): Promise<{ balanceTimeSeconds: number }> {
  if (MOCK_AUTH) {
    if (!(extraMinutes > 0)) throw mockError('Extra time must be greater than zero.', 'validation_error')
    const a = resolveTest(studentGuid, courseUnitGuid)
    if (!a.hasTest) throw mockError('No class test found for this course unit.', 'not_found')
    if (a.balanceSeconds === null) throw mockError('Sorry...!No exam exists', 'not_found')
    if (!a.durationMinutes) throw mockError('Test duration is not configured.', 'bad_request')
    const next = a.balanceSeconds + extraMinutes * 60
    if (next > a.durationMinutes * 60) throw mockError('Sorry...!Extra time should be reduced...!', 'bad_request')
    Object.assign(a, { balanceSeconds: next, submitted: false, evaluatedMark: null })
    return delay({ balanceTimeSeconds: next })
  }
  return apiPost<{ balanceTimeSeconds: number }>(`/api/v1/assessment/exam-cancel/students/${studentGuid}/course-units/${courseUnitGuid}/extra-time`, { extraMinutes })
}
