import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBatchTransferDetail,
  getEligibleBatches,
  getBatchTransferHistory,
  postBatchTransfer,
  BatchTransferRequest,
} from '@/lib/api/student/batchTransfer'

const BATCH_TRANSFER_KEY = ['batch-transfer']

// mockSeed is only read in NEXT_PUBLIC_AUTH_MOCK mode (see
// getBatchTransferDetail) — harmless to pass unconditionally, same
// convention useResumeCandidate's own mockSeed param used.
export function useBatchTransferDetail(studentGuid: string | null, mockSeed: { studentRegNo: string; studentName: string }, enabled: boolean) {
  return useQuery({
    queryKey: [...BATCH_TRANSFER_KEY, 'detail', studentGuid],
    queryFn: () => getBatchTransferDetail(studentGuid as string, mockSeed),
    enabled: enabled && !!studentGuid,
  })
}

export function useEligibleBatches(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...BATCH_TRANSFER_KEY, 'eligible-batches', studentGuid],
    queryFn: () => getEligibleBatches(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useBatchTransferHistory(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...BATCH_TRANSFER_KEY, 'history', studentGuid],
    queryFn: () => getBatchTransferHistory(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useExecuteBatchTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, input }: { studentGuid: string; input: BatchTransferRequest }) => postBatchTransfer(studentGuid, input),
    // A committed transfer changes the student's current batch (detail),
    // empties out the batch they just left from eligible-batches again
    // (their old batch becomes eligible, the new one doesn't), and adds a
    // new row to history — all three need to refetch.
    onSuccess: (_result, { studentGuid }) => {
      queryClient.invalidateQueries({ queryKey: [...BATCH_TRANSFER_KEY, 'detail', studentGuid] })
      queryClient.invalidateQueries({ queryKey: [...BATCH_TRANSFER_KEY, 'eligible-batches', studentGuid] })
      queryClient.invalidateQueries({ queryKey: [...BATCH_TRANSFER_KEY, 'history', studentGuid] })
    },
  })
}

export type { StudentBatchDetailDto, EligibleBatchDto, BatchTransferRequest, BatchTransferResultDto, BatchTransferHistoryItemDto } from '@/lib/api/student/batchTransfer'
