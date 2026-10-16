import { apiGet, apiPost, apiDelete } from '../client'

const BASE_PATH = '/api/v1/assessment/cw-rectification'

// ── Types & DTOs matching cw-rectification specifications ──────────────────────

export interface CwIntakeOption {
  intakeGuid: string
  intakeCode: number
  description: string | null
}

export interface CwCourseUnitOption {
  courseUnitGuid: string
  courseUnitName: string | null
  courseUnitCode: string | null
}

export interface CwCourseworkOption {
  courseworkGuid: string
  courseworkNumber: number
  label: string
}

export interface CwStudentOption {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
}

export type CwSubmissionStatus = 'NotSubmitted' | 'Saved' | 'Submitted' | 'Evaluated'

export interface CwSubmissionSummary {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  submittedDate: string | null
  mark: number | null
  maxMark: number | null
  status: CwSubmissionStatus
  canDelete: boolean
  canReopen: boolean
  canReevaluate: boolean
  canRecheck: boolean
}

export interface CwRecheckQuestion {
  questionNumber: number
  questionText: string | null
  answerText: string | null
  cwFileId: number | null
  mark: number | null
  maxMark: number | null
}

export interface CwRecheckDetail {
  totalMark: number | null
  totalMaxMark: number | null
  questions: CwRecheckQuestion[]
}

// ── Client Normalizers ────────────────────────────────────────────────────────

function normalizeIntake(item: any): CwIntakeOption {
  return {
    intakeGuid: item.intakeGuid ?? item.IntakeGuid ?? '',
    intakeCode: Number(item.intakeCode ?? item.IntakeCode ?? 0),
    description: item.description ?? item.Description ?? null,
  }
}

function normalizeCourseUnit(item: any): CwCourseUnitOption {
  const rawName =
    item.courseUnitName ??
    item.CourseUnitName ??
    item.unitName ??
    item.UnitName ??
    item.name ??
    item.Name ??
    item.courseUnit ??
    item.CourseUnit ??
    null

  const rawCode =
    item.courseUnitCode ??
    item.CourseUnitCode ??
    item.unitCode ??
    item.UnitCode ??
    item.code ??
    item.Code ??
    null

  const nameStr = rawName != null ? String(rawName).trim() : null
  const codeStr = rawCode != null ? String(rawCode).trim() : null

  const courseUnitName =
    nameStr && nameStr.toLowerCase() !== 'null' && nameStr !== 'undefined'
      ? nameStr
      : null

  const courseUnitCode =
    codeStr && codeStr.toLowerCase() !== 'null' && codeStr !== 'undefined'
      ? codeStr
      : null

  return {
    courseUnitGuid: item.courseUnitGuid ?? item.CourseUnitGuid ?? item.unitGuid ?? item.UnitGuid ?? '',
    courseUnitName,
    courseUnitCode,
  }
}

function normalizeCoursework(item: any): CwCourseworkOption {
  return {
    courseworkGuid: item.courseworkGuid ?? item.CourseworkGuid ?? '',
    courseworkNumber: Number(item.courseworkNumber ?? item.CourseworkNumber ?? item.CWNO ?? 1),
    label: item.label ?? item.Label ?? `CW ${item.courseworkNumber ?? 1}`,
  }
}

function normalizeStudent(item: any): CwStudentOption {
  return {
    studentGuid: item.studentGuid ?? item.StudentGuid ?? '',
    studentRegNo: item.studentRegNo ?? item.StudentRegNo ?? null,
    studentName: item.studentName ?? item.StudentName ?? null,
  }
}

