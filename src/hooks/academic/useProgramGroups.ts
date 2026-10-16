import { useInfiniteQuery, useMutation, useQuery, useQueryClient, useQueries, keepPreviousData } from '@tanstack/react-query'
import { createProgramGroup, deleteProgramGroup, getProgramGroupById, getProgramGroups, getProgramGroupsPaged, ProgramGroup, ProgramGroupInput, updateProgramGroup } from '@/lib/api/academic/programGroup'
import { getNextPageParam } from '@/lib/pagination'

const PROGRAM_GROUPS_KEY = ['programGroups']

// Fetch a large page so the full list is available without client-side pagination.
const PROGRAM_GROUPS_PAGE_SIZE = 1000

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually needed needs to pass enabled explicitly.
export function useProgramGroups(enabled = true) {
  return useQuery({
    queryKey: PROGRAM_GROUPS_KEY,
    queryFn: () => getProgramGroups(1, PROGRAM_GROUPS_PAGE_SIZE),
    // Never treat the cached list as stale on its own — only refetch once a
    // create/update mutation explicitly invalidates this key (not wired up
    // yet — this hook is GET-only for now).
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Search for Programme Group's search box. Kept as its own hook/query key so
// useProgramGroups() above still stays the plain unfiltered, cached list —
// only enabled while the search box actually has a query in it, at which
// point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request. The endpoint has no ?search=, so
// getProgramGroups filters client-side (see its note).
export function useProgramGroupSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...PROGRAM_GROUPS_KEY, 'search', q],
    queryFn: () => getProgramGroups(1, PROGRAM_GROUPS_PAGE_SIZE, q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Real server-side pagination (2026-09-09) for Programme Group's own table —
// see getProgramGroupsPaged's own comment.
export function useProgramGroupsPaged(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...PROGRAM_GROUPS_KEY, 'paged', page, pageSize, search],
    queryFn: () => getProgramGroupsPaged(page, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

export function useSearchProgramGroupsInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...PROGRAM_GROUPS_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getProgramGroupsPaged(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Batched-by-guid lookup — same convention as useCourseUnitsByGuids/
// useIntakesByGuids/useFacultiesByGuids, used to resolve display labels for
// a bounded set of specific programGroupGuids (e.g. just the ones referenced
// by the current page of Programme Master's own table, or a single record's
// programGroupGuid in a View modal) without holding the whole programme
// group list in memory.
export function useProgramGroupsByGuids(guids: string[]) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...PROGRAM_GROUPS_KEY, guid],
      queryFn: () => getProgramGroupById(guid),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  const byGuid = new Map<string, ProgramGroup>()
  results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
  return byGuid
}

export function useCreateProgramGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramGroupInput) => createProgramGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_GROUPS_KEY }),
  })
}

// Fetches a single programme group for the Edit modal. Only enabled while
// the modal is actually open with a guid, so it doesn't fire on every
// render of the programme group table.
export function useProgramGroup(programGroupGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_GROUPS_KEY, programGroupGuid],
    queryFn: () => getProgramGroupById(programGroupGuid as string),
    enabled: enabled && !!programGroupGuid,
  })
}

export function useUpdateProgramGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: ProgramGroupInput }) => updateProgramGroup(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: PROGRAM_GROUPS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PROGRAM_GROUPS_KEY, guid] })
    },
  })
}

export function useDeleteProgramGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteProgramGroup(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_GROUPS_KEY }),
  })
}

export type { ProgramGroup, ProgramGroupInput }
