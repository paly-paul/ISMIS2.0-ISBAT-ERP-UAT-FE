import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AcademicCalendarBatchEntryDto, bulkUpdateCalendarBatch, getCalendarBatch } from '@/lib/api/academic/intake'

const CALENDAR_BATCH_KEY = ['intakes', 'calendar-batch']

export function useCalendarBatch() {
  return useQuery({
    queryKey: CALENDAR_BATCH_KEY,
    queryFn: getCalendarBatch,
    // Same reasoning as useIntakes: this is a small, rarely-changing set —
    // don't refetch on tab focus, only once a save actually changes it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useBulkUpdateCalendarBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entries: AcademicCalendarBatchEntryDto[]) => bulkUpdateCalendarBatch(entries),
    // The endpoint hands back the entire refreshed batch in one shot, so
    // there's no need to invalidate-and-refetch — just seed the cache with
    // the response directly (see patch-calendar-batch-bulk.md: "Replace your
    // client-side state with this response wholesale rather than merging").
    onSuccess: data => {
      queryClient.setQueryData(CALENDAR_BATCH_KEY, data)
    },
  })
}

export type { AcademicCalendarBatchEntryDto } from '@/lib/api/academic/intake'
