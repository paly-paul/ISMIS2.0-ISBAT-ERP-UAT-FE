import { apiPost, apiGet, apiGetBlob, apiDeleteWithMessage } from '@/lib/api/client'

// DELETE /theory and /practical are confirm-before-delete: without
// confirm=true they answer { data: false, message: "You are about to
// delete … Do you want to continue?" } and delete nothing; with it,
// { data: true, message: "Deleted successfully......!" }. The page needs
// both fields, so these use apiDeleteWithMessage (plain apiDelete returns
// only the bare boolean).
export interface ResitDeleteResponse {
  data: boolean
  message: string | null
}

function mockDelete(confirm?: boolean): Promise<ResitDeleteResponse> {
  return Promise.resolve(confirm
    ? { data: true, message: 'Deleted successfully......!' }
    : { data: false, message: 'You are about to delete the resit QP set of this unit. Do you want to continue?' })
}

export interface ResitParams {
  programGuid: string
  semesterGuid: string
  courseUnitGuid: string
  academicIntakeGuid: string
  questionBankIntakeGuid?: string // Mostly for theory
  ueType?: number // Booklet calls: 0 Theory, 1 Practical — print and every download must match
  confirm?: boolean
}

export interface ResitOutcomeResponse {
  outcome: 'Printed' | 'Reprinted' | 'ScheduleNotSet' | 'QuestionsNotAvailable' | 'ConfirmationRequired'
  message?: string
}

export interface ResitBookletResponse {
  confirmationRequired: boolean
  message?: string
  totalStudentCount?: number
  addedStudentCount?: number
}

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// -- Dropdowns --
export function getResitCourseUnits(programGuid: string, semesterGuid: string, academicIntakeGuid: string) {
  if (MOCK_AUTH) return Promise.resolve([
    { courseUnitGuid: 'cu-1', courseUnitCode: 'CS101', courseUnitName: 'Introduction to CS', unitTypeName: 'Theory' },
    { courseUnitGuid: 'cu-2', courseUnitCode: 'CS102', courseUnitName: 'Practical CS', unitTypeName: 'Practical' }
  ])
  const params = new URLSearchParams({
    programGuid: programGuid?.toUpperCase() || '',
    semesterGuid: semesterGuid?.toUpperCase() || '',
    academicIntakeGuid: academicIntakeGuid?.toUpperCase() || ''
  })
  return apiGet<any[]>(`/api/v1/assessment/resit-question-print/course-units?${params.toString()}`)
}

// -- Theory Actions --
export function postResitTheory(data: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ outcome: 'Printed' as const, message: '' })
  return apiPost<ResitOutcomeResponse>('/api/v1/assessment/resit-question-print/theory', data)
}
export function getResitTheoryPdf(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock pdf content'], { type: 'application/pdf' }), filename: 'mock-theory.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.questionBankIntakeGuid) params.append('questionBankIntakeGuid', paramsObj.questionBankIntakeGuid)
  return apiGetBlob(`/api/v1/assessment/resit-question-print/theory/pdf?${params.toString()}`)
}
export function getResitTheoryWord(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock word content'], { type: 'application/msword' }), filename: 'mock-theory.doc' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.questionBankIntakeGuid) params.append('questionBankIntakeGuid', paramsObj.questionBankIntakeGuid)
  return apiGetBlob(`/api/v1/assessment/resit-question-print/theory/word?${params.toString()}`)
}
export function deleteResitTheory(data: ResitParams): Promise<ResitDeleteResponse> {
  if (MOCK_AUTH) return mockDelete(data.confirm)
  const params = new URLSearchParams({
    programGuid: data.programGuid?.toUpperCase() || '',
    semesterGuid: data.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: data.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: data.academicIntakeGuid?.toUpperCase() || ''
  })
  if (data.confirm !== undefined) params.append('confirm', String(data.confirm))
  return apiDeleteWithMessage<boolean>(`/api/v1/assessment/resit-question-print/theory?${params.toString()}`)
}
export function getResitTheoryAnswerKey(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock answer key'], { type: 'application/pdf' }), filename: 'answer-key.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/resit-question-print/theory/answer-key?${params.toString()}`)
}

// -- Practical Actions --
export function postResitPractical(data: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ outcome: 'Printed' as const, message: '' })
  return apiPost<ResitOutcomeResponse>('/api/v1/assessment/resit-question-print/practical', data)
}
export function getResitPracticalPdf(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock pdf content'], { type: 'application/pdf' }), filename: 'mock-practical.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/resit-question-print/practical/pdf?${params.toString()}`)
}
export function getResitPracticalWord(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock word content'], { type: 'application/msword' }), filename: 'mock-practical.doc' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/resit-question-print/practical/word?${params.toString()}`)
}
export function deleteResitPractical(data: ResitParams): Promise<ResitDeleteResponse> {
  if (MOCK_AUTH) return mockDelete(data.confirm)
  const params = new URLSearchParams({
    programGuid: data.programGuid?.toUpperCase() || '',
    semesterGuid: data.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: data.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: data.academicIntakeGuid?.toUpperCase() || ''
  })
  if (data.confirm !== undefined) params.append('confirm', String(data.confirm))
  return apiDeleteWithMessage<boolean>(`/api/v1/assessment/resit-question-print/practical?${params.toString()}`)
}

// -- Booklet Actions --
export function postResitBooklet(data: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ confirmationRequired: false, message: '', totalStudentCount: 10, addedStudentCount: 10 })
  return apiPost<ResitBookletResponse>('/api/v1/assessment/resit-booklet', data)
}
export function getResitBookletPdf(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock booklet content'], { type: 'application/pdf' }), filename: 'mock-booklet.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.ueType !== undefined) params.append('ueType', String(paramsObj.ueType))
  return apiGetBlob(`/api/v1/assessment/resit-booklet/pdf?${params.toString()}`)
}
export function getResitBookletAttendancePdf(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock attendance'], { type: 'application/pdf' }), filename: 'attendance.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.ueType !== undefined) params.append('ueType', String(paramsObj.ueType))
  return apiGetBlob(`/api/v1/assessment/resit-booklet/attendance/pdf?${params.toString()}`)
}
export function getResitBookletCoverPdf(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock cover letter'], { type: 'application/pdf' }), filename: 'cover-letter.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.ueType !== undefined) params.append('ueType', String(paramsObj.ueType))
  return apiGetBlob(`/api/v1/assessment/resit-booklet/cover/pdf?${params.toString()}`)
}
export function getResitBookletConsolidatedPdf(paramsObj: ResitParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock mark sheet'], { type: 'application/pdf' }), filename: 'mark-sheet.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    academicIntakeGuid: paramsObj.academicIntakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.ueType !== undefined) params.append('ueType', String(paramsObj.ueType))
  return apiGetBlob(`/api/v1/assessment/resit-booklet/consolidated/pdf?${params.toString()}`)
}
