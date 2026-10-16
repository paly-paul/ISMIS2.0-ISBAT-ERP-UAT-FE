import { useQuery, useMutation } from '@tanstack/react-query'
import {
  getTranscriptPrintEligibility,
  getTranscriptPrintPdf,
  getTranscriptPrintBulkPdf,
} from '@/lib/api/assessment/transcriptPrint'

export function useTranscriptPrintEligibility(academicIntakeGuid: string | null, programGuid: string | null, semesterGuid: string | null) {
  return useQuery({
    queryKey: ['transcript-print-eligibility', academicIntakeGuid, programGuid, semesterGuid],
    queryFn: () => getTranscriptPrintEligibility(academicIntakeGuid!, programGuid!, semesterGuid!),
    enabled: !!(academicIntakeGuid && programGuid && semesterGuid),
  })
}

export function useDownloadTranscriptPrintPdf() {
  return useMutation({
    mutationFn: (studentGuid: string) => getTranscriptPrintPdf(studentGuid)
  })
}

export function useDownloadTranscriptPrintBulkPdf() {
  return useMutation({
    mutationFn: (params: { academicIntakeGuid: string, programGuid: string, semesterGuid: string }) => 
      getTranscriptPrintBulkPdf(params.academicIntakeGuid, params.programGuid, params.semesterGuid)
  })
}
