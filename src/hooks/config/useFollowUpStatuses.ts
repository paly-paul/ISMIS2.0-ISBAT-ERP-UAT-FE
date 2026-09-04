import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFollowUpStatus, deleteFollowUpStatus, FollowUpStatus, FollowUpStatusInput, getFollowUpStatusById, getFollowUpStatuses, updateFollowUpStatus } from '@/lib/api/academic/followUpStatus'

const FOLLOWUP_STATUSES_KEY = ['followup-statuses']

export function useFollowUpStatuses() {
  return useQuery({
    queryKey: FOLLOWUP_STATUSES_KEY,
    queryFn: () => getFollowUpStatuses(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateFollowUpStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FollowUpStatusInput) => createFollowUpStatus(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOWUP_STATUSES_KEY }),
  })
}

// Fetches a single followup status for the Edit modal. Only enabled while
// the modal is actually open with a guid, so it doesn't fire on every render
// of the followup status table.
export function useFollowUpStatus(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...FOLLOWUP_STATUSES_KEY, guid],
    queryFn: () => getFollowUpStatusById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateFollowUpStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: FollowUpStatusInput }) => updateFollowUpStatus(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_STATUSES_KEY })
      queryClient.invalidateQueries({ queryKey: [...FOLLOWUP_STATUSES_KEY, guid] })
    },
  })
}

export function useDeleteFollowUpStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteFollowUpStatus(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOLLOWUP_STATUSES_KEY }),
  })
}

export type { FollowUpStatus, FollowUpStatusInput }
