import { useInfiniteQuery, useMutation, useQuery, useQueryClient, useQueries, keepPreviousData } from '@tanstack/react-query'
import { createProgramLevel, deleteProgramLevel, getProgramLevelById, getProgramLevels, getProgramLevelsDropdown, getProgramLevelsPaged, ProgramLevel, ProgramLevelInput, updateProgramLevel } from '@/lib/api/academic/programLevel'
import { getNextPageParam } from '@/lib/pagination'

const PROGRAM_LEVELS_KEY = ['programLevels']

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually open (e.g. a modal) needs to pass enabled={isOpen}.
export function useProgramLevels(enabled = true) {
  return useQuery({
    queryKey: PROGRAM_LEVELS_KEY,
    queryFn: () => getProgramLevels(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Server-side search for Programme Level's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useProgramLevels() above still stays the plain unfiltered, cached list —
// only enabled while the search box actually has a query in it, at which
// point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request.
export function useProgramLevelSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...PROGRAM_LEVELS_KEY, 'search', q],
    queryFn: () => getProgramLevels(q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useProgramLevelsPaged(page: number, pageSize: number, search = '') {
  return useQuery({
    queryKey: [...PROGRAM_LEVELS_KEY, 'paged', page, pageSize, search],
    queryFn: () => getProgramLevelsPaged(page, pageSize, search),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useSearchProgramLevelsInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...PROGRAM_LEVELS_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getProgramLevelsPaged(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Batched-by-guid lookup — same convention as useCourseUnitsByGuids/
// useIntakesByGuids/useFacultiesByGuids, used to resolve display labels for
// a bounded set of specific programLevelGuids (e.g. just the ones referenced
// by the current page of Programme Master's own table, or a single record's
// programLevelGuid in a View modal) without holding the whole programme
// level list in memory.
export function useProgramLevelsByGuids(guids: string[]) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...PROGRAM_LEVELS_KEY, guid],
      queryFn: () => getProgramLevelById(guid),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  const byGuid = new Map<string, ProgramLevel>()
  results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
  return byGuid
}

// Picker list (get-program-levels-dropdown.md) — guid/name only, in the
// levels' own sequence. Backs filter dropdowns like Programme Master's.
export function useProgramLevelsDropdown(enabled = true) {
  return useQuery({
    queryKey: [...PROGRAM_LEVELS_KEY, 'dropdown'],
    queryFn: () => getProgramLevelsDropdown(),
    enabled,
  })
}

export function useCreateProgramLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramLevelInput) => createProgramLevel(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_LEVELS_KEY }),
  })
}

// Fetches a single programme level for the Edit modal. Only enabled while
// the modal is actually open with a guid, so it doesn't fire on every
// render of the programme level table.
export function useProgramLevel(programLevelGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_LEVELS_KEY, programLevelGuid],
    queryFn: () => getProgramLevelById(programLevelGuid as string),
    enabled: enabled && !!programLevelGuid,
  })
}

export function useUpdateProgramLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: ProgramLevelInput }) => updateProgramLevel(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: PROGRAM_LEVELS_KEY })
      queryClient.invalidateQueries({ queryKey: [...PROGRAM_LEVELS_KEY, guid] })
    },
  })
}

export function useDeleteProgramLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteProgramLevel(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_LEVELS_KEY }),
  })
}

export type { ProgramLevel, ProgramLevelInput }
