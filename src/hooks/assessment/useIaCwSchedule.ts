import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIaCwSchedule, updateIaCwSchedule, UpdateCwScheduleRequest } from '@/lib/api/assessment/iaCwSchedule'

export const IA_CW_SCHEDULE_KEY = 'iaCwSchedule'

export function useIaCwSchedule(courseworkGuid: string | null) {
  return useQuery({
    queryKey: [IA_CW_SCHEDULE_KEY, courseworkGuid],
    queryFn: () => getIaCwSchedule(courseworkGuid!),
    enabled: !!courseworkGuid,
  })
}

export function useUpdateIaCwSchedule(courseworkGuid: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateCwScheduleRequest) => updateIaCwSchedule(courseworkGuid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IA_CW_SCHEDULE_KEY, courseworkGuid] })
      // invalidate structure so the table picks up the updated dates
      queryClient.invalidateQueries({ queryKey: ['ia-creation-structure'] })
    },
  })
}
