import { apiPost, apiGet, apiGetBlob, apiDeleteWithMessage } from '@/lib/api/client'

export interface UePrintParams {
  programGuid: string
  semesterGuid: string
  courseUnitGuid: string
  intakeGuid: string
  streamGuid?: string | null
  confirm?: boolean
}

export interface UeOutcomeResponse {
  outcome: 'Printed' | 'Reprinted' | 'ExamRuleNotSet' | 'QuestionsNotAvailable' | 'ConfirmationRequired'
  message?: string
}

export interface UeBookletResponse {
  confirmationRequired: boolean
  message?: string
  wasReprint?: boolean
  totalStudentCount?: number
  addedStudentCount?: number
}

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// -- Dropdowns --
export function getUeQuestionPrintCourseUnits(programGuid: string, semesterGuid: string) {
  if (MOCK_AUTH) return Promise.resolve([
    { courseUnitGuid: 'cu-1', courseUnitCode: 'CS101', courseUnitName: 'Introduction to CS', unitTypeName: 'Theory' },
    { courseUnitGuid: 'cu-2', courseUnitCode: 'CS103', courseUnitName: 'Advanced CS', unitTypeName: 'Theory' }
  ])
  const params = new URLSearchParams({
    programGuid: programGuid?.toUpperCase() || '',
    semesterGuid: semesterGuid?.toUpperCase() || ''
  })
  return apiGet<{ courseUnitGuid: string; courseUnitCode: string; courseUnitName: string }[]>(`/api/v1/assessment/ue-question-print/course-units?${params.toString()}`)
}

// -- Theory Actions --
export function printUeQuestionTheory(data: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ outcome: 'Printed' as const, message: '' })
  return apiPost<UeOutcomeResponse>('/api/v1/assessment/ue-question-print/theory', data)
}

export function downloadUeQuestionTheoryPdf(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock pdf content'], { type: 'application/pdf' }), filename: 'mock-theory.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/ue-question-print/theory/pdf?${params.toString()}`)
}

export function downloadUeQuestionTheoryWord(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock word content'], { type: 'application/msword' }), filename: 'mock-theory.doc' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/ue-question-print/theory/word?${params.toString()}`)
}

export function deleteUeQuestionTheory(data: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ data: true, message: 'Deleted successfully' })
  const params = new URLSearchParams({
    programGuid: data.programGuid?.toUpperCase() || '',
    semesterGuid: data.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: data.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: data.intakeGuid?.toUpperCase() || ''
  })
  if (data.confirm !== undefined) params.append('confirm', String(data.confirm))
  // Callers need both `data` (false = confirm step) and the message.
  return apiDeleteWithMessage<boolean>(`/api/v1/assessment/ue-question-print/theory?${params.toString()}`)
}

export function downloadUeQuestionTheoryAnswerKey(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock answer key'], { type: 'application/pdf' }), filename: 'answer-key.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/ue-question-print/theory/answer-key?${params.toString()}`)
}

// -- Booklet Actions --
export function printUeBooklet(data: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ confirmationRequired: false, message: '', wasReprint: false, totalStudentCount: 42, addedStudentCount: 0 })
  return apiPost<UeBookletResponse>('/api/v1/assessment/ue-booklet', data)
}

export function downloadUeBookletPdf(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock pdf content'], { type: 'application/pdf' }), filename: 'mock-booklet.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.streamGuid) params.append('streamGuid', paramsObj.streamGuid)
  return apiGetBlob(`/api/v1/assessment/ue-booklet/pdf?${params.toString()}`)
}

export function downloadUeBookletAttendance(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock attendance'], { type: 'application/pdf' }), filename: 'attendance.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.streamGuid) params.append('streamGuid', paramsObj.streamGuid)
  return apiGetBlob(`/api/v1/assessment/ue-booklet/attendance/pdf?${params.toString()}`)
}

export function downloadUeBookletCover(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock cover'], { type: 'application/pdf' }), filename: 'cover.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  if (paramsObj.streamGuid) params.append('streamGuid', paramsObj.streamGuid)
  return apiGetBlob(`/api/v1/assessment/ue-booklet/cover/pdf?${params.toString()}`)
}

// -- Mark Sheet --
export function downloadUeConsolidatedMarkSheet(paramsObj: UePrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock marksheet'], { type: 'application/pdf' }), filename: 'marksheet.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid?.toUpperCase() || '',
    semesterGuid: paramsObj.semesterGuid?.toUpperCase() || '',
    courseUnitGuid: paramsObj.courseUnitGuid?.toUpperCase() || '',
    intakeGuid: paramsObj.intakeGuid?.toUpperCase() || ''
  })
  return apiGetBlob(`/api/v1/assessment/consolidated-mark-sheet/pdf?${params.toString()}`)
}
