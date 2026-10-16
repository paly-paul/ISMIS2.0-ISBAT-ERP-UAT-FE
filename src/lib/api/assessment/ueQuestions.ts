import { apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// ── Types & DTOs ─────────────────────────────────────────────────────────────

export interface UeCourseUnitDto {
  courseUnitGuid: string
  courseUnitName: string | null
  courseUnitCode: string | null
}

export interface UeQuestionSummaryDto {
  totalCount: number
  sectionACount: number
  sectionBCount: number
  sectionCCount: number
  isVerified: boolean
}

export interface UeQuestionDto {
  questionGuid: string
  courseUnitGuid: string | null
  category: number | null
  questionType: number | null // 1 = MCQ, 2 = Descriptive
  questionText: string | null
  option1Text: string | null
  option2Text: string | null
  option3Text: string | null
  option4Text: string | null
  answerText: string | null
  level: number | null // 1 = Section A, 2 = Section B, 3 = Section C
  universityExamType: number | null // 0 = Theory, 1 = Practical
  isVerified: boolean | null
  verifiedBy: string | null
  verifiedDate: string | null
}

export interface SaveUeQuestionRequest {
  courseUnitGuid: string
  category: number // 5 = University Exam
  questionType: number // 1 = MCQ, 2 = Descriptive
  level: number // 1 = Section A, 2 = Section B, 3 = Section C
  questionText: string
  option1Text?: string | null
  option2Text?: string | null
  option3Text?: string | null
  option4Text?: string | null
  answerText: string
  universityExamType: number // 0 = Theory, 1 = Practical
}

export interface ApiProbeResult {
  endpoint: string
  method: string
  status: number
  statusText: string
  ok: boolean
  bodyPreview: string
  diagnosis: string
}

// ── Live Backend API Functions ───────────────────────────────────────────────

/**
 * GET /api/v1/assessment/ue-question/course-units
 */
export async function getUeCourseUnits(): Promise<UeCourseUnitDto[]> {
  try {
    const data = await apiGet<UeCourseUnitDto[]>('/api/v1/assessment/ue-question/course-units')
    if (data && Array.isArray(data)) {
      return data
    }
    return []
  } catch (err: any) {
    console.warn('ℹ️ [UE CourseUnits] Could not fetch from backend:', err?.message || err)
    return []
  }
}

/**
 * GET /api/v1/assessment/ue-question/summary
 */
export async function getUeQuestionSummary(
  courseUnitGuid: string,
  category = 5,
  ueType = 0
): Promise<UeQuestionSummaryDto> {
  const emptySummary: UeQuestionSummaryDto = {
    totalCount: 0,
    sectionACount: 0,
    sectionBCount: 0,
    sectionCCount: 0,
    isVerified: false,
  }

  if (!courseUnitGuid) {
    return emptySummary
  }

  const params = new URLSearchParams({
    courseUnitGuid,
    category: String(category),
    ueType: String(ueType),
  })

  try {
    const data = await apiGet<UeQuestionSummaryDto>(`/api/v1/assessment/ue-question/summary?${params.toString()}`)
    return data ?? emptySummary
  } catch (err: any) {
    console.warn('ℹ️ [UE Summary] Could not fetch from backend:', err?.message || err)
    return emptySummary
  }
}

/**
 * GET /api/v1/assessment/ue-question/questions
 */
export async function getUeQuestions(
  courseUnitGuid: string,
  category = 5,
  level: number,
  ueType = 0
): Promise<UeQuestionDto[]> {
  if (!courseUnitGuid) {
    return []
  }

  const params = new URLSearchParams({
    courseUnitGuid,
    category: String(category),
    level: String(level),
    ueType: String(ueType),
  })

  try {
    const data = await apiGet<UeQuestionDto[]>(`/api/v1/assessment/ue-question/questions?${params.toString()}`)
    if (data && Array.isArray(data)) {
      return data
    }
    return []
  } catch (err: any) {
    console.warn(`ℹ️ [UE Questions] Could not fetch for level ${level}:`, err?.message || err)
    return []
  }
}

/**
 * GET /api/v1/assessment/ue-question/questions/{guid}
 */
export async function getUeQuestionByGuid(guid: string): Promise<UeQuestionDto> {
  return await apiGet<UeQuestionDto>(`/api/v1/assessment/ue-question/questions/${guid}`)
}

/**
 * POST /api/v1/assessment/ue-question/questions
 */
export async function createUeQuestion(payload: SaveUeQuestionRequest): Promise<UeQuestionDto> {
  return await apiPost<UeQuestionDto>('/api/v1/assessment/ue-question/questions', payload)
}

/**
 * PUT /api/v1/assessment/ue-question/questions/{guid}
 */
export async function updateUeQuestion(guid: string, payload: SaveUeQuestionRequest): Promise<UeQuestionDto> {
  return await apiPut<UeQuestionDto>(`/api/v1/assessment/ue-question/questions/${guid}`, payload)
}

/**
 * POST /api/v1/assessment/ue-question/verify
 */
export async function verifyUeQuestions(
  courseUnitGuid: string,
  category = 5,
  ueType = 0
): Promise<number> {
  const params = new URLSearchParams({
    courseUnitGuid,
    category: String(category),
    ueType: String(ueType),
  })
  return await apiPost<number>(`/api/v1/assessment/ue-question/verify?${params.toString()}`, {})
}

// ── Live Backend Diagnostic Probe ───────────────────────────────────────────

/**
 * Runs a live browser-side probe across all candidate endpoints using the active session cookie.
 */
export async function probeUeEndpoints(courseUnitGuid?: string): Promise<ApiProbeResult[]> {
  const testGuid = courseUnitGuid || 'b247b66f-dfb2-4d26-93c5-dd61ec30a119'

  const targets = [
    { method: 'GET', url: '/api/v1/assessment/ue-question/course-units', desc: 'Course Units (Singular)' },
    { method: 'GET', url: '/api/v1/assessment/ue-questions/course-units', desc: 'Course Units (Plural)' },
    { method: 'GET', url: '/api/v1/assessment/questions/course-units', desc: 'Questions Course Units' },
    { method: 'GET', url: '/api/v1/assessment/question-bank/course-units', desc: 'Question Bank Course Units' },
    { method: 'GET', url: `/api/v1/assessment/ue-question/summary?courseUnitGuid=${testGuid}&category=5&ueType=0`, desc: 'Summary (Singular)' },
    { method: 'GET', url: `/api/v1/assessment/ue-questions/summary?courseUnitGuid=${testGuid}&category=5&ueType=0`, desc: 'Summary (Plural)' },
    { method: 'GET', url: `/api/v1/assessment/ue-question/questions?courseUnitGuid=${testGuid}&category=5&level=1&ueType=0`, desc: 'Questions (Singular)' },
    { method: 'GET', url: `/api/v1/assessment/ue-questions/questions?courseUnitGuid=${testGuid}&category=5&level=1&ueType=0`, desc: 'Questions (Plural)' },
    { method: 'GET', url: '/api/v1/assessment/ia-creation/init', desc: 'IA Creation Init (Reference)' },
  ]

  const results: ApiProbeResult[] = []

  for (const t of targets) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const text = await res.text()
      let diag = ''
      if (res.status === 200) {
        diag = '✅ Live & Working (200 OK)'
      } else if (res.status === 404) {
        if (text.includes('No active intake found')) {
          diag = '❌ 404: No active intake in DB (CURRENTINTAKE=1 missing)'
        } else {
          diag = '❌ 404: Route not found / Not deployed on backend'
        }
      } else if (res.status === 401) {
        diag = '⚠️ 401: Unauthorized (erp_access cookie missing/expired)'
      } else if (res.status === 403) {
        diag = '⚠️ 403: Forbidden (missing assessment.qpvetting.verify)'
      } else {
        diag = `ℹ️ HTTP ${res.status}`
      }

      results.push({
        endpoint: t.url,
        method: t.method,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        bodyPreview: text.slice(0, 100) || '(empty)',
        diagnosis: diag,
      })
    } catch (err: any) {
      results.push({
        endpoint: t.url,
        method: t.method,
        status: 0,
        statusText: 'Network Error',
        ok: false,
        bodyPreview: err?.message || 'Failed to fetch',
        diagnosis: '❌ Network / CORS error',
      })
    }
  }

  return results
}
