import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BankBranch, BankBranchInput, createBankBranch, deleteBankBranch, getBankBranchById, getBankBranches, updateBankBranch } from '@/lib/api/finance/bankBranch'

const BANK_BRANCHES_KEY = ['bank-branches']

export function useBankBranches() {
  return useQuery({
    queryKey: BANK_BRANCHES_KEY,
    queryFn: () => getBankBranches(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateBankBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BankBranchInput) => createBankBranch(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_BRANCHES_KEY }),
  })
}

// Fetches a single bank branch for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the bank branches table.
export function useBankBranch(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...BANK_BRANCHES_KEY, guid],
    queryFn: () => getBankBranchById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateBankBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: BankBranchInput }) => updateBankBranch(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: BANK_BRANCHES_KEY })
      queryClient.invalidateQueries({ queryKey: [...BANK_BRANCHES_KEY, guid] })
    },
  })
}

export function useDeleteBankBranch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteBankBranch(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BANK_BRANCHES_KEY }),
  })
}

export type { BankBranch, BankBranchInput }
