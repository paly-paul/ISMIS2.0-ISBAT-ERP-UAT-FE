import { useQuery, useMutation } from '@tanstack/react-query'
import { getProgramDropdown } from '@/lib/api/academic/programMaster'
import { getSemestersForProgram } from '@/lib/api/academic/semester'
import { getProgramCourseUnits } from '@/lib/api/academic/programCourseUnits'
import {
  printUeQuestionPractical,
  downloadUeQuestionPracticalPdf,
  downloadUeQuestionPracticalWord,
  deleteUeQuestionPractical,
  UePracticalPrintParams
} from '@/lib/api/assessment/uePracticalPrint'

export function useUePracticalPrintPrograms() {
  return useQuery({
    queryKey: ['ue-practical-print-programs'],
    queryFn: () => getProgramDropdown(),
  })
}

export function useUePracticalPrintSemesters(programGuid: string | null) {
  return useQuery({
    queryKey: ['ue-practical-print-semesters', programGuid],
    queryFn: () => getSemestersForProgram(programGuid!),
    enabled: !!programGuid,
  })
}

// Fetches all program units. The component must filter by semesterGuid and unitTypeName === 'Practical'
export function useUePracticalProgramUnits(programGuid: string | null) {
  return useQuery({
    queryKey: ['ue-practical-program-course-units', programGuid],
    queryFn: () => getProgramCourseUnits(programGuid!),
    enabled: !!programGuid,
  })
}

export function usePrintUeQuestionPractical() {
  return useMutation({
    mutationFn: (data: UePracticalPrintParams) => printUeQuestionPractical(data)
  })
}

export function useDownloadUeQuestionPracticalPdf() {
  return useMutation({
    mutationFn: (data: UePracticalPrintParams) => downloadUeQuestionPracticalPdf(data)
  })
}

export function useDownloadUeQuestionPracticalWord() {
  return useMutation({
    mutationFn: (data: UePracticalPrintParams) => downloadUeQuestionPracticalWord(data)
  })
}

export function useDeleteUeQuestionPractical() {
  return useMutation({
    mutationFn: (data: UePracticalPrintParams) => deleteUeQuestionPractical(data)
  })
}
