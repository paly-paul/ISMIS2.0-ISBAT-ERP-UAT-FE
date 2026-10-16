import { useMutation, useQuery, useQueryClient, useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { Faculty, FacultyInput, createFaculty, deleteFaculty, getFaculties, getFacultiesPaged, getFacultyById, getFacultyDropdown, updateFaculty } from '@/lib/api/academic/faculty'
import { getNextPageParam } from '@/lib/pagination'

const FACULTIES_KEY = ['faculties']

// Load enough rows to cover the full faculty list in one request.
const FACULTIES_PAGE_SIZE = 1000

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually needed (e.g. a modal that's always mounted regardless
// of isOpen, or a table column resolver deferred until that modal opens)
// needs to pass enabled explicitly.
export function useFaculties(enabled = true) {
  return useQuery({
    queryKey: FACULTIES_KEY,
    queryFn: () => getFaculties(1, FACULTIES_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Faculties scoped to a campus (or all, when campusGuid is empty) — the
// lightweight dropdown endpoint, used by cascading filter panels.
export function useFacultyDropdown(campusGuid: string | null, enabled = true) {
  return useQuery({
    queryKey: [...FACULTIES_KEY, 'dropdown', campusGuid ?? ''],
    queryFn: () => getFacultyDropdown(campusGuid ?? undefined),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Search-as-you-type/scroll picker (2026-09-10), backing FacultySearchPicker
// — same useInfiniteQuery + fetch-next-on-scroll pattern
// useSearchProgramMastersInfinite/useSearchIntakesInfinite use. Replaces
// ProgrammeModal/ViewProgrammeModal's own Faculty dropdown, which used to
// read off useFaculties(isOpen)'s capped 1000-row snapshot. Confirmed live
// that GET /api/v1/academic/faculties genuinely supports page/pageSize/search
// together — see getFacultiesPaged.
export function useSearchFacultiesInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...FACULTIES_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getFacultiesPaged(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Batched-by-guid lookup — same convention as useCourseUnitsByGuids/
// useIntakesByGuids, used to resolve the display label ("code — name") for a
// bounded set of specific facultyGuids (e.g. the one currently selected in a
// modal) without holding the whole faculty list in memory.
export function useFacultiesByGuids(guids: string[]) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...FACULTIES_KEY, guid],
      queryFn: () => getFacultyById(guid),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  const byGuid = new Map<string, Faculty>()
  results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
  return byGuid
}

export function useCreateFaculty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: FacultyInput) => createFaculty(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACULTIES_KEY }),
  })
}

export function useUpdateFaculty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FacultyInput }) => updateFaculty(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACULTIES_KEY }),
  })
}

export function useDeleteFaculty() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteFaculty(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FACULTIES_KEY }),
  })
}

export type { Faculty, FacultyInput }
