import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getBatchSummary, BatchSummaryItem, BatchSummaryListResult } from '@/lib/api/academic/batchSummary'

const BATCH_SUMMARY_KEY = ['batchSummary']

// Fetches every batch for the campus + intake in one call (pageSize isn't
// bounded server-side, get-batch-summary.md) and the page slices it. That
// keeps paging instant and lets the stat tiles total the whole set, not just
// the visible page.
const FETCH_ALL_PAGE_SIZE = 10000

// intakeGuid null = the current admission intake (the endpoint's default).
export function useBatchSummary(campusGuid: string | null, intakeGuid: string | null) {
  return useQuery<BatchSummaryListResult>({
    queryKey: [...BATCH_SUMMARY_KEY, campusGuid ?? '', intakeGuid ?? ''],
    queryFn: () => getBatchSummary(campusGuid, 1, FETCH_ALL_PAGE_SIZE, intakeGuid),
    // Keep the previous filter's table up while the next one loads.
    placeholderData: keepPreviousData,
  })
}

export type { BatchSummaryItem }
