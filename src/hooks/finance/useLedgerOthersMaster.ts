import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createLedgerOther,
  deleteLedgerOther,
  getLedgerOtherByGuid,
  getLedgerOthersDropdown,
  getLedgerOthersList,
  updateLedgerOther,
  LedgerOther,
  LedgerOtherInput,
} from '@/lib/api/finance/ledgerOthersMaster'

const LEDGER_OTHERS_KEY = ['ledger-others-master']

export function useLedgerOthersList() {
  return useQuery({
    queryKey: LEDGER_OTHERS_KEY,
    queryFn: () => getLedgerOthersList(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key
    // below, same convention as useLedgers/useGenSets.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Fetches a single other-ledger for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render
// of the table.
export function useLedgerOther(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...LEDGER_OTHERS_KEY, guid],
    queryFn: () => getLedgerOtherByGuid(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateLedgerOther() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LedgerOtherInput) => createLedgerOther(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEDGER_OTHERS_KEY }),
  })
}

export function useUpdateLedgerOther() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: LedgerOtherInput }) => updateLedgerOther(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: LEDGER_OTHERS_KEY })
      queryClient.invalidateQueries({ queryKey: [...LEDGER_OTHERS_KEY, guid] })
    },
  })
}

export function useDeleteLedgerOther() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteLedgerOther(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEDGER_OTHERS_KEY }),
  })
}

// Not wired into this master page (which lists everything and filters
// client-side) — kept for any future picker that wants server-side search.
// See getLedgerOthersDropdown's own comment.
export function useLedgerOthersDropdown(search: string, enabled: boolean) {
  return useQuery({
    queryKey: [...LEDGER_OTHERS_KEY, 'dropdown', search],
    queryFn: () => getLedgerOthersDropdown(search),
    enabled,
  })
}

export type { LedgerOther, LedgerOtherInput }
