import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getPassoutCandidates,
  getPassoutCandidateDetail,
  confirmPassout,
  ConfirmPassoutRequest,
  PassoutCandidateFilters,
} from '@/lib/api/student/passoutConfirmation'

const CANDIDATES_LIST_KEY = ['passout-candidates']
const CANDIDATE_DETAIL_KEY = ['passout-candidate-detail']

export function usePassoutCandidates(pageNumber: number, pageSize: number, filters?: PassoutCandidateFilters) {
  return useQuery({
    queryKey: [...CANDIDATES_LIST_KEY, pageNumber, pageSize, filters?.searchTerm ?? '', filters?.email ?? '', filters?.phone ?? '', filters?.programGroup ?? ''],
    queryFn: () => getPassoutCandidates(pageNumber, pageSize, filters),
    staleTime: 60 * 1000,
    gcTime: Infinity,
  })
}

// Only enabled once a candidate is picked from the list, same convention as
// useRejoinCandidate.
export function usePassoutCandidateDetail(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...CANDIDATE_DETAIL_KEY, studentGuid],
    queryFn: () => getPassoutCandidateDetail(studentGuid as string),
    enabled: enabled && !!studentGuid,
    staleTime: 60 * 1000,
    gcTime: Infinity,
  })
}

export function useConfirmPassout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, payload }: { studentGuid: string; payload: ConfirmPassoutRequest }) => confirmPassout(studentGuid, payload),
    // The confirmed student's active history moves off REGSTATUS = 1
    // (Registered) — drops off this candidate list, so refetch it rather
    // than trying to patch the cached page.
    onSuccess: (_data, { studentGuid }) => {
      queryClient.invalidateQueries({ queryKey: CANDIDATES_LIST_KEY })
      queryClient.removeQueries({ queryKey: [...CANDIDATE_DETAIL_KEY, studentGuid] })
    },
  })
}

export type { PassoutConfirmationCandidateDto, PassoutConfirmationCandidateDetailDto, PassoutCandidateFilters, ConfirmPassoutRequest, ConfirmPassoutResultDto, PagedResult } from '@/lib/api/student/passoutConfirmation'
