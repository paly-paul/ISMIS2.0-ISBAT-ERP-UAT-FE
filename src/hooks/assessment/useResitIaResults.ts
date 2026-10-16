import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getResitIaResults, ResitIaResultsParams } from '@/lib/api/assessment/resitIaResults'

export const RESIT_IA_RESULTS_KEY = ['assessment-attendance-service', 'assessment', 'resit-ia-results'] as const

export function useResitIaResults(params: ResitIaResultsParams, enabled: boolean) {
  return useQuery({
    queryKey: [...RESIT_IA_RESULTS_KEY, params],
    queryFn: () => getResitIaResults(params),
    enabled: enabled && !!params.intakeGuid,
    placeholderData: keepPreviousData,
  })
}
