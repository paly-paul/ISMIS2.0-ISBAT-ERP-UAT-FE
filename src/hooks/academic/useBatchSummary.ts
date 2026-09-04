import { useQuery } from '@tanstack/react-query'
import { getBatchSummary, BatchSummaryItem } from '@/lib/api/academic/batchSummary'

const BATCH_SUMMARY_KEY = ['batchSummary']

// Refetches whenever the campus filter changes — the endpoint itself does
// the filtering (?campusGuid=...), so there's no client-side re-filtering
// needed on top of this, unlike the search-based approach it replaces.
export function useBatchSummary(campusGuid: string | null) {
  return useQuery({
    queryKey: [...BATCH_SUMMARY_KEY, campusGuid ?? ''],
    queryFn: () => getBatchSummary(campusGuid),
  })
}

export type { BatchSummaryItem }
