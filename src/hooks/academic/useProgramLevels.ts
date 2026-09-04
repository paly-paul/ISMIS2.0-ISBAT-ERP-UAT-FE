import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProgramLevel, deleteProgramLevel, getProgramLevelById, getProgramLevels, ProgramLevel, ProgramLevelInput, updateProgramLevel } from '@/lib/api/academic/programLevel'

const PROGRAM_LEVELS_KEY = ['programLevels']

export function useProgramLevels() {
  return useQuery({
    queryKey: PROGRAM_LEVELS_KEY,
    queryFn: () => getProgramLevels(),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
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
