import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getProgramTransferBatches,
  getProgramTransferDetail,
  getProgramTransferFeeStructures,
  getProgramTransferHistory,
  postProgramTransfer,
  ProgramTransferInput,
} from '@/lib/api/student/programTransfer'

// staleTime: Infinity on all four below — without it, react-query's default
// (staleTime 0) refetches every one of these on every remount (leaving this
// page and coming back) and every window/tab focus change, which is
// wasteful for data that only actually changes when a transfer is
// submitted. usePostProgramTransfer's own onSuccess already explicitly
// invalidates program-transfer-detail/history on a successful transfer —
// the same "trust the cache, only refetch when a mutation invalidates it"
// convention used for master data throughout this app (useProgramMasters,
// useIntakes, useCampusDropdown, etc.) — so there's no correctness cost to
// stopping the automatic refetch-on-mount/focus churn.
export function useProgramTransferDetail(studentGuid: string | null) {
  return useQuery({
    queryKey: ['program-transfer-detail', studentGuid],
    queryFn: () => getProgramTransferDetail(studentGuid as string),
    enabled: !!studentGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useProgramTransferBatches(programGuid: string | null, semesterGuid: string | null) {
  return useQuery({
    queryKey: ['program-transfer-batches', programGuid, semesterGuid],
    queryFn: () => getProgramTransferBatches(programGuid as string, semesterGuid as string),
    enabled: !!programGuid && !!semesterGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useProgramTransferFeeStructures(programGuid: string | null) {
  return useQuery({
    queryKey: ['program-transfer-fee-structures', programGuid],
    queryFn: () => getProgramTransferFeeStructures(programGuid as string),
    enabled: !!programGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useProgramTransferHistory(studentGuid: string | null) {
  return useQuery({
    queryKey: ['program-transfer-history', studentGuid],
    queryFn: () => getProgramTransferHistory(studentGuid as string),
    enabled: !!studentGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function usePostProgramTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, input }: { studentGuid: string; input: ProgramTransferInput }) => postProgramTransfer(studentGuid, input),
    onSuccess: (_data, { studentGuid }) => {
      queryClient.invalidateQueries({ queryKey: ['program-transfer-history', studentGuid] })
      queryClient.invalidateQueries({ queryKey: ['program-transfer-detail', studentGuid] })
    },
  })
}

export type {
  ProgramTransferDetail,
  ProgramTransferBatchOption,
  ProgramFeeStructureOption,
  ProgramTransferHistoryRow,
  ProgramTransferInput,
  ProgramTransferResult,
} from '@/lib/api/student/programTransfer'
