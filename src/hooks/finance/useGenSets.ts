import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createGenSet, deleteGenSet, GenSet, GenSetInput, getGenSetById, getGenSets, updateGenSet } from '@/lib/api/finance/genSet'

const GEN_SETS_KEY = ['gen-sets']

export function useGenSets() {
  return useQuery({
    queryKey: GEN_SETS_KEY,
    queryFn: () => getGenSets(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateGenSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenSetInput) => createGenSet(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GEN_SETS_KEY }),
  })
}

// Fetches a single general setting for the Edit modal. Only enabled while
// the modal is actually open with a guid, so it doesn't fire on every render
// of the gen-sets table.
export function useGenSet(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...GEN_SETS_KEY, guid],
    queryFn: () => getGenSetById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateGenSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: GenSetInput }) => updateGenSet(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: GEN_SETS_KEY })
      queryClient.invalidateQueries({ queryKey: [...GEN_SETS_KEY, guid] })
    },
  })
}

export function useDeleteGenSet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteGenSet(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GEN_SETS_KEY }),
  })
}

export type { GenSet, GenSetInput }
