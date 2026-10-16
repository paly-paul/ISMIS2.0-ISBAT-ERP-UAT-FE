import { apiGet, apiPost, apiPut } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Resit IA Evaluation (resit-ia-evaluation/*.md) — lecturers mark the resit
// coursework (Course Work 1) students submitted online. Every endpoint is
// scoped server-side to the units the logged-in lecturer is planned to teach.

// GET /assessment/resit-evaluations/units (get-resit-evaluation-units.md)
export interface ResitEvaluationUnit {
  courseUnitGuid: string
  unitCode: string | null
  unitName: string | null
  category: number
  categoryLabel: string
  programmeNames: string[]
  headCount: number
  submittedCount: number
  evaluatedCount: number
  pendingCount: number
}

export interface ResitEvaluationUnits {
  pending: ResitEvaluationUnit[]
  evaluated: ResitEvaluationUnit[]
}

// GET .../units/{courseUnitGuid}/students (get-resit-evaluation-students.md)
// evaluationStatus: 0 Pending, 1 Evaluated.
export interface ResitEvaluationStudent {
  resitApplicationGuid: string
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  programmeName: string | null
  evaluationStatus: number
  questionCount: number
  markedCount: number
  mark: number | null
  maxMark: number | null
  submittedDate: string | null
  evaluatedDate: string | null
}

export interface ResitEvaluationStudents {
  courseUnitGuid: string
  unitCode: string | null
  unitName: string | null
  minQuestion: number
  students: ResitEvaluationStudent[]
}

// GET .../applications/{resitApplicationGuid}/questions
// (get-resit-evaluation-questions.md). section: 1 A, 2 B, 3 C.
// questionType: 1 MCQ, 2 Descriptive, null when the question is missing.
export interface ResitEvaluationQuestion {
  answerGuid: string
  questionGuid: string | null
  questionNumber: number
  section: number | null
  questionText: string | null
  questionType: number | null
  isMcq: boolean
  answerText: string | null
  answerFileUrl: string | null
  answerFileName: string | null
  mark: number | null
  maxMark: number
}

export interface ResitEvaluationQuestions {
  resitApplicationGuid: string
  studentGuid: string
  evaluationStatus: number
  minQuestion: number
  markedCount: number
  questions: ResitEvaluationQuestion[]
}

// PUT .../answers/{answerGuid}/mark (put-resit-evaluation-mark.md)
export interface SaveResitMarkResult {
  answerGuid: string
  mark: number | null
}

// POST .../applications/{resitApplicationGuid}/submit
// (post-resit-evaluation-submit.md)
export interface SubmitResitEvaluationResult {
  resitApplicationGuid: string
  totalMark: number
  totalMaxMark: number
  evaluatedDate: string
  remainingPendingCount: number
}

// ── Mock store (NEXT_PUBLIC_AUTH_MOCK) ─────────────────────────────────────
// Mutable so save/submit round-trip through the same data the GETs read.

const MOCK_UNIT_GUID_1 = 'mock-cu-bbaib2221'
const MOCK_UNIT_GUID_2 = 'mock-cu-bncs1211'
const MOCK_UNIT_GUID_3 = 'mock-cu-bncs3235'

interface MockUnitMeta { code: string; name: string; programme: string; headCount: number }
const mockUnitMeta: Record<string, MockUnitMeta> = {
  [MOCK_UNIT_GUID_1]: { code: 'BBAIB2221', name: 'Global Strategic Management', programme: 'BBA International Business - S22', headCount: 2 },
  [MOCK_UNIT_GUID_2]: { code: 'BNCS1211', name: 'Data and Storage Security', programme: 'BSc Networks and Cyber Security', headCount: 3 },
  [MOCK_UNIT_GUID_3]: { code: 'BNCS3235', name: 'Digital Transformation and Overview', programme: 'BSc Networks and Cyber Security', headCount: 1 },
}

function mockQuestions(seed: string, marks: (number | null)[]): ResitEvaluationQuestion[] {
  const texts = [
    'Define Porter&#39;s Five Forces model and explain its significance in strategic analysis',
    'Discuss <strong>two</strong> strategies a firm can use to enter a foreign market.',
  ]
  return marks.map((mark, i) => ({
    answerGuid: `${seed}-ans-${i + 1}`,
    questionGuid: `${seed}-q-${i + 1}`,
    questionNumber: i + 1,
    section: 1,
    questionText: texts[i % texts.length],
    questionType: 2,
    isMcq: false,
    answerText: i === 0 ? 'Porter\'s model looks at five competitive forces that shape an industry…' : '',
    answerFileUrl: i === 1 ? '#' : null,
    answerFileName: i === 1 ? 'answer.pdf' : null,
    mark,
    maxMark: 25,
  }))
}

interface MockApplication {
  unitGuid: string
  student: ResitEvaluationStudent
  questions: ResitEvaluationQuestion[]
}

const mockApplications: MockApplication[] = [
  { unitGuid: MOCK_UNIT_GUID_1, questions: mockQuestions('app-1', [18.5, null]), student: { resitApplicationGuid: 'app-1', studentGuid: 'stu-1', studentRegNo: '012230213', studentName: 'NAKIBUUKA HAJARAH', programmeName: 'BBA International Business - S22', evaluationStatus: 0, questionCount: 2, markedCount: 1, mark: null, maxMark: null, submittedDate: '2026-03-15T11:01:26', evaluatedDate: null } },
  { unitGuid: MOCK_UNIT_GUID_2, questions: mockQuestions('app-2', [null, null]), student: { resitApplicationGuid: 'app-2', studentGuid: 'stu-2', studentRegNo: '012230541', studentName: 'OKELLO JAMES', programmeName: 'BSc Networks and Cyber Security', evaluationStatus: 0, questionCount: 2, markedCount: 0, mark: null, maxMark: null, submittedDate: '2026-03-16T09:12:00', evaluatedDate: null } },
  { unitGuid: MOCK_UNIT_GUID_3, questions: mockQuestions('app-3', [18.5, 12]), student: { resitApplicationGuid: 'app-3', studentGuid: 'stu-3', studentRegNo: '012230118', studentName: 'AMONG GRACE', programmeName: 'BSc Networks and Cyber Security', evaluationStatus: 1, questionCount: 2, markedCount: 2, mark: 18.5, maxMark: 25, submittedDate: '2026-03-14T15:40:00', evaluatedDate: '2026-03-20T10:00:00' } },
]

function mockUnit(unitGuid: string): ResitEvaluationUnit {
  const meta = mockUnitMeta[unitGuid]
  const apps = mockApplications.filter(a => a.unitGuid === unitGuid)
  const evaluatedCount = apps.filter(a => a.student.evaluationStatus === 1).length
  return {
    courseUnitGuid: unitGuid,
    unitCode: meta.code,
    unitName: meta.name,
    category: 2,
    categoryLabel: 'Course Work1',
    programmeNames: [meta.programme],
    headCount: meta.headCount,
    submittedCount: apps.length,
    evaluatedCount,
    pendingCount: apps.length - evaluatedCount,
  }
}

function findMockApplication(resitApplicationGuid: string): MockApplication {
  const app = mockApplications.find(a => a.student.resitApplicationGuid === resitApplicationGuid)
  if (!app) throw Object.assign(new Error('Resit coursework submission not found.'), { code: 'not_found' })
  return app
}

// ── API ────────────────────────────────────────────────────────────────────

export function getResitEvaluationUnits(intakeGuid: string, resitConfigGuid: string): Promise<ResitEvaluationUnits> {
  if (MOCK_AUTH) {
    const units = Object.keys(mockUnitMeta).map(mockUnit)
    return Promise.resolve({
      pending: units.filter(u => u.pendingCount > 0),
      evaluated: units.filter(u => u.pendingCount === 0),
    })
  }
  const qs = new URLSearchParams({ intakeGuid, resitConfigGuid })
  return apiGet<ResitEvaluationUnits | null>(`/api/v1/assessment/resit-evaluations/units?${qs}`)
    .then(data => data ?? { pending: [], evaluated: [] })
}

// status is omitted on purpose by the page (resit-ia-evaluation-page.md,
// flow step 3) so evaluated students are listed too.
export function getResitEvaluationStudents(courseUnitGuid: string, intakeGuid: string, resitConfigGuid: string, status?: 0 | 1): Promise<ResitEvaluationStudents> {
  if (MOCK_AUTH) {
    const meta = mockUnitMeta[courseUnitGuid]
    const students = mockApplications
      .filter(a => a.unitGuid === courseUnitGuid && (status === undefined || a.student.evaluationStatus === status))
      .map(a => ({ ...a.student }))
    return Promise.resolve({ courseUnitGuid, unitCode: meta?.code ?? null, unitName: meta?.name ?? null, minQuestion: 1, students })
  }
  const qs = new URLSearchParams({ intakeGuid, resitConfigGuid })
  if (status !== undefined) qs.set('status', String(status))
  return apiGet<ResitEvaluationStudents>(`/api/v1/assessment/resit-evaluations/units/${courseUnitGuid}/students?${qs}`)
}

export function getResitEvaluationQuestions(resitApplicationGuid: string): Promise<ResitEvaluationQuestions> {
  if (MOCK_AUTH) {
    const app = findMockApplication(resitApplicationGuid)
    return Promise.resolve({
      resitApplicationGuid,
      studentGuid: app.student.studentGuid,
      evaluationStatus: app.student.evaluationStatus,
      minQuestion: 1,
      markedCount: app.questions.filter(q => q.mark !== null).length,
      questions: app.questions.map(q => ({ ...q })),
    })
  }
  return apiGet<ResitEvaluationQuestions>(`/api/v1/assessment/resit-evaluations/applications/${resitApplicationGuid}/questions`)
}

// mark: null clears the mark.
export function saveResitEvaluationMark(resitApplicationGuid: string, answerGuid: string, mark: number | null): Promise<SaveResitMarkResult> {
  if (MOCK_AUTH) {
    const app = findMockApplication(resitApplicationGuid)
    const q = app.questions.find(x => x.answerGuid === answerGuid)
    if (!q) return Promise.reject(Object.assign(new Error('Answer not found for this submission.'), { code: 'not_found' }))
    q.mark = mark
    app.student.markedCount = app.questions.filter(x => x.mark !== null).length
    return Promise.resolve({ answerGuid, mark })
  }
  return apiPut<SaveResitMarkResult>(`/api/v1/assessment/resit-evaluations/applications/${resitApplicationGuid}/answers/${answerGuid}/mark`, { mark })
}

export function submitResitEvaluation(resitApplicationGuid: string): Promise<SubmitResitEvaluationResult> {
  if (MOCK_AUTH) {
    const app = findMockApplication(resitApplicationGuid)
    if (app.student.evaluationStatus === 1) {
      return Promise.reject(Object.assign(new Error('This student is already evaluated.'), { code: 'conflict' }))
    }
    const totalMark = app.questions.reduce((sum, q) => sum + (q.mark ?? 0), 0)
    const evaluatedDate = new Date().toISOString()
    Object.assign(app.student, { evaluationStatus: 1, mark: totalMark, maxMark: 25, evaluatedDate })
    const remainingPendingCount = mockApplications.filter(a => a.unitGuid === app.unitGuid && a.student.evaluationStatus === 0).length
    return Promise.resolve({ resitApplicationGuid, totalMark, totalMaxMark: 25, evaluatedDate, remainingPendingCount })
  }
  return apiPost<SubmitResitEvaluationResult>(`/api/v1/assessment/resit-evaluations/applications/${resitApplicationGuid}/submit`, {})
}
