import { apiGet, apiPost, apiPostForm, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Student module's Learning Mode page (see
// student/learning-mode/page.tsx). Confirmed against students/learning-mode/
// *.md (2026-08-31) — a single student's edit view (detail + update) and a
// campus-wide roster report both live on this one page, per every endpoint's
// own "Used by pages" entry. Only 3 real modes exist (1 Campus, 2 Blended,
// 3 Online). Mode changes go through apply → approve (2026-09-30):
// /student/learning-mode applies, /student/learning-mode-approval lists
// pending requests (report with learningModeChangeStatus=1) and approves.

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
  // While a change is pending (learningModeChangeStatus 1) these hold the
  // *requested* mode — apply writes it straight into T_STUDENT.LEARNINGMODE,
  // gated by the status flag until approval. The pre-request mode isn't
  // returned anywhere.
  learningMode: number | null
  learningModeLabel: string | null
  // Change-request workflow (get-student-learning-mode-detail.md,
  // 2026-09-30) — all null when no request has been made.
  learningModeChangeStatus?: LearningModeChangeStatus | null
  learningModeChangeStatusLabel?: string | null
  requestedLearningMode?: number | null
  requestedLearningModeLabel?: string | null
  learningModeChangeRemarks?: string | null
  // Pre-signed S3 URL — open via documentViewer's openDocumentForViewing.
  learningModeChangeDocumentUrl?: string | null
}

// 1 Applied (pending approval), 2 Approved.
export type LearningModeChangeStatus = 1 | 2

