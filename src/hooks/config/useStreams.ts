import { useMutation, useQuery, useQueryClient, useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { Stream, StreamInput, createStream, deleteStream, getStreamById, getStreams, getStreamsPaged, updateStream } from '@/lib/api/academic/stream'

const STREAMS_KEY = ['streams']

// Fetch a single page large enough to cover the whole list — nothing in
// this codebase currently paginates the master lists client-side, so the
// hook needs the full set in one request rather than the API's default
// page=1/pageSize=10 (which was silently hiding any row past the 10th).
const STREAMS_PAGE_SIZE = 1000

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually needed (e.g. a rare client-side fallback lookup, only
// consulted when a row's own pre-resolved streamName comes back null) needs
// to pass enabled explicitly.
export function useStreams(enabled = true) {
  return useQuery({
    queryKey: STREAMS_KEY,
    queryFn: () => getStreams(1, STREAMS_PAGE_SIZE),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Search-as-you-type/scroll picker (2026-09-10), backing
// StreamMultiSearchPicker — same useInfiniteQuery + fetch-next-on-scroll
// pattern useSearchProgramMastersInfinite/useSearchIntakesInfinite/
// useSearchFacultiesInfinite use. Replaces ProgrammeModal's own
// Specialization(s) MultiSelect, which used to read off useStreams(isOpen)'s
// capped 1000-row snapshot. Confirmed live that GET
// /api/v1/academic/specializations genuinely supports page/pageSize/search
// together — see getStreamsPaged.
export function useSearchStreamsInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...STREAMS_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getStreamsPaged(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Batched-by-guid lookup — same convention as useCourseUnitsByGuids/
// useIntakesByGuids/useFacultiesByGuids, used to resolve display labels
// ("code — name") for a bounded set of already-selected streamGuids (e.g. a
// programme's picked Specialization(s)) without holding the whole stream
// list in memory.
export function useStreamsByGuids(guids: string[]) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...STREAMS_KEY, guid],
      queryFn: () => getStreamById(guid),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  const byGuid = new Map<string, Stream>()
  results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
  return byGuid
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
