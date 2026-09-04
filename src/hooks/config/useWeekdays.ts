import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createWeekday, deleteWeekday, getWeekdayById, getWeekdays, updateWeekday, Weekday, WeekdayInput } from '@/lib/api/academic/weekday'

const WEEKDAYS_KEY = ['weekdays']

export function useWeekdays() {
  return useQuery({
    queryKey: WEEKDAYS_KEY,
    queryFn: () => getWeekdays(),
    // Keep the cached list until a mutation explicitly refreshes it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateWeekday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: WeekdayInput) => createWeekday(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEEKDAYS_KEY }),
  })
}

// Fetches a single weekday for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the weekday table.
export function useWeekday(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...WEEKDAYS_KEY, guid],
    queryFn: () => getWeekdayById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateWeekday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: WeekdayInput }) => updateWeekday(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: WEEKDAYS_KEY })
      queryClient.invalidateQueries({ queryKey: [...WEEKDAYS_KEY, guid] })
    },
  })
}

export function useDeleteWeekday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteWeekday(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEEKDAYS_KEY }),
  })
}

export type { Weekday, WeekdayInput }
