import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cooperate, CooperateInput, createCooperate, deleteCooperate, getCooperateById, getCooperates, updateCooperate } from '@/lib/api/finance/cooperate'

const COOPERATES_KEY = ['cooperates']

export function useCooperates() {
  return useQuery({
    queryKey: COOPERATES_KEY,
    queryFn: () => getCooperates(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateCooperate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CooperateInput) => createCooperate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COOPERATES_KEY }),
  })
}

// Fetches a single cooperate for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the cooperates table.
export function useCooperate(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...COOPERATES_KEY, guid],
    queryFn: () => getCooperateById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateCooperate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: CooperateInput }) => updateCooperate(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: COOPERATES_KEY })
      queryClient.invalidateQueries({ queryKey: [...COOPERATES_KEY, guid] })
    },
  })
}

export function useDeleteCooperate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteCooperate(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COOPERATES_KEY }),
  })
}

export type { Cooperate, CooperateInput }
