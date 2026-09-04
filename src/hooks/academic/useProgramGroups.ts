import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProgramGroup, deleteProgramGroup, getProgramGroupById, getProgramGroups, ProgramGroup, ProgramGroupInput, updateProgramGroup } from '@/lib/api/academic/programGroup'

const PROGRAM_GROUPS_KEY = ['programGroups']

// Fetch a large page so the full list is available without client-side pagination.
const PROGRAM_GROUPS_PAGE_SIZE = 1000

export function useProgramGroups() {
  return useQuery({
    queryKey: PROGRAM_GROUPS_KEY,
    queryFn: () => getProgramGroups(1, PROGRAM_GROUPS_PAGE_SIZE),
    // Never treat the cached list as stale on its own — only refetch once a
    // create/update mutation explicitly invalidates this key (not wired up
    // yet — this hook is GET-only for now).
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side search for Programme Group's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useProgramGroups() above still stays the plain unfiltered, cached list —
// only enabled while the search box actually has a query in it, at which
// point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request. Not confirmed against a spec (see
// the note on getProgramGroups), so the caller re-filters client-side too.
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
