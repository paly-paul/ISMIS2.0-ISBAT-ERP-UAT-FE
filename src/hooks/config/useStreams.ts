import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stream, StreamInput, createStream, deleteStream, getStreamById, getStreams, updateStream } from '@/lib/api/academic/stream'

const STREAMS_KEY = ['streams']

// Fetch a single page large enough to cover the whole list — nothing in
// this codebase currently paginates the master lists client-side, so the
// hook needs the full set in one request rather than the API's default
// page=1/pageSize=10 (which was silently hiding any row past the 10th).
const STREAMS_PAGE_SIZE = 1000

export function useStreams() {
  return useQuery({
    queryKey: STREAMS_KEY,
    queryFn: () => getStreams(1, STREAMS_PAGE_SIZE),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StreamInput) => createStream(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STREAMS_KEY }),
  })
}

// Fetches a single specialization for the Edit modal. Only enabled while the
// modal is actually open with a guid, so it doesn't fire on every render of
// the specialization table.
export function useStream(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...STREAMS_KEY, guid],
    queryFn: () => getStreamById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: StreamInput }) => updateStream(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: STREAMS_KEY })
      queryClient.invalidateQueries({ queryKey: [...STREAMS_KEY, guid] })
    },
  })
}

export function useDeleteStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteStream(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: STREAMS_KEY }),
  })
}

export type { Stream, StreamInput }
