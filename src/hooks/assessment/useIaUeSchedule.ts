import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIaUeSchedule, updateIaUeSchedule, UpdateUeScheduleRequest } from '@/lib/api/assessment/iaUeSchedule'

export function useIaUeSchedule(universityExamGuid: string | null) {
  return useQuery({
    queryKey: ['ia-ue-schedule', universityExamGuid],
    queryFn: () => getIaUeSchedule(universityExamGuid!),
    enabled: !!universityExamGuid,
  })
}

export function useUpdateIaUeSchedule(universityExamGuid: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateUeScheduleRequest) => updateIaUeSchedule(universityExamGuid, payload),
    onSuccess: () => {
      // Invalidate the schedule itself so it refetches
      queryClient.invalidateQueries({ queryKey: ['ia-ue-schedule', universityExamGuid] })
      // Invalidate the main structure grid so the updated dates show up there
      queryClient.invalidateQueries({ queryKey: ['ia-creation-structure'] })
    }
  })
}
