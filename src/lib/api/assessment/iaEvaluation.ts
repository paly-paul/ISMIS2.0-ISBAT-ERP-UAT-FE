import { apiGet, apiPut, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// ── Types & DTOs (from Nebu Salim's internal-assessment-evaluations specs) ──

/**
 * DTO for pending / evaluated coursework row
 * Spec: get-pending.md & get-evaluated.md
 */
export interface PendingEvaluationDto {
  courseworkOrTestGuid: string
  category: number // 1=Test, 2=Coursework1, 3=Coursework2
  categoryLabel: string // "Course Work1" | "Course Work2"
  unitGuid: string
  unitCode: string | null
  unitName: string | null
  studyingCount: number
  attendedCount: number
  evaluatedCount: number
  pendingCount: number // attendedCount - evaluatedCount
}

/**
 * DTO for students pending evaluation
 * Spec: get-students.md
 */
export interface StudentsForEvaluationResponseDto {
  unitName: string | null
  programmeName: string | null
  semesterName: string | null
  students: StudentForEvaluationDto[]
}

export interface StudentForEvaluationDto {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  minQuestion: number
  evaluationStatus: 'Pending' | 'Evaluated'
  mark: number | null // null when Pending
  maxMark: number | null // null when Pending
  comment: string | null // null when Pending
  evaluatedDate: string | null // null when Pending
}

/**
 * DTO for student questions
 * Spec: get-questions.md
 */
export interface QuestionForEvaluationDto {
  questionGuid: string
  questionText: string | null
  questionType: number | null
  answerText: string | null
  answerFileUrl: string | null
  answerFileName: string | null
  mark: number | null
  maxMark: number | null
  section: number | null
}

/**
 * Response for saving a question mark
 * Spec: put-mark.md
 */
export interface SaveQuestionMarkResponseDto {
  questionGuid: string
  mark: number | null
}

/**
 * Payload & Response for finalizing student
 * Spec: post-finalize.md
 */
export interface FinalizeStudentRequest {
  comment?: string
}

export interface FinalizeStudentResponseDto {
  totalMark: number
  totalMaxMark: number
  evaluatedDate: string
  nextStudentGuid: string | null
}

// ── Normalization Helpers (Casing & Alternative Property Names) ─────────────

export function normalizeQuestion(raw: any): QuestionForEvaluationDto {
  if (!raw) {
    return {
      questionGuid: '',
      questionText: null,
      questionType: null,
      answerText: null,
      answerFileUrl: null,
      answerFileName: null,
      mark: null,
      maxMark: null,
      section: 1,
    }
  }

  const questionGuid =
    raw.questionGuid ||
    raw.QuestionGuid ||
    raw.courseworkQuestionGuid ||
    raw.CourseworkQuestionGuid ||
    raw.assessmentQuestionGuid ||
    raw.AssessmentQuestionGuid ||
    raw.questionId ||
    raw.QuestionId ||
    raw.guid ||
    raw.Guid ||
    raw.id ||
    raw.Id ||
    ''

  const questionText = raw.questionText ?? raw.QuestionText ?? raw.text ?? raw.Text ?? null
  const questionType = raw.questionType ?? raw.QuestionType ?? null
  const answerText = raw.answerText ?? raw.AnswerText ?? raw.studentAnswer ?? raw.StudentAnswer ?? null
  const answerFileUrl =
    raw.answerFileUrl ??
    raw.AnswerFileUrl ??
    raw.fileUrl ??
    raw.FileUrl ??
    raw.attachmentUrl ??
    raw.AttachmentUrl ??
    raw.attachmentPath ??
    raw.AttachmentPath ??
    null
  const answerFileName =
    raw.answerFileName ??
    raw.AnswerFileName ??
    raw.fileName ??
    raw.FileName ??
    raw.attachmentName ??
    raw.AttachmentName ??
    (answerFileUrl ? 'Attached Submission' : null)

  const rawMark = raw.mark ?? raw.Mark ?? raw.awardedMark ?? raw.AwardedMark
  const mark =
    rawMark !== undefined && rawMark !== null && rawMark !== '' && !isNaN(Number(rawMark))
      ? Number(rawMark)
      : null

  const rawMax = raw.maxMark ?? raw.MaxMark ?? raw.maxMarks ?? raw.MaxMarks ?? raw.totalMarks ?? raw.TotalMarks
  const maxMark =
    rawMax !== undefined && rawMax !== null && rawMax !== '' && !isNaN(Number(rawMax))
      ? Number(rawMax)
      : 10

  const section = Number(raw.section ?? raw.Section ?? 1)

  return {
    questionGuid,
    questionText,
    questionType,
    answerText,
    answerFileUrl,
    answerFileName,
    mark,
    maxMark,
    section,
  }
}

export function normalizeStudent(raw: any): StudentForEvaluationDto {
  const rawStatus =
    raw.evaluationStatus ??
    raw.EvaluationStatus ??
    raw.status ??
    raw.Status ??
    raw.evaluation_status

  const rawMark = raw.mark ?? raw.Mark ?? raw.awardedMark ?? raw.AwardedMark
  const mark =
    rawMark !== undefined && rawMark !== null && rawMark !== '' && !isNaN(Number(rawMark))
      ? Number(rawMark)
      : null

  const rawMax =
    raw.maxMark ??
    raw.MaxMark ??
    raw.maxMarks ??
    raw.MaxMarks ??
    raw.totalMarks ??
    raw.TotalMarks
  const maxMark =
    rawMax !== undefined && rawMax !== null && rawMax !== '' && !isNaN(Number(rawMax))
      ? Number(rawMax)
      : null

  const evaluatedDate = raw.evaluatedDate ?? raw.EvaluatedDate ?? raw.evaluated_date ?? null
  const comment = raw.comment ?? raw.Comment ?? null

  const statusStr = String(rawStatus ?? '').trim().toLowerCase()
  const isEvaluated =
    statusStr === 'evaluated' ||
    statusStr === 'completed' ||
    statusStr === 'done' ||
    statusStr === '2' ||
    rawStatus === 2 ||
    raw.isEvaluated === true ||
    raw.isEvaluated === 1 ||
    raw.isEvaluated === '1' ||
    raw.isEvaluated === 'true' ||
    raw.IsEvaluated === true ||
    raw.IsEvaluated === 1 ||
    (mark !== null && evaluatedDate !== null) ||
    (mark !== null && Boolean(comment))

  const evaluationStatus: 'Pending' | 'Evaluated' = isEvaluated ? 'Evaluated' : 'Pending'

  return {
    studentGuid: raw.studentGuid || raw.StudentGuid || raw.guid || raw.Guid || raw.id || raw.Id || '',
    studentRegNo: raw.studentRegNo ?? raw.StudentRegNo ?? raw.regNo ?? raw.RegNo ?? null,
    studentName: raw.studentName ?? raw.StudentName ?? raw.name ?? raw.Name ?? null,
    minQuestion: Number(raw.minQuestion ?? raw.MinQuestion ?? 1),
    evaluationStatus,
    mark,
    maxMark,
    comment,
    evaluatedDate,
  }
}

export function normalizePendingUnit(raw: any): PendingEvaluationDto {
  return {
    courseworkOrTestGuid:
      raw.courseworkOrTestGuid ||
      raw.CourseworkOrTestGuid ||
      raw.courseworkGuid ||
      raw.CourseworkGuid ||
      raw.courseUnit ||
      raw.CourseUnit ||
      raw.courseUnitGuid ||
      raw.CourseUnitGuid ||
      raw.guid ||
      raw.Guid ||
      '',
    category: Number(raw.category ?? raw.Category ?? 2),
    categoryLabel: raw.categoryLabel || raw.CategoryLabel || (raw.category === 3 ? 'Course Work2' : 'Course Work1'),
    unitGuid:
      raw.unitGuid ||
      raw.UnitGuid ||
      raw.courseUnitGuid ||
      raw.CourseUnitGuid ||
      raw.courseUnit ||
      raw.CourseUnit ||
      '',
    unitCode: raw.unitCode ?? raw.UnitCode ?? null,
    unitName: raw.unitName ?? raw.UnitName ?? null,
    studyingCount: Number(raw.studyingCount ?? raw.StudyingCount ?? 0),
    attendedCount: Number(raw.attendedCount ?? raw.AttendedCount ?? 0),
    evaluatedCount: Number(raw.evaluatedCount ?? raw.EvaluatedCount ?? 0),
    pendingCount: Number(raw.pendingCount ?? raw.PendingCount ?? 0),
  }
}

// ── Realistic Mock Data for Development & Fallback ──────────────────────────

const MOCK_PENDING_UNITS: PendingEvaluationDto[] = [
  {
    courseworkOrTestGuid: '6b0ef15b-fddb-41b1-9adb-606034ab3e40',
    category: 2,
    categoryLabel: 'Course Work1',
    unitGuid: '983d54e6-93d7-4e42-a1e1-407213c3d7f0',
    unitCode: 'BNCS2118',
    unitName: 'Introduction to IOT',
    studyingCount: 42,
    attendedCount: 38,
    evaluatedCount: 10,
    pendingCount: 28,
  },
  {
    courseworkOrTestGuid: '7a1fe23c-edcb-42c2-8bca-717145bc4f51',
    category: 3,
    categoryLabel: 'Course Work2',
    unitGuid: '872c43d5-82c6-4d31-90d0-396102b2c6e9',
    unitCode: 'BMIT320',
    unitName: 'Clinical Magnetic Resonance Imaging (MRI)',
    studyingCount: 30,
    attendedCount: 26,
    evaluatedCount: 14,
    pendingCount: 12,
  },
]

const MOCK_EVALUATED_UNITS: PendingEvaluationDto[] = [
  {
    courseworkOrTestGuid: '9c3df45e-0ffb-44e4-addd-939367de6b73',
    category: 2,
    categoryLabel: 'Course Work1',
    unitGuid: '650a21b3-60a4-4b19-78be-17498090a4c7',
    unitCode: 'BCS1102',
    unitName: 'Computer Architecture & Organization',
    studyingCount: 45,
    attendedCount: 45,
    evaluatedCount: 45,
    pendingCount: 0,
  },
]

const MOCK_STUDENTS_BY_UNIT: Record<string, StudentsForEvaluationResponseDto> = {
  '6b0ef15b-fddb-41b1-9adb-606034ab3e40': {
    unitName: 'Introduction to IOT',
    programmeName: 'BSc. Networking and Cyber Security',
    semesterName: 'Year One - Semester Two',
    students: [
      {
        studentGuid: '9a4eebf7-a959-41fa-9979-71ae2f220268',
        studentRegNo: '23/BNCS/0142',
        studentName: 'JOHN DOE',
        minQuestion: 2,
        evaluationStatus: 'Pending',
        mark: null,
        maxMark: null,
        comment: null,
        evaluatedDate: null,
      },
      {
        studentGuid: '7c7d2d18-f686-4e36-915e-0718821df3a3',
        studentRegNo: '23/BNCS/0155',
        studentName: 'SARAH NAKATO',
        minQuestion: 2,
        evaluationStatus: 'Evaluated',
        mark: 19.0,
        maxMark: 25.0,
        comment: 'Very solid explanations on IoT protocols and MQTT architectures.',
        evaluatedDate: '2024-06-24T08:48:26.75',
      },
    ],
  },
}

const MOCK_QUESTIONS_BY_STUDENT: Record<string, QuestionForEvaluationDto[]> = {
  '9a4eebf7-a959-41fa-9979-71ae2f220268': [
    {
      questionGuid: '8f14e45f-ceea-467e-a4c8-5c6e9df8a6a3',
      questionText: 'Explain the fundamental differences between TCP and UDP protocols with respect to IoT sensor data transmission.',
      questionType: 2,
      answerText:
        'TCP is connection-oriented, providing reliable delivery with sequence checks and retransmission, suitable for firmware updates. UDP is connectionless with low overhead, ideal for real-time periodic sensor readings.',
      answerFileUrl: 'https://example.com/mock-files/tcp-udp-iot-diagram.pdf',
      answerFileName: 'tcp_vs_udp_architecture.pdf',
      mark: null,
      maxMark: 25,
      section: 1,
    },
    {
      questionGuid: '9a25f560-dffb-478f-b5d9-6d7f0ea9b7b4',
      questionText: 'Compare MQTT and CoAP protocols for constrained IoT devices in terms of packet header size and transport layer.',
      questionType: 2,
      answerText:
        'MQTT operates over TCP with a minimum 2-byte header. CoAP operates over UDP with a 4-byte header.',
      answerFileUrl: null,
      answerFileName: null,
      mark: null,
      maxMark: 25,
      section: 1,
    },
  ],
}

// ── API Functions ───────────────────────────────────────────────────────────

const BASE_PATH = '/api/v1/assessment/internal-assessment-evaluations'

/**
 * 1. GET /api/v1/assessment/internal-assessment-evaluations/pending?intakeGuid={intakeGuid}
 * The IA evaluation dashboard's "Pending" list — one row per (course unit, coursework)
 * Spec: get-pending.md
 */
export async function getPendingEvaluations(intakeGuid: string): Promise<PendingEvaluationDto[]> {
  if (MOCK_AUTH) return MOCK_PENDING_UNITS
  const url = `${BASE_PATH}/pending?intakeGuid=${encodeURIComponent(intakeGuid)}`
  const data = await apiGet<any[] | null>(url)
  return Array.isArray(data) ? data.map(normalizePendingUnit) : []
}

/**
 * 2. GET /api/v1/assessment/internal-assessment-evaluations/{category}/{courseworkOrTestGuid}/students?status={Pending|Evaluated}
 * category: 1=Test, 2=Coursework1, 3=Coursework2
 * status query param is optional — omit to get everyone, pass Pending or Evaluated to filter
 */
export async function getStudentsForEvaluation(
  category: number,
  courseworkOrTestGuid: string,
  status?: 'Pending' | 'Evaluated' | ''
): Promise<StudentsForEvaluationResponseDto> {
  if (!courseworkOrTestGuid) {
    return { unitName: '', programmeName: '', semesterName: '', students: [] }
  }

  if (MOCK_AUTH) {
    const base =
      MOCK_STUDENTS_BY_UNIT[courseworkOrTestGuid] ||
      MOCK_STUDENTS_BY_UNIT['6b0ef15b-fddb-41b1-9adb-606034ab3e40']
    if (!status) return base
    return {
      ...base,
      students: base.students.filter(s => s.evaluationStatus === status),
    }
  }

  const params = new URLSearchParams()
  if (status) {
    params.append('status', status)
  }
  const queryStr = params.toString() ? `?${params.toString()}` : ''
  const url = `${BASE_PATH}/${category}/${encodeURIComponent(courseworkOrTestGuid)}/students${queryStr}`
  const rawRes = await apiGet<any>(url)
  const payload = rawRes?.data ?? rawRes
  return {
    unitName: payload?.unitName ?? payload?.UnitName ?? null,
    programmeName: payload?.programmeName ?? payload?.ProgrammeName ?? null,
    semesterName: payload?.semesterName ?? payload?.SemesterName ?? null,
    students: Array.isArray(payload?.students) ? payload.students.map(normalizeStudent) : [],
  }
}

/**
 * 3. GET /api/v1/assessment/internal-assessment-evaluations/{category}/{courseworkOrTestGuid}/students/{studentGuid}/questions
 * All of one student's questions for one coursework/test, including answer file presigned URLs
 * Spec: get-questions.md
 */
export async function getStudentQuestions(
  category: number,
  courseworkOrTestGuid: string,
  studentGuid: string
): Promise<QuestionForEvaluationDto[]> {
  if (!courseworkOrTestGuid || !studentGuid) return []

  if (MOCK_AUTH) {
    return (
      MOCK_QUESTIONS_BY_STUDENT[studentGuid] ||
      MOCK_QUESTIONS_BY_STUDENT['9a4eebf7-a959-41fa-9979-71ae2f220268'] ||
      []
    )
  }

  const url = `${BASE_PATH}/${category}/${encodeURIComponent(courseworkOrTestGuid)}/students/${encodeURIComponent(studentGuid)}/questions`
  const data = await apiGet<any[] | null>(url)
  return Array.isArray(data) ? data.map(normalizeQuestion) : []
}

/**
 * 4. PUT /api/v1/assessment/internal-assessment-evaluations/{category}/{courseworkOrTestGuid}/students/{studentGuid}/questions/{questionGuid}/mark
 * Saves one question's mark immediately ("Save & Next")
 * Spec: put-mark.md
 */
export async function saveQuestionMark(
  category: number,
  courseworkOrTestGuid: string,
  studentGuid: string,
  questionGuid: string,
  mark: number | null
): Promise<SaveQuestionMarkResponseDto> {
  const payload = { mark }
  if (MOCK_AUTH) {
    return { questionGuid, mark }
  }

  if (!questionGuid || questionGuid === 'undefined') {
    throw new Error('Question ID is missing or invalid. Please reselect the student.')
  }

  const url = `${BASE_PATH}/${category}/${encodeURIComponent(courseworkOrTestGuid)}/students/${encodeURIComponent(studentGuid)}/questions/${encodeURIComponent(questionGuid)}/mark`

  try {
    console.log(`📡 [saveQuestionMark] PUT ${url}`, payload)
    const res = await apiPut<SaveQuestionMarkResponseDto>(url, payload)
    return res ?? { questionGuid, mark }
  } catch (err: any) {
    console.error('❌ [saveQuestionMark] Error saving mark:', err)
    throw new Error(err?.message || 'Failed to save question mark on server.')
  }
}

/**
 * 5. POST /api/v1/assessment/internal-assessment-evaluations/{category}/{courseworkOrTestGuid}/students/{studentGuid}/finalize
 * Closes out one student's evaluation, calculates total score, returns nextStudentGuid
 * Spec: post-finalize.md
 */
export async function finalizeStudent(
  category: number,
  courseworkOrTestGuid: string,
  studentGuid: string,
  comment?: string | null
): Promise<FinalizeStudentResponseDto> {
  const payload = {
    comment: comment && typeof comment === 'string' && comment.trim() ? comment.trim() : null,
  }
  if (MOCK_AUTH) {
    const mockUnit = MOCK_STUDENTS_BY_UNIT[courseworkOrTestGuid] || MOCK_STUDENTS_BY_UNIT['6b0ef15b-fddb-41b1-9adb-606034ab3e40']
    if (mockUnit) {
      const std = mockUnit.students.find(s => s.studentGuid === studentGuid)
      if (std) {
        std.evaluationStatus = 'Evaluated'
        std.mark = 28
        std.maxMark = 30
        std.evaluatedDate = new Date().toISOString()
        std.comment = comment || 'Good answers'
      }
    }
    return {
      totalMark: 28,
      totalMaxMark: 30,
      evaluatedDate: new Date().toISOString(),
      nextStudentGuid: null,
    }
  }

  const url = `${BASE_PATH}/${category}/${encodeURIComponent(courseworkOrTestGuid)}/students/${encodeURIComponent(studentGuid)}/finalize`

  try {
    console.log(`📡 [finalizeStudent] Calling POST ${url}`, payload)
    const res = await apiPost<any>(url, payload)
    const data = res?.data ?? res
    if (data) return data
    throw new Error('Empty response from finalize endpoint')
  } catch (err: any) {
    console.error('❌ [finalizeStudent] Finalize API call failed:', err)
    throw new Error(err?.message || 'Failed to finalize student evaluation')
  }
}

/**
 * 6. GET /api/v1/assessment/internal-assessment-evaluations/evaluated?intakeGuid={intakeGuid}
 * Dashboard's "Evaluated" list — rows where every student has been finalized
 * Spec: get-evaluated.md
 */
export async function getEvaluatedList(intakeGuid: string): Promise<PendingEvaluationDto[]> {
  if (MOCK_AUTH) return MOCK_EVALUATED_UNITS
  const url = `${BASE_PATH}/evaluated?intakeGuid=${encodeURIComponent(intakeGuid)}`
  const data = await apiGet<any[] | null>(url)
  return Array.isArray(data) ? data.map(normalizePendingUnit) : []
}
