import { apiPost, apiGetBlob, apiDeleteWithMessage } from '@/lib/api/client'

export interface UePracticalPrintParams {
  programGuid: string
  semesterGuid: string
  courseUnitGuid: string
  intakeGuid: string
  streamGuid?: string | null
  confirm?: boolean
}

// The outcome enum may arrive by name or by number (0 Printed, 1 Reprinted,
// 2 ExamRuleNotSet, 3 QuestionsNotAvailable, 4 ConfirmationRequired) — the
// page handles both.
export interface UePracticalOutcomeResponse {
  outcome: 'Printed' | 'Reprinted' | 'ExamRuleNotSet' | 'QuestionsNotAvailable' | 'ConfirmationRequired' | 0 | 1 | 2 | 3 | 4
  message?: string
}

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export function printUeQuestionPractical(data: UePracticalPrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ outcome: 'Printed' as const, message: '' })
  return apiPost<UePracticalOutcomeResponse>('/api/v1/assessment/ue-question-print/practical', data)
}

export function downloadUeQuestionPracticalPdf(paramsObj: UePracticalPrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock pdf content'], { type: 'application/pdf' }), filename: 'mock-practical.pdf' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid || '',
    semesterGuid: paramsObj.semesterGuid || '',
    courseUnitGuid: paramsObj.courseUnitGuid || '',
    intakeGuid: paramsObj.intakeGuid || ''
  })
  if (paramsObj.streamGuid) params.append('streamGuid', paramsObj.streamGuid)
  return apiGetBlob(`/api/v1/assessment/ue-question-print/practical/pdf?${params.toString()}`)
}

export function downloadUeQuestionPracticalWord(paramsObj: UePracticalPrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock word content'], { type: 'application/msword' }), filename: 'mock-practical.doc' })
  const params = new URLSearchParams({
    programGuid: paramsObj.programGuid || '',
    semesterGuid: paramsObj.semesterGuid || '',
    courseUnitGuid: paramsObj.courseUnitGuid || '',
    intakeGuid: paramsObj.intakeGuid || ''
  })
  if (paramsObj.streamGuid) params.append('streamGuid', paramsObj.streamGuid)
  return apiGetBlob(`/api/v1/assessment/ue-question-print/practical/word?${params.toString()}`)
}

export function deleteUeQuestionPractical(data: UePracticalPrintParams) {
  if (MOCK_AUTH) return Promise.resolve({ data: true, message: 'Deleted successfully' })
  const params = new URLSearchParams({
    programGuid: data.programGuid || '',
    semesterGuid: data.semesterGuid || '',
    courseUnitGuid: data.courseUnitGuid || '',
    intakeGuid: data.intakeGuid || ''
  })
  if (data.streamGuid) params.append('streamGuid', data.streamGuid)
  if (data.confirm !== undefined) params.append('confirm', String(data.confirm))
  // The confirm step answers `data: false` + a "You are about to delete…"
  // message (delete-practical.md) — plain apiDelete drops the message and
  // returns the bare boolean, so callers need both.
  return apiDeleteWithMessage<boolean>(`/api/v1/assessment/ue-question-print/practical?${params.toString()}`)
}
