import { apiGet, apiPut } from '../client'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Reference Data (Init)
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkScheduleIntakeItem {
  intakeGuid: string
  intakeCode: number
  description: string | null
  currentIntake: boolean | null
}

export interface BulkScheduleCampusItem {
  campusGuid: string
  campusCode: string
  campusName: string
}

export interface BulkScheduleInitResponse {
  intakes: BulkScheduleIntakeItem[]
  campuses: BulkScheduleCampusItem[]
}

export async function getBulkScheduleInit(): Promise<BulkScheduleInitResponse> {
  const res = await apiGet<BulkScheduleInitResponse>('/api/v1/assessment/ia-bulk-cw-schedule/init')
  return {
    intakes: Array.isArray(res?.intakes) ? res.intakes : [],
    campuses: Array.isArray(res?.campuses) ? res.campuses : [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Common Scheduling Status & Scope Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkScheduleStatusResponse {
  isFullyScheduled: boolean
  totalCount: number
  scheduledCount: number
}

export interface BaseBulkScheduleScopeParams {
  academicIntakeGuid: string
  campusGuid?: string | null
  programGuid?: string | null
  semesterGuid?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Coursework & CA Bulk Scheduling (ia-bulk-cw-schedule)
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkCwScheduleScopeParams extends BaseBulkScheduleScopeParams {
  cwNo: 1 | 2 // 1 = Course Work, 2 = CA
  term?: number | null // Required if cwNo=1 (1=Term 1, 2=Term 2, 3=Both); must be omitted if cwNo=2
}

export interface BulkCwSchedulePreviewResponse {
  matchCount: number
  scheduledCount: number
  unscheduledCount: number
  scheduledStartDateTime: string | null
  scheduledEndDateTime: string | null
  maxMark: number | null
  courseworkType: number | null // 0 = Online, 1 = Offline
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface BulkUpdateCwScheduleRequest {
  scheduledStartDateTime: string
  scheduledEndDateTime: string
  maxMark: number
  courseworkType: number // 0 = Online, 1 = Offline
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid?: string | null
}

export interface BulkUpdateResponse {
  success: boolean
  data: number // updated records count
  message: string
}

/** Check status for a single Programme Semester (CW1 or CA) */
export async function getBulkCwScheduleStatus(params: {
  academicIntakeGuid: string
  programGuid: string
  semesterGuid: string
  cwNo: 1 | 2
}): Promise<BulkScheduleStatusResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    programGuid: params.programGuid,
    semesterGuid: params.semesterGuid,
    cwNo: String(params.cwNo),
  })
  return apiGet<BulkScheduleStatusResponse>(`/api/v1/assessment/ia-bulk-cw-schedule/status?${qs.toString()}`)
}

/** Dry-run preview for CW1 or CA bulk scheduling */
export async function getBulkCwSchedulePreview(params: BulkCwScheduleScopeParams): Promise<BulkCwSchedulePreviewResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    cwNo: String(params.cwNo),
  })
  // term required for cwNo=1, forbidden for cwNo=2
  if (params.cwNo === 1 && params.term != null) {
    qs.set('term', String(params.term))
  }
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiGet<BulkCwSchedulePreviewResponse>(`/api/v1/assessment/ia-bulk-cw-schedule/preview?${qs.toString()}`)
}

/** Execute bulk update for CW1 or CA */
export async function updateBulkCwSchedule(
  params: BulkCwScheduleScopeParams,
  body: BulkUpdateCwScheduleRequest
): Promise<BulkUpdateResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    cwNo: String(params.cwNo),
  })
  if (params.cwNo === 1 && params.term != null) {
    qs.set('term', String(params.term))
  }
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiPut<BulkUpdateResponse>(`/api/v1/assessment/ia-bulk-cw-schedule/?${qs.toString()}`, body)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Class Test Bulk Scheduling (ia-bulk-test-schedule)
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkTestScheduleScopeParams extends BaseBulkScheduleScopeParams {
  term: number // Required: 1 = Term 1, 2 = Term 2, 3 = Both
}

export interface BulkTestSchedulePreviewResponse {
  matchCount: number
  scheduledCount: number
  unscheduledCount: number
  scheduledStartDateTime: string | null
  scheduledEndDateTime: string | null
  durationMinutes: number | null
  maxMark: number | null
  testType: number | null // 0 = Online, 1 = Offline
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface BulkUpdateTestScheduleRequest {
  scheduledStartDateTime: string
  scheduledEndDateTime: string
  durationMinutes: number
  maxMark: number
  testType: number // 0 = Online, 1 = Offline
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid?: string | null
}

/** Check status for a single Programme Semester (Class Test) */
export async function getBulkTestScheduleStatus(params: {
  academicIntakeGuid: string
  programGuid: string
  semesterGuid: string
}): Promise<BulkScheduleStatusResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    programGuid: params.programGuid,
    semesterGuid: params.semesterGuid,
  })
  return apiGet<BulkScheduleStatusResponse>(`/api/v1/assessment/ia-bulk-test-schedule/status?${qs.toString()}`)
}

