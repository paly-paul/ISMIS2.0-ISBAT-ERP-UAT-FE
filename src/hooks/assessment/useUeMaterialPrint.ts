import { useQuery, useMutation } from '@tanstack/react-query'
import { getProgramDropdown } from '@/lib/api/academic/programMaster'
import { getSemestersForProgram } from '@/lib/api/academic/semester'
import { getProgramCourseUnits } from '@/lib/api/academic/programCourseUnits'
import {
  getUeQuestionPrintCourseUnits,
  printUeBooklet,
  downloadUeBookletPdf,
  downloadUeBookletAttendance,
  downloadUeBookletCover,
  printUeQuestionTheory,
  downloadUeQuestionTheoryPdf,
  downloadUeQuestionTheoryWord,
  deleteUeQuestionTheory,
  downloadUeQuestionTheoryAnswerKey,
  downloadUeConsolidatedMarkSheet,
  UePrintParams,
} from '@/lib/api/assessment/ueMaterialPrint'

// Dropdown Queries
export function useUeMaterialPrintPrograms() {
  return useQuery({
    queryKey: ['ue-material-print-programs'],
    queryFn: () => getProgramDropdown(),
  })
}

export function useUeMaterialPrintSemesters(programGuid: string | null) {
  return useQuery({
    queryKey: ['ue-material-print-semesters', programGuid],
    queryFn: () => getSemestersForProgram(programGuid!),
    enabled: !!programGuid,
  })
}

export function useUeQuestionPrintCourseUnits(programGuid: string, semesterGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ue-question-print-course-units', programGuid, semesterGuid],
    queryFn: () => getUeQuestionPrintCourseUnits(programGuid, semesterGuid),
    enabled,
  })
}

// The current-intake course-unit endpoint owns the dropdown population. Its
// response does not reliably include unit type, so this lookup is used only
// to decide how the selected unit should be printed.
export function useUeMaterialPrintProgramUnits(programGuid: string | null) {
  return useQuery({
    queryKey: ['ue-material-print-program-course-units', programGuid],
    queryFn: () => getProgramCourseUnits(programGuid!),
    enabled: !!programGuid,
  })
}

// Theory Mutations
export function usePrintUeQuestionTheory() {
  return useMutation({
    mutationFn: (data: UePrintParams) => printUeQuestionTheory(data)
  })
}
export function useDownloadUeQuestionTheoryPdf() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeQuestionTheoryPdf(data)
  })
}
export function useDownloadUeQuestionTheoryWord() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeQuestionTheoryWord(data)
  })
}
export function useDeleteUeQuestionTheory() {
  return useMutation({
    mutationFn: (data: UePrintParams) => deleteUeQuestionTheory(data)
  })
}
export function useDownloadUeQuestionTheoryAnswerKey() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeQuestionTheoryAnswerKey(data)
  })
}

// Booklet Mutations
export function usePrintUeBooklet() {
  return useMutation({
    mutationFn: (data: UePrintParams) => printUeBooklet(data)
  })
}
export function useDownloadUeBookletPdf() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeBookletPdf(data)
  })
}
export function useDownloadUeBookletAttendance() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeBookletAttendance(data)
  })
}
export function useDownloadUeBookletCover() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeBookletCover(data)
  })
}

// Mark Sheet Mutation
export function useDownloadUeConsolidatedMarkSheet() {
  return useMutation({
    mutationFn: (data: UePrintParams) => downloadUeConsolidatedMarkSheet(data)
  })
}
