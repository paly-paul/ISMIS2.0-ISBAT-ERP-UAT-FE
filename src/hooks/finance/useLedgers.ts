import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLedger, deleteLedger, getLedgerById, getLedgers, Ledger, LedgerInput, updateLedger } from '@/lib/api/finance/ledger'

const LEDGERS_KEY = ['ledgers']

export function useLedgers() {
  return useQuery({
    queryKey: LEDGERS_KEY,
    queryFn: () => getLedgers(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateLedger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LedgerInput) => createLedger(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEDGERS_KEY }),
  })
}

// Fetches a single ledger for the Edit modal. Only enabled while the modal
// is actually open with a guid, so it doesn't fire on every render of the
// ledgers table.
export function useLedger(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...LEDGERS_KEY, guid],
    queryFn: () => getLedgerById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateLedger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: LedgerInput }) => updateLedger(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: LEDGERS_KEY })
      queryClient.invalidateQueries({ queryKey: [...LEDGERS_KEY, guid] })
    },
  })
}

export function useDeleteLedger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteLedger(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEDGERS_KEY }),
  })
}

export type { Ledger, LedgerInput }
