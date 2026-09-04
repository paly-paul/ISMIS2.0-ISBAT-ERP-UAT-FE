import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBatch, deleteBatch, getBatchById, getBatches, updateBatch, Batch, BatchCreateInput, BatchDetail, BatchUpdateInput } from '@/lib/api/academic/batch'

const BATCHES_KEY = ['batches']

export function useBatches(pageNumber: number, pageSize: number) {
  return useQuery({
    queryKey: [...BATCHES_KEY, pageNumber, pageSize],
    queryFn: () => getBatches(pageNumber, pageSize),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side search for Batch Management's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useBatches() above still stays the plain unfiltered, cached list — only
// enabled while the search box actually has a query in it, at which point
// the page falls back to that shared unfiltered list instead of issuing a
// redundant identical request. Not confirmed against a spec (see the note on
// getBatches), so the caller re-filters client-side too.
export function useBatchSearch(search: string, pageSize: number) {
  const q = search.trim()
  return useQuery({
    queryKey: [...BATCHES_KEY, 'search', q],
    queryFn: () => getBatches(1, pageSize, q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BatchCreateInput) => createBatch(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
  })
}

// Fetches a single batch for the Edit modal. Only enabled while the modal
// is actually open with a guid.
export function useBatch(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...BATCHES_KEY, 'byGuid', guid],
    queryFn: () => getBatchById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: BatchUpdateInput }) => updateBatch(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: BATCHES_KEY })
      queryClient.invalidateQueries({ queryKey: [...BATCHES_KEY, 'byGuid', guid] })
    },
  })
}

export function useDeleteBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteBatch(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BATCHES_KEY }),
  })
}

export type { Batch, BatchCreateInput, BatchDetail, BatchUpdateInput }
