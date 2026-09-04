import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBatchTime, deleteBatchTime, getBatchTimeById, getBatchTimes, updateBatchTime, BatchTime, BatchTimeInput } from '@/lib/api/academic/batchTime'

const BATCH_TIMES_KEY = ['batchTimes']

export function useBatchTimes() {
  return useQuery({
    queryKey: BATCH_TIMES_KEY,
    queryFn: () => getBatchTimes(),
    // Keep the cached list until a mutation explicitly refreshes it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateBatchTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BatchTimeInput) => createBatchTime(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BATCH_TIMES_KEY }),
  })
}

// Fetches a single batch time for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the batch time table.
export function useBatchTime(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...BATCH_TIMES_KEY, guid],
    queryFn: () => getBatchTimeById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateBatchTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: BatchTimeInput }) => updateBatchTime(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: BATCH_TIMES_KEY })
      queryClient.invalidateQueries({ queryKey: [...BATCH_TIMES_KEY, guid] })
    },
  })
}

export function useDeleteBatchTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteBatchTime(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BATCH_TIMES_KEY }),
  })
}

export type { BatchTime, BatchTimeInput }
