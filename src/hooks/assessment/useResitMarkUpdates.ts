import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getResitMarkUpdates, pushResitMarkUpdate, ResitMarkUpdateQueryParams } from '@/lib/api/assessment/resitMarkUpdates'

export const RESIT_MARK_UPDATES_KEYS = {
  all: ['assessment-attendance-service', 'assessment', 'resit-mark-updates'] as const,
  lists: () => [...RESIT_MARK_UPDATES_KEYS.all, 'list'] as const,
  list: (params: ResitMarkUpdateQueryParams) => [...RESIT_MARK_UPDATES_KEYS.lists(), params] as const,
}

export function useResitMarkUpdates(params: ResitMarkUpdateQueryParams, enabled: boolean = true) {
  return useQuery({
    queryKey: RESIT_MARK_UPDATES_KEYS.list(params),
    queryFn: () => getResitMarkUpdates(params),
    enabled: enabled && !!params.intakeGuid && !!params.resitConfigGuid
  })
}

export function usePushResitMarkUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: pushResitMarkUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESIT_MARK_UPDATES_KEYS.lists() })
    }
  })
}
