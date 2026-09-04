import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  UpdateTestScheduleRequest,
  getIaTestSchedule,
  updateIaTestSchedule,
} from '@/lib/api/assessment/iaTestSchedule'

const IA_TEST_SCHEDULE_KEY = ['ia-test-schedule']

/** Fetches a single Class Test schedule for editing */
export function useIaTestSchedule(testGuid: string | null) {
  return useQuery({
    queryKey: [...IA_TEST_SCHEDULE_KEY, testGuid],
    queryFn: () => getIaTestSchedule(testGuid as string),
    enabled: !!testGuid,
  })
}

/** Updates the CBT schedule for a Class Test */
export function useUpdateIaTestSchedule(testGuid: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateTestScheduleRequest) => updateIaTestSchedule(testGuid, input),
    onSuccess: () => {
      // Invalidate both the specific test schedule and the overall IA structure grid
      queryClient.invalidateQueries({ queryKey: IA_TEST_SCHEDULE_KEY })
      queryClient.invalidateQueries({ queryKey: ['ia-creation-structure'] })
    },
  })
}