/** Dry-run preview for Class Test bulk scheduling */
export async function getBulkTestSchedulePreview(params: BulkTestScheduleScopeParams): Promise<BulkTestSchedulePreviewResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    term: String(params.term),
  })
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiGet<BulkTestSchedulePreviewResponse>(`/api/v1/assessment/ia-bulk-test-schedule/preview?${qs.toString()}`)
}

/** Execute bulk update for Class Test */
export async function updateBulkTestSchedule(
  params: BulkTestScheduleScopeParams,
  body: BulkUpdateTestScheduleRequest
): Promise<BulkUpdateResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    term: String(params.term),
  })
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiPut<BulkUpdateResponse>(`/api/v1/assessment/ia-bulk-test-schedule/?${qs.toString()}`, body)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. University Exam Bulk Scheduling (ia-bulk-ue-schedule)
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkUeScheduleScopeParams extends BaseBulkScheduleScopeParams {
  term: number // Required: 1 = Term 1, 2 = Term 2, 3 = Both
}

export interface BulkUeSchedulePreviewResponse {
  matchCount: number
  scheduledCount: number
  unscheduledCount: number
  examDate: string | null
  startTime: string | null
  endTime: string | null
  maxMark: number | null
  examType: number | null // 0 = Online, 1 = Offline
  universityExamType: number | null // 0 = Theory, 1 = Practical
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface BulkUpdateUeScheduleRequest {
  examDate: string
  startTime: string
  endTime: string
  maxMark: number
  examType: number // 0 = Online, 1 = Offline
  universityExamType: number // 0 = Theory, 1 = Practical
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid?: string | null
}

/** Check status for a single Programme Semester (University Exam) */
export async function getBulkUeScheduleStatus(params: {
  academicIntakeGuid: string
  programGuid: string
  semesterGuid: string
}): Promise<BulkScheduleStatusResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    programGuid: params.programGuid,
    semesterGuid: params.semesterGuid,
  })
  return apiGet<BulkScheduleStatusResponse>(`/api/v1/assessment/ia-bulk-ue-schedule/status?${qs.toString()}`)
}

/** Dry-run preview for University Exam bulk scheduling */
export async function getBulkUeSchedulePreview(params: BulkUeScheduleScopeParams): Promise<BulkUeSchedulePreviewResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    term: String(params.term),
  })
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiGet<BulkUeSchedulePreviewResponse>(`/api/v1/assessment/ia-bulk-ue-schedule/preview?${qs.toString()}`)
}

/** Execute bulk update for University Exam */
export async function updateBulkUeSchedule(
  params: BulkUeScheduleScopeParams,
  body: BulkUpdateUeScheduleRequest
): Promise<BulkUpdateResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    term: String(params.term),
  })
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiPut<BulkUpdateResponse>(`/api/v1/assessment/ia-bulk-ue-schedule/?${qs.toString()}`, body)
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Mock (CBT) Bulk Scheduling (ia-bulk-mock-schedule)
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkMockSchedulePreviewResponse {
  matchCount: number
  scheduledCount: number
  unscheduledCount: number
  scheduledStartDateTime: string | null
  scheduledEndDateTime: string | null
  durationMinutes: number | null
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface BulkUpdateMockScheduleRequest {
  scheduledStartDateTime: string
  scheduledEndDateTime: string
  durationMinutes: number
  examRuleGuid?: string | null
}

/** Check status for a single Programme Semester (Mock Exam) */
export async function getBulkMockScheduleStatus(params: {
  academicIntakeGuid: string
  programGuid: string
  semesterGuid: string
}): Promise<BulkScheduleStatusResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
    programGuid: params.programGuid,
    semesterGuid: params.semesterGuid,
  })
  return apiGet<BulkScheduleStatusResponse>(`/api/v1/assessment/ia-bulk-mock-schedule/status?${qs.toString()}`)
}

/** Dry-run preview for Mock Exam bulk scheduling */
export async function getBulkMockSchedulePreview(params: BaseBulkScheduleScopeParams): Promise<BulkMockSchedulePreviewResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
  })
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiGet<BulkMockSchedulePreviewResponse>(`/api/v1/assessment/ia-bulk-mock-schedule/preview?${qs.toString()}`)
}

/** Execute bulk update for Mock Exam */
export async function updateBulkMockSchedule(
  params: BaseBulkScheduleScopeParams,
  body: BulkUpdateMockScheduleRequest
): Promise<BulkUpdateResponse> {
  const qs = new URLSearchParams({
    academicIntakeGuid: params.academicIntakeGuid,
  })
  if (params.programGuid && params.semesterGuid) {
    qs.set('programGuid', params.programGuid)
    qs.set('semesterGuid', params.semesterGuid)
  } else if (params.campusGuid) {
    qs.set('campusGuid', params.campusGuid)
  }

  return apiPut<BulkUpdateResponse>(`/api/v1/assessment/ia-bulk-mock-schedule/?${qs.toString()}`, body)
}
