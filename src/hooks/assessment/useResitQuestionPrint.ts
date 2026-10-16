import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getResitCourseUnits,
  postResitTheory,
  getResitTheoryPdf,
  getResitTheoryWord,
  deleteResitTheory,
  getResitTheoryAnswerKey,
  postResitPractical,
  getResitPracticalPdf,
  getResitPracticalWord,
  deleteResitPractical,
  postResitBooklet,
  getResitBookletPdf,
  getResitBookletAttendancePdf,
  getResitBookletCoverPdf,
  getResitBookletConsolidatedPdf,
  ResitParams
} from '@/lib/api/assessment/resitQuestionPrint'

export function useResitCourseUnits(programGuid: string, semesterGuid: string, academicIntakeGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: ['resit-course-units', programGuid, semesterGuid, academicIntakeGuid],
    queryFn: () => getResitCourseUnits(programGuid, semesterGuid, academicIntakeGuid),
    enabled
  })
}

export function usePrintResitTheory() {
  return useMutation({
    mutationFn: (data: ResitParams) => postResitTheory(data)
  })
}
export function useDownloadResitTheoryPdf() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitTheoryPdf(data)
  })
}
export function useDownloadResitTheoryWord() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitTheoryWord(data)
  })
}
export function useDeleteResitTheory() {
  return useMutation({
    mutationFn: (data: ResitParams) => deleteResitTheory(data)
  })
}
export function useDownloadResitTheoryAnswerKey() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitTheoryAnswerKey(data)
  })
}

export function usePrintResitPractical() {
  return useMutation({
    mutationFn: (data: ResitParams) => postResitPractical(data)
  })
}
export function useDownloadResitPracticalPdf() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitPracticalPdf(data)
  })
}
export function useDownloadResitPracticalWord() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitPracticalWord(data)
  })
}
export function useDeleteResitPractical() {
  return useMutation({
    mutationFn: (data: ResitParams) => deleteResitPractical(data)
  })
}

export function usePrintResitBooklet() {
  return useMutation({
    mutationFn: (data: ResitParams) => postResitBooklet(data)
  })
}
export function useDownloadResitBookletPdf() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitBookletPdf(data)
  })
}
export function useDownloadResitBookletAttendance() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitBookletAttendancePdf(data)
  })
}
export function useDownloadResitBookletCover() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitBookletCoverPdf(data)
  })
}
export function useDownloadResitBookletConsolidated() {
  return useMutation({
    mutationFn: (data: ResitParams) => getResitBookletConsolidatedPdf(data)
  })
}
