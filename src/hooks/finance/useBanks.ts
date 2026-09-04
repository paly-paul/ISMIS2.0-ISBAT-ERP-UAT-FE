import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bank, BankInput, createBank, deleteBank, getBankById, getBanks, updateBank } from '@/lib/api/finance/bank'

const BANKS_KEY = ['banks']

export function useBanks() {
  return useQuery({
    queryKey: BANKS_KEY,
    queryFn: () => getBanks(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateBank() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BankInput) => createBank(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANKS_KEY }),
  })
}

// Fetches a single bank for the Edit modal. Only enabled while the modal is
// actually open with a guid, so it doesn't fire on every render of the
// banks table.
export function useBank(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...BANKS_KEY, guid],
    queryFn: () => getBankById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateBank() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: BankInput }) => updateBank(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: BANKS_KEY })
      queryClient.invalidateQueries({ queryKey: [...BANKS_KEY, guid] })
    },
  })
}

export function useDeleteBank() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteBank(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANKS_KEY }),
  })
}

export type { Bank, BankInput }
