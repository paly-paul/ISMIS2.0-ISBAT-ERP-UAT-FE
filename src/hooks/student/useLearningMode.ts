import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getLearningModeOptions,
  getLearningModeReport,
  getStudentLearningModeDetail,
  updateStudentLearningMode,
  LearningModeReportFilters,
} from '@/lib/api/student/learningMode'

const LEARNING_MODE_KEY = ['learning-mode']

// Enum-backed, not a DB table (see the .md's own note) — cached like every
// other static master list in this app.
export function useLearningModeOptions() {
  return useQuery({
    queryKey: [...LEARNING_MODE_KEY, 'options'],
    queryFn: getLearningModeOptions,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useStudentLearningModeDetail(studentGuid: string | null) {
  return useQuery({
    queryKey: [...LEARNING_MODE_KEY, 'detail', studentGuid],
    queryFn: () => getStudentLearningModeDetail(studentGuid as string),
    enabled: !!studentGuid,
  })
}

export function useUpdateStudentLearningMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, learningMode }: { studentGuid: string; learningMode: number }) =>
      updateStudentLearningMode(studentGuid, learningMode),
    onSuccess: (_result, { studentGuid }) => {
      queryClient.invalidateQueries({ queryKey: [...LEARNING_MODE_KEY, 'detail', studentGuid] })
      // The report roster may now show this student under a different mode
      // — cheap enough to invalidate broadly rather than track exactly
      // which campus/filter combination it currently sits in.
      queryClient.invalidateQueries({ queryKey: [...LEARNING_MODE_KEY, 'report'] })
    },
  })
}

export function useLearningModeReport(filters: LearningModeReportFilters | null, pageNumber: number, pageSize: number) {
  return useQuery({
    queryKey: [...LEARNING_MODE_KEY, 'report', filters, pageNumber, pageSize],
    queryFn: () => getLearningModeReport(filters as LearningModeReportFilters, pageNumber, pageSize),
    enabled: !!filters?.campusGuid,
  })
}

export type { LearningModeOption, StudentLearningModeDetail, LearningModeReportRow, LearningModeReportFilters, PagedResult } from '@/lib/api/student/learningMode'
