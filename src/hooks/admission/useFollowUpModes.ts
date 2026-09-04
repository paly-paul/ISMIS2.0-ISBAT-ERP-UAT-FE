import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFollowUpMode, deleteFollowUpMode, FollowUpMode, FollowUpModeInput, getFollowUpModeById, getFollowUpModes, updateFollowUpMode } from '@/lib/api/admission/followUpMode'

const FOLLOWUP_MODES_KEY = ['followup-modes']

export function useFollowUpModes() {
  return useQuery({
    queryKey: FOLLOWUP_MODES_KEY,
    queryFn: () => getFollowUpModes(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateFollowUpMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FollowUpModeInput) => createFollowUpMode(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOWUP_MODES_KEY }),
  })
}

// Fetches a single followup mode for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the followup mode table.
export function useFollowUpMode(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...FOLLOWUP_MODES_KEY, guid],
    queryFn: () => getFollowUpModeById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateFollowUpMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: FollowUpModeInput }) => updateFollowUpMode(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_MODES_KEY })
      queryClient.invalidateQueries({ queryKey: [...FOLLOWUP_MODES_KEY, guid] })
    },
  })
}

export function useDeleteFollowUpMode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteFollowUpMode(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOWUP_MODES_KEY }),
  })
}

export type { FollowUpMode, FollowUpModeInput }
