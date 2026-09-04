import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createInterestLevel, deleteInterestLevel, getInterestLevelById, getInterestLevels, InterestLevel, InterestLevelInput, updateInterestLevel } from '@/lib/api/admission/interestLevel'

const INTEREST_LEVELS_KEY = ['interest-levels']

export function useInterestLevels() {
  return useQuery({
    queryKey: INTEREST_LEVELS_KEY,
    queryFn: () => getInterestLevels(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateInterestLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InterestLevelInput) => createInterestLevel(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INTEREST_LEVELS_KEY }),
  })
}

// Fetches a single interest level for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the interest level table.
export function useInterestLevel(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...INTEREST_LEVELS_KEY, guid],
    queryFn: () => getInterestLevelById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateInterestLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: InterestLevelInput }) => updateInterestLevel(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: INTEREST_LEVELS_KEY })
      queryClient.invalidateQueries({ queryKey: [...INTEREST_LEVELS_KEY, guid] })
    },
  })
}

export function useDeleteInterestLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteInterestLevel(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INTEREST_LEVELS_KEY }),
  })
}

export type { InterestLevel, InterestLevelInput }
