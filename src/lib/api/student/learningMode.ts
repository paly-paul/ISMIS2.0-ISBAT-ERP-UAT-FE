import { apiGet, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Student module's Learning Mode page (see
// student/learning-mode/page.tsx). Confirmed against students/learning-mode/
// *.md (2026-08-31) — a single student's edit view (detail + update) and a
// campus-wide roster report both live on this one page, per every endpoint's
// own "Used by pages" entry. Only 3 real modes exist (1 Campus, 2 Blended,
// 3 Online) — the old mock's binary Campus/ODL toggle, plus its Campus
// Location/Online Region/Effective From/Reason/Remarks fields and Mode
// History timeline, have no backing field anywhere in this API and are
// dropped rather than faked.

export interface LearningModeOption {
  value: number
  label: string
}

export interface StudentLearningModeDetail {
  studentGuid: string
  studentRegNo: string | null
  studentNum: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  learningMode: number | null
  learningModeLabel: string | null
}

export interface LearningModeReportRow {
  studentGuid: string
  studentNum: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  batchGuid: string | null
  batchCode: string | null
  learningMode: number
  learningModeLabel: string
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface LearningModeReportFilters {
  campusGuid: string
  learningMode?: number | null
  intakeGuid?: string | null
  search?: string | null
}

const mockOptions: LearningModeOption[] = [
  { value: 1, label: 'Campus Mode' },
  { value: 2, label: 'Blended Mode' },
  { value: 3, label: 'Online Mode' },
]

const mockDetails: Record<string, StudentLearningModeDetail> = {}

export function getLearningModeOptions(): Promise<LearningModeOption[]> {
  if (MOCK_AUTH) return Promise.resolve(mockOptions)
  return apiGet<LearningModeOption[] | null>('/api/v1/students/learning-mode/options').then(data => data ?? [])
}

export function getStudentLearningModeDetail(studentGuid: string): Promise<StudentLearningModeDetail> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockDetails[studentGuid] ?? {
      studentGuid, studentRegNo: null, studentNum: null, studentName: null, programGuid: null, programName: null,
      semesterGuid: null, semesterName: null, learningMode: null, learningModeLabel: null,
    })
  }
  return apiGet<StudentLearningModeDetail>(`/api/v1/students/learning-mode/${studentGuid}`)
}

export function updateStudentLearningMode(studentGuid: string, learningMode: number): Promise<StudentLearningModeDetail> {
  if (MOCK_AUTH) {
    const label = mockOptions.find(o => o.value === learningMode)?.label ?? null
    const updated: StudentLearningModeDetail = {
      ...(mockDetails[studentGuid] ?? { studentGuid, studentRegNo: null, studentNum: null, studentName: null, programGuid: null, programName: null, semesterGuid: null, semesterName: null, learningMode: null, learningModeLabel: null }),
      learningMode, learningModeLabel: label,
    }
    mockDetails[studentGuid] = updated
    return Promise.resolve(updated)
  }
  return apiPut<StudentLearningModeDetail>(`/api/v1/students/learning-mode/${studentGuid}`, { learningMode })
}

export function getLearningModeReport(filters: LearningModeReportFilters, pageNumber = 1, pageSize = 25): Promise<PagedResult<LearningModeReportRow>> {
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber, pageSize })
  const params = new URLSearchParams({ campusGuid: filters.campusGuid, pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (filters.learningMode) params.set('learningMode', String(filters.learningMode))
  if (filters.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters.search?.trim()) params.set('search', filters.search.trim().slice(0, 50))
  return apiGet<PagedResult<LearningModeReportRow> | null>(`/api/v1/students/learning-mode/report?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}