function normalizeSummary(item: any): CwSubmissionSummary {
  const statusRaw = item.status ?? item.Status ?? 'NotSubmitted'
  let status: CwSubmissionStatus = 'NotSubmitted'
  if (statusRaw === 'Saved' || statusRaw === 'Submitted' || statusRaw === 'Evaluated') {
    status = statusRaw
  }

  return {
    studentGuid: item.studentGuid ?? item.StudentGuid ?? '',
    studentRegNo: item.studentRegNo ?? item.StudentRegNo ?? null,
    studentName: item.studentName ?? item.StudentName ?? null,
    submittedDate: item.submittedDate ?? item.SubmittedDate ?? null,
    mark: item.mark != null ? Number(item.mark) : (item.Mark != null ? Number(item.Mark) : null),
    maxMark: item.maxMark != null ? Number(item.maxMark) : (item.MaxMark != null ? Number(item.MaxMark) : null),
    status,
    canDelete: Boolean(item.canDelete ?? item.CanDelete ?? false),
    canReopen: Boolean(item.canReopen ?? item.CanReopen ?? false),
    canReevaluate: Boolean(item.canReevaluate ?? item.CanReevaluate ?? false),
    canRecheck: Boolean(item.canRecheck ?? item.CanRecheck ?? false),
  }
}

function normalizeRecheck(item: any): CwRecheckDetail {
  const qList = (item.questions ?? item.Questions ?? []).map((q: any) => ({
    questionNumber: Number(q.questionNumber ?? q.QuestionNumber ?? 1),
    questionText: q.questionText ?? q.QuestionText ?? null,
    answerText: q.answerText ?? q.AnswerText ?? null,
    cwFileId: q.cwFileId != null ? Number(q.cwFileId) : (q.CwFileId != null ? Number(q.CwFileId) : null),
    mark: q.mark != null ? Number(q.mark) : (q.Mark != null ? Number(q.Mark) : null),
    maxMark: q.maxMark != null ? Number(q.maxMark) : (q.MaxMark != null ? Number(q.MaxMark) : null),
  }))

  return {
    totalMark: item.totalMark != null ? Number(item.totalMark) : (item.TotalMark != null ? Number(item.TotalMark) : null),
    totalMaxMark: item.totalMaxMark != null ? Number(item.totalMaxMark) : (item.TotalMaxMark != null ? Number(item.TotalMaxMark) : null),
    questions: qList,
  }
}

// ── Live API Functions (Pure Live - No Dummy Fallbacks) ────────────────────────

/**
 * 1. GET /api/v1/assessment/cw-rectification/intakes
 * Spec: get-intakes.md
 */
export async function getCwIntakes(): Promise<CwIntakeOption[]> {
  try {
    const res = await apiGet<any>(`${BASE_PATH}/intakes`)
    const list = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : [])
    if (list.length > 0) {
      return list.map(normalizeIntake)
    }
  } catch (err: any) {
    console.warn('ℹ️ [CW Rectification] Live intakes API error:', err?.message || err)
  }
  return []
}

/**
 * 2. GET /api/v1/assessment/cw-rectification/intakes/{intakeGuid}/course-units
 * Spec: get-course-units.md
 */
export async function getCwCourseUnits(intakeGuid: string): Promise<CwCourseUnitOption[]> {
  if (!intakeGuid) return []
  try {
    const res = await apiGet<any>(`${BASE_PATH}/intakes/${encodeURIComponent(intakeGuid)}/course-units`)
    const list: any[] = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : [])
    if (list.length > 0) {
      return list
        .map(normalizeCourseUnit)
        .filter((u: CwCourseUnitOption) => Boolean(u.courseUnitName && u.courseUnitName.trim().length > 0))
    }
  } catch (err: any) {
    console.warn('ℹ️ [CW Rectification] Live course-units API error:', err?.message || err)
  }
  return []
}

/**
 * 3. GET /api/v1/assessment/cw-rectification/intakes/{intakeGuid}/course-units/{courseUnitGuid}/courseworks
 * Spec: get-courseworks.md
 */
export async function getCwCourseworks(
  intakeGuid: string,
  courseUnitGuid: string
): Promise<CwCourseworkOption[]> {
  if (!intakeGuid || !courseUnitGuid) return []
  try {
    const res = await apiGet<any>(
      `${BASE_PATH}/intakes/${encodeURIComponent(intakeGuid)}/course-units/${encodeURIComponent(courseUnitGuid)}/courseworks`
    )
    const list = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : [])
    if (list.length > 0) {
      return list.map(normalizeCoursework)
    }
  } catch (err: any) {
    console.warn('ℹ️ [CW Rectification] Live courseworks API error:', err?.message || err)
  }
  return []
}

