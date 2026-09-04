import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProcBank, deleteProcBank, getProcBankById, getProcBanks, ProcBank, ProcBankInput, updateProcBank } from '@/lib/api/finance/procBank'

const PROC_BANKS_KEY = ['proc-banks']

export function useProcBanks() {
  return useQuery({
    queryKey: PROC_BANKS_KEY,
    queryFn: () => getProcBanks(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateProcBank() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProcBankInput) => createProcBank(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROC_BANKS_KEY }),
  })
}

// Fetches a single bank for the Edit modal. Only enabled while the modal is
// actually open with a guid, so it doesn't fire on every render of the
// banks table.
export function useProcBank(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROC_BANKS_KEY, guid],
    queryFn: () => getProcBankById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateProcBank() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: ProcBankInput }) => updateProcBank(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: PROC_BANKS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PROC_BANKS_KEY, guid] })
    },
  })
}

export function useDeleteProcBank() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteProcBank(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROC_BANKS_KEY }),
  })
}

export type { ProcBank, ProcBankInput }
