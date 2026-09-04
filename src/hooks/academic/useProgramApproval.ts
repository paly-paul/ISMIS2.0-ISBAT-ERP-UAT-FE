import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getProgramApprovals, updateProgramApproval, ProgramMasterListDto, PaginatedProgramApprovals } from '@/lib/api/academic/programApproval'
import { PROGRAM_MASTERS_KEY } from './useProgramMaster'

const PROGRAM_APPROVALS_KEY = ['programApprovals']

export function useProgramApprovals(pageNumber = 1, pageSize = 20, search = '') {
  return useQuery({
    queryKey: [...PROGRAM_APPROVALS_KEY, pageNumber, pageSize, search],
    queryFn: () => getProgramApprovals(pageNumber, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

export function useUpdateProgramApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ programGuid, isApproved }: { programGuid: string; isApproved: boolean }) => updateProgramApproval(programGuid, isApproved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROGRAM_APPROVALS_KEY })
      // Approving/rejecting here is exactly what moves a programme in or out
      // of the Programme Master table's own list (see the isApproved gate
      // noted in post-program-master.md) — that query has staleTime:
      // Infinity, so without this it stayed on its old data until the next
      // hard reload, even though the approval itself succeeded.
      queryClient.invalidateQueries({ queryKey: PROGRAM_MASTERS_KEY })
    },
  })
}

export type { ProgramMasterListDto, PaginatedProgramApprovals }
