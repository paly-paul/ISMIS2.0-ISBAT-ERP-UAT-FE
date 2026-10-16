import { useInfiniteQuery, useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { createRepetitionTag, deleteRepetitionTag, getRepetitionTagById, getRepetitionTags, getRepetitionTagsPaged, RepetitionTag, RepetitionTagInput, updateRepetitionTag } from '@/lib/api/academic/repetitionTag'
import { getNextPageParam } from '@/lib/pagination'

const REPETITION_TAGS_KEY = ['repetitionTags']

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually open (e.g. a modal) needs to pass enabled={isOpen}.
export function useRepetitionTags(enabled = true) {
  return useQuery({
    queryKey: REPETITION_TAGS_KEY,
    queryFn: () => getRepetitionTags(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update/delete) explicitly invalidates this key, once
    // those are wired up.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export function useCreateRepetitionTag() {
  return useMutation({
    mutationFn: (input: RepetitionTagInput) => createRepetitionTag(input),
  })
}

// Server-side search for Repetition Tag's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useRepetitionTags() above still stays the plain unfiltered, cached list —
// only enabled while the search box actually has a query in it, at which
// point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request. The lib layer re-filters
// client-side against whatever comes back too, so results stay correct even
// if the backend doesn't actually recognize ?search=.
export function useRepetitionTagSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...REPETITION_TAGS_KEY, 'search', q],
    queryFn: () => getRepetitionTags(q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Real server-side pagination (2026-09-09) for Repetition Tag's own table —
// see getRepetitionTagsPaged's own comment. keepPreviousData avoids the
// table flashing to a loading state on every page/search change; the old
// page's rows stay on screen (isFetching still flips true) until the new
// page resolves, same UX enquiry-list's own useEnquiries gets from
// react-query's default placeholderData behavior on a stable queryKey shape.
export function useRepetitionTagsPaged(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...REPETITION_TAGS_KEY, 'paged', page, pageSize, search],
    queryFn: () => getRepetitionTagsPaged(page, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

export function useSearchRepetitionTagsInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...REPETITION_TAGS_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getRepetitionTagsPaged(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Fetches a single repetition tag for the Edit modal. Only enabled while
// the modal is actually open with a guid, so it doesn't fire on every
// render of the repetition tag table.
export function useRepetitionTag(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REPETITION_TAGS_KEY, guid],
    queryFn: () => getRepetitionTagById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateRepetitionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: RepetitionTagInput }) => updateRepetitionTag(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: REPETITION_TAGS_KEY })
      queryClient.invalidateQueries({ queryKey: [...REPETITION_TAGS_KEY, guid] })
    },
  })
}

export function useDeleteRepetitionTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteRepetitionTag(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPETITION_TAGS_KEY }),
  })
}

export type { RepetitionTag, RepetitionTagInput }