/**
 * 4. GET /api/v1/assessment/cw-rectification/intakes/{intakeGuid}/course-units/{courseUnitGuid}/courseworks/{courseworkNumber}/students
 * Spec: get-students.md
 */
export async function getCwStudents(
  intakeGuid: string,
  courseUnitGuid: string,
  courseworkNumber: number
): Promise<CwStudentOption[]> {
  if (!intakeGuid || !courseUnitGuid || !courseworkNumber) return []
  try {
    const res = await apiGet<any>(
      `${BASE_PATH}/intakes/${encodeURIComponent(intakeGuid)}/course-units/${encodeURIComponent(courseUnitGuid)}/courseworks/${courseworkNumber}/students`
    )
    const list = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : [])
    if (list.length > 0) {
      return list.map(normalizeStudent)
    }
  } catch (err: any) {
    console.warn('ℹ️ [CW Rectification] Live students API error:', err?.message || err)
  }
  return []
}

/**
 * 5. GET /api/v1/assessment/cw-rectification/{courseworkGuid}/students/{studentGuid}
 * Spec: get-submission-summary.md
 */
export async function getCwSubmissionSummary(
  courseworkGuid: string,
  studentGuid: string
): Promise<CwSubmissionSummary | null> {
  if (!courseworkGuid || !studentGuid) return null

  try {
    const res = await apiGet<any>(
      `${BASE_PATH}/${encodeURIComponent(courseworkGuid)}/students/${encodeURIComponent(studentGuid)}`
    )
    const data = res?.data ?? res
    if (data && (data.studentGuid || data.StudentGuid || data.status || data.Status)) {
      return normalizeSummary(data)
    }
  } catch (err: any) {
    console.warn('ℹ️ [CW Rectification] Live summary API error:', err?.message || err)
  }

  return null
}

/**
 * 6. DELETE /api/v1/assessment/cw-rectification/{courseworkGuid}/students/{studentGuid}/submission
 * Spec: delete-submission.md
 */
export async function deleteCwSubmission(
  courseworkGuid: string,
  studentGuid: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiDelete<any>(
    `${BASE_PATH}/${encodeURIComponent(courseworkGuid)}/students/${encodeURIComponent(studentGuid)}/submission`
  )
  return {
    success: true,
    message: res?.message ?? 'Submission deleted successfully.',
  }
}

/**
 * 7. POST /api/v1/assessment/cw-rectification/{courseworkGuid}/students/{studentGuid}/reopen
 * Spec: reopen-submission.md
 */
export async function reopenCwSubmission(
  courseworkGuid: string,
  studentGuid: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiPost<any>(
    `${BASE_PATH}/${encodeURIComponent(courseworkGuid)}/students/${encodeURIComponent(studentGuid)}/reopen`,
    {}
  )
  return {
    success: true,
    message: res?.message ?? 'Submission reopened successfully.',
  }
}

/**
 * 8. POST /api/v1/assessment/cw-rectification/{courseworkGuid}/students/{studentGuid}/reevaluate
 * Spec: reevaluate-submission.md
 */
export async function reevaluateCwSubmission(
  courseworkGuid: string,
  studentGuid: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiPost<any>(
    `${BASE_PATH}/${encodeURIComponent(courseworkGuid)}/students/${encodeURIComponent(studentGuid)}/reevaluate`,
    {}
  )
  return {
    success: true,
    message: res?.message ?? 'Evaluation cleared successfully. Submission awaiting evaluation.',
  }
}

/**
 * 9. GET /api/v1/assessment/cw-rectification/{courseworkGuid}/students/{studentGuid}/recheck
 * Spec: get-recheck.md
 */
export async function getCwRecheck(
  courseworkGuid: string,
  studentGuid: string
): Promise<CwRecheckDetail | null> {
  if (!courseworkGuid || !studentGuid) return null
  try {
    const res = await apiGet<any>(
      `${BASE_PATH}/${encodeURIComponent(courseworkGuid)}/students/${encodeURIComponent(studentGuid)}/recheck`
    )
    const data = res?.data ?? res
    if (data) {
      return normalizeRecheck(data)
    }
  } catch (err: any) {
    console.warn('ℹ️ [CW Rectification] Live recheck API error:', err?.message || err)
  }
  return null
}
