import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyLearningModeChange,
  approveLearningModeChange,
  getLearningModeOptions,
  getLearningModeReport,
  getPendingLearningModeApprovals,
  getStudentLearningModeDetail,
  updateStudentLearningMode,
  ApplyLearningModeChangeInput,
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

// staleTime 0 — the change-request state on this record can be moved by
// someone else (apply on one page, approve on another), so always refetch
// on mount rather than trusting a cached "pending"/"not pending".
export function useStudentLearningModeDetail(studentGuid: string | null) {
  return useQuery({
    queryKey: [...LEARNING_MODE_KEY, 'detail', studentGuid],
    queryFn: () => getStudentLearningModeDetail(studentGuid as string),
    enabled: !!studentGuid,
    staleTime: 0,
  })
}

// Every write below can move a student in/out of the report (and the
// approval queue, which is the report filtered to status 1) — cheap enough
// to invalidate the whole report broadly rather than track exactly which
// campus/filter combination the student sits in.
function invalidateStudent(queryClient: ReturnType<typeof useQueryClient>, studentGuid: string) {
  queryClient.invalidateQueries({ queryKey: [...LEARNING_MODE_KEY, 'detail', studentGuid] })
  queryClient.invalidateQueries({ queryKey: [...LEARNING_MODE_KEY, 'report'] })
  queryClient.invalidateQueries({ queryKey: [...LEARNING_MODE_KEY, 'pending'] })
}

// Direct update (PUT) — still used by Student Master's row-menu modal.
export function useUpdateStudentLearningMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, learningMode }: { studentGuid: string; learningMode: number }) =>
      updateStudentLearningMode(studentGuid, learningMode),
    onSuccess: (_result, { studentGuid }) => invalidateStudent(queryClient, studentGuid),
  })
}

export function useApplyLearningModeChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, input }: { studentGuid: string; input: ApplyLearningModeChangeInput }) =>
      applyLearningModeChange(studentGuid, input),
    onSuccess: (result, { studentGuid }) => {
      // Seed the detail cache with the response straight away so the page
      // flips to "pending" without waiting on the refetch.
      queryClient.setQueryData([...LEARNING_MODE_KEY, 'detail', studentGuid], result)
      invalidateStudent(queryClient, studentGuid)
    },
  })
}

export function useApproveLearningModeChange() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (studentGuid: string) => approveLearningModeChange(studentGuid),
    onSuccess: (result, studentGuid) => {
      queryClient.setQueryData([...LEARNING_MODE_KEY, 'detail', studentGuid], result)
      invalidateStudent(queryClient, studentGuid)
    },
  })
}

// Approval list — GET /students/learning-mode/pending-approvals, server-
// paged. staleTime 0: always refetch on mount, since a request can be
// raised or approved from another page or by another user.
export function usePendingLearningModeApprovals(search: string, pageNumber: number, pageSize: number) {
  return useQuery({
    queryKey: [...LEARNING_MODE_KEY, 'pending', search, pageNumber, pageSize],
    queryFn: () => getPendingLearningModeApprovals(search, pageNumber, pageSize),
    staleTime: 0,
    placeholderData: prev => prev,
  })
}

export function useLearningModeReport(filters: LearningModeReportFilters | null, pageNumber: number, pageSize: number) {
  return useQuery({
    queryKey: [...LEARNING_MODE_KEY, 'report', filters, pageNumber, pageSize],
    queryFn: () => getLearningModeReport(filters as LearningModeReportFilters, pageNumber, pageSize),
    enabled: !!filters?.campusGuid,
    staleTime: 60 * 1000,
  })
}

export type { PendingLearningModeApprovalRow, LearningModeOption, StudentLearningModeDetail, LearningModeReportRow, LearningModeReportFilters, PagedResult, ApplyLearningModeChangeInput } from '@/lib/api/student/learningMode'
