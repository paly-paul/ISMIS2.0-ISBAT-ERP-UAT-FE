import { apiGet, apiGetBlob } from '@/lib/api/client'

export interface TranscriptPrintEligibilityRow {
  studentGuid: string
  studentRegNo: string
  studentName: string
  alreadyPrinted: boolean
}

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export function getTranscriptPrintEligibility(academicIntakeGuid: string, programGuid: string, semesterGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { studentGuid: 'st-1', studentRegNo: 'ISBAT/2026/001', studentName: 'John Doe', alreadyPrinted: false },
      { studentGuid: 'st-2', studentRegNo: 'ISBAT/2026/002', studentName: 'Jane Smith', alreadyPrinted: true },
      { studentGuid: 'st-3', studentRegNo: 'ISBAT/2026/003', studentName: 'Mike Johnson', alreadyPrinted: false },
    ] as TranscriptPrintEligibilityRow[])
  }
  
  const qs = new URLSearchParams()
  qs.set('academicIntakeGuid', academicIntakeGuid?.toUpperCase() || '')
  qs.set('programGuid', programGuid?.toUpperCase() || '')
  qs.set('semesterGuid', semesterGuid?.toUpperCase() || '')
  
  return apiGet<TranscriptPrintEligibilityRow[]>(`/api/v1/assessment/transcript-print/eligibility?${qs.toString()}`)
}

export function getTranscriptPrintPdf(studentGuid: string) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock transcript pdf content'], { type: 'application/pdf' }), filename: `transcript-${studentGuid}.pdf` })
  return apiGetBlob(`/api/v1/assessment/transcript-print/${studentGuid}/pdf`)
}

export function getTranscriptPrintBulkPdf(academicIntakeGuid: string, programGuid: string, semesterGuid: string) {
  if (MOCK_AUTH) return Promise.resolve({ blob: new Blob(['mock bulk transcript pdf content'], { type: 'application/pdf' }), filename: 'bulk-transcripts.pdf' })
  
  const qs = new URLSearchParams()
  qs.set('academicIntakeGuid', academicIntakeGuid?.toUpperCase() || '')
  qs.set('programGuid', programGuid?.toUpperCase() || '')
  qs.set('semesterGuid', semesterGuid?.toUpperCase() || '')
  
  return apiGetBlob(`/api/v1/assessment/transcript-print/bulk/pdf?${qs.toString()}`)
}
