import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getExamGrievance,
  getExamGrievances,
  getGrievanceStatuses,
  updateExamGrievanceStatus,
  ExamGrievancesParams,
  UpdateGrievanceStatusRequest,
} from '@/lib/api/student/examGrievances'

export const EXAM_GRIEVANCE_KEYS = {
  all: ['academic-service', 'students', 'exam-grievances'] as const,
  list: (params: ExamGrievancesParams) => [...EXAM_GRIEVANCE_KEYS.all, 'list', params] as const,
  detail: (grievanceGuid: string) => [...EXAM_GRIEVANCE_KEYS.all, 'detail', grievanceGuid] as const,
  statuses: ['academic-service', 'students', 'exam-grievances', 'statuses'] as const,
}

export function useGrievanceStatuses() {
  return useQuery({
    queryKey: EXAM_GRIEVANCE_KEYS.statuses,
    queryFn: getGrievanceStatuses,
    staleTime: Infinity,
  })
}

export function useExamGrievances(params: ExamGrievancesParams) {
  return useQuery({
    queryKey: EXAM_GRIEVANCE_KEYS.list(params),
    queryFn: () => getExamGrievances(params),
    enabled: !!params.intakeGuid,
    placeholderData: keepPreviousData,
  })
}

// staleTime 0: always reload on open — the student may have edited or
// deleted it, or another staff member may have responded.
export function useExamGrievance(grievanceGuid: string | null) {
  return useQuery({
    queryKey: EXAM_GRIEVANCE_KEYS.detail(grievanceGuid ?? ''),
    queryFn: () => getExamGrievance(grievanceGuid as string),
    enabled: !!grievanceGuid,
    staleTime: 0,
  })
}

// Settled, not just success: a 404 also means the list is stale.
export function useUpdateGrievanceStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ grievanceGuid, payload }: { grievanceGuid: string; payload: UpdateGrievanceStatusRequest }) =>
      updateExamGrievanceStatus(grievanceGuid, payload),
    onSettled: () => queryClient.invalidateQueries({ queryKey: EXAM_GRIEVANCE_KEYS.all }),
  })
}

export type {
  ExamGrievanceListItem,
  ExamGrievanceDetail,
  GrievanceStatusOption,
  GrievanceStatusFilter,
  GrievancePaymentFilter,
} from '@/lib/api/student/examGrievances'
