import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProcGlAccount, deleteProcGlAccount, getProcGlAccountById, getProcGlAccounts, ProcGlAccount, ProcGlAccountInput, updateProcGlAccount } from '@/lib/api/finance/procGlAccount'

const PROC_GL_ACCOUNTS_KEY = ['proc-gl-accounts']

export function useProcGlAccounts() {
  return useQuery({
    queryKey: PROC_GL_ACCOUNTS_KEY,
    queryFn: () => getProcGlAccounts(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateProcGlAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProcGlAccountInput) => createProcGlAccount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROC_GL_ACCOUNTS_KEY }),
  })
}

// Fetches a single GL account for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the GL accounts table.
export function useProcGlAccount(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROC_GL_ACCOUNTS_KEY, guid],
    queryFn: () => getProcGlAccountById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateProcGlAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: ProcGlAccountInput }) => updateProcGlAccount(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: PROC_GL_ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PROC_GL_ACCOUNTS_KEY, guid] })
    },
  })
}

export function useDeleteProcGlAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteProcGlAccount(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROC_GL_ACCOUNTS_KEY }),
  })
}

export type { ProcGlAccount, ProcGlAccountInput }
