import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getFeeTransferContext,
  getFeeTransferHistory,
  executeFeeTransfer,
  FeeTransferRequest,
} from '@/lib/api/student/feeTransfer'

const FEE_TRANSFER_CONTEXT_KEY = ['fee-transfer-context']
const FEE_TRANSFER_HISTORY_KEY = ['fee-transfer-history']

export function useFeeTransferContext(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...FEE_TRANSFER_CONTEXT_KEY, studentGuid],
    queryFn: () => getFeeTransferContext(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useFeeTransferHistory(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...FEE_TRANSFER_HISTORY_KEY, studentGuid],
    queryFn: () => getFeeTransferHistory(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useExecuteFeeTransfer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, payload }: { studentGuid: string; payload: FeeTransferRequest }) => 
      executeFeeTransfer(studentGuid, payload),
    onSuccess: (_data, { studentGuid }) => {
      // Invalidate the history to show the newly added transfer record
      queryClient.invalidateQueries({ queryKey: [...FEE_TRANSFER_HISTORY_KEY, studentGuid] })
      // We might also want to invalidate context if the fee struct actually changes on that endpoint immediately
      queryClient.invalidateQueries({ queryKey: [...FEE_TRANSFER_CONTEXT_KEY, studentGuid] })
    },
  })
}