export interface ApplyLearningModeChangeInput {
  requestedLearningMode: number
  // Optional, max 500 chars.
  remarks?: string | null
  // Required by the backend.
  document: File
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

// GET /students/learning-mode/pending-approvals
// (get-pending-learning-mode-approvals.md, 2026-10-01) — every active student
// with a change request at status 1 (Applied), across all campuses.
// Programme/semester/batch names are null for a legacy student whose GUIDs
// don't resolve. documentUrl is a pre-signed S3 URL that expires.
export interface PendingLearningModeApprovalRow {
  studentGuid: string
  studentNum: string | null
  studentRegNo: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  batchGuid: string | null
  batchCode: string | null
  currentLearningMode: number | null
  currentLearningModeLabel: string | null
  requestedLearningMode: number | null
  requestedLearningModeLabel: string | null
  remarks: string | null
  documentUrl: string | null
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
  // 1 = only students awaiting approval (the approval queue), 2 = approved.
  learningModeChangeStatus?: LearningModeChangeStatus | null
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

// Raises a change request (post-apply-learning-mode-change.md). multipart:
// document is mandatory. Returns the detail with status 1 (Applied); 400
// `failure` if one is already pending or the student is inactive.
export function applyLearningModeChange(studentGuid: string, input: ApplyLearningModeChangeInput): Promise<StudentLearningModeDetail> {
  if (MOCK_AUTH) {
    const existing = mockDetails[studentGuid]
    if (existing?.learningModeChangeStatus === 1) return Promise.reject(new Error('A learning mode change request is already pending approval.'))
    const label = mockOptions.find(o => o.value === input.requestedLearningMode)?.label ?? null
    const updated: StudentLearningModeDetail = {
      ...(existing ?? { studentGuid, studentRegNo: null, studentNum: null, studentName: null, programGuid: null, programName: null, semesterGuid: null, semesterName: null }),
      learningMode: input.requestedLearningMode, learningModeLabel: label,
      learningModeChangeStatus: 1, learningModeChangeStatusLabel: 'Applied',
      requestedLearningMode: input.requestedLearningMode, requestedLearningModeLabel: label,
      learningModeChangeRemarks: input.remarks?.trim() || null,
      learningModeChangeDocumentUrl: URL.createObjectURL(input.document),
    }
    mockDetails[studentGuid] = updated
    return Promise.resolve(updated)
  }
  const formData = new FormData()
  formData.append('requestedLearningMode', String(input.requestedLearningMode))
  if (input.remarks?.trim()) formData.append('remarks', input.remarks.trim())
  formData.append('document', input.document)
  return apiPostForm<StudentLearningModeDetail>(`/api/v1/students/learning-mode/${studentGuid}/apply`, formData)
}

// Approves the pending request (post-approve-learning-mode-change.md). No
// body — the requested mode was already written on apply. There is no
// reject endpoint.
export function approveLearningModeChange(studentGuid: string): Promise<StudentLearningModeDetail> {
  if (MOCK_AUTH) {
    const existing = mockDetails[studentGuid]
    if (existing?.learningModeChangeStatus !== 1) return Promise.reject(new Error('No pending learning mode change request found for this student.'))
    const updated: StudentLearningModeDetail = { ...existing, learningModeChangeStatus: 2, learningModeChangeStatusLabel: 'Approved' }
    mockDetails[studentGuid] = updated
    return Promise.resolve(updated)
  }
  return apiPost<StudentLearningModeDetail>(`/api/v1/students/learning-mode/${studentGuid}/approve`, {})
}

// search matches student number / reg no exactly, or name as LIKE '%term%'.
// pageSize is 1–200 server-side (out of range falls back to 25).
export function getPendingLearningModeApprovals(search: string | null, pageNumber = 1, pageSize = 25): Promise<PagedResult<PendingLearningModeApprovalRow>> {
  if (MOCK_AUTH) {
    const term = search?.trim().toLowerCase() ?? ''
    const items: PendingLearningModeApprovalRow[] = Object.values(mockDetails)
      .filter(d => d.learningModeChangeStatus === 1)
      .filter(d => !term || d.studentNum?.toLowerCase() === term || d.studentRegNo?.toLowerCase() === term || (d.studentName ?? '').toLowerCase().includes(term))
      .map(d => ({
        studentGuid: d.studentGuid, studentNum: d.studentNum, studentRegNo: d.studentRegNo, studentName: d.studentName,
        programGuid: d.programGuid, programName: d.programName, semesterGuid: d.semesterGuid, semesterName: d.semesterName,
        batchGuid: null, batchCode: null,
        currentLearningMode: null, currentLearningModeLabel: null,
        requestedLearningMode: d.requestedLearningMode ?? d.learningMode, requestedLearningModeLabel: d.requestedLearningModeLabel ?? d.learningModeLabel,
        remarks: d.learningModeChangeRemarks ?? null, documentUrl: d.learningModeChangeDocumentUrl ?? null,
      }))
    return Promise.resolve({ items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), totalCount: items.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (search?.trim()) params.set('search', search.trim())
  return apiGet<PagedResult<PendingLearningModeApprovalRow> | null>(`/api/v1/students/learning-mode/pending-approvals?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

export function getLearningModeReport(filters: LearningModeReportFilters, pageNumber = 1, pageSize = 25): Promise<PagedResult<LearningModeReportRow>> {
  if (MOCK_AUTH) {
    const items: LearningModeReportRow[] = Object.values(mockDetails)
      .filter(d => !filters.learningModeChangeStatus || d.learningModeChangeStatus === filters.learningModeChangeStatus)
      .map(d => ({
        studentGuid: d.studentGuid, studentNum: d.studentNum, studentName: d.studentName, programGuid: d.programGuid, programName: d.programName,
        semesterGuid: d.semesterGuid, semesterName: d.semesterName, batchGuid: null, batchCode: null,
        learningMode: d.learningMode ?? 0, learningModeLabel: d.learningModeLabel ?? '—',
      }))
    return Promise.resolve({ items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), totalCount: items.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ campusGuid: filters.campusGuid, pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (filters.learningMode) params.set('learningMode', String(filters.learningMode))
  if (filters.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters.learningModeChangeStatus) params.set('learningModeChangeStatus', String(filters.learningModeChangeStatus))
  if (filters.search?.trim()) params.set('search', filters.search.trim().slice(0, 50))
  return apiGet<PagedResult<LearningModeReportRow> | null>(`/api/v1/students/learning-mode/report?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}
