import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDesignation, deleteDesignation, Designation, DesignationInput, getDesignations, getDesignationsDropdown, getDesignationsPaged, updateDesignation } from '@/lib/api/academic/designation'
import { getNextPageParam } from '@/lib/pagination'

const DESIGNATIONS_KEY = ['designations']

// Load enough rows to cover the full designation list in one request.
const DESIGNATIONS_PAGE_SIZE = 1000

export function useDesignations() {
  return useQuery({
    queryKey: DESIGNATIONS_KEY,
    queryFn: () => getDesignations(1, DESIGNATIONS_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-paginated, load-more-on-scroll picker (2026-09-15) — backs
// EmployeeFormModal's Designation dropdown, same convention as Intake/
// Campus/Country's own useSearchXInfinite hooks, in place of useDesignations()'
// single eager 1000-row fetch. get-designations.md documents no `search`
// param and no department-filter param either — per request, this drops
// the "only this department's designations" client-side narrowing
// useDesignations() + a manual filter used to provide, since there's no way
// to keep that scoping correct once designations load progressively
// instead of all at once.
const DESIGNATIONS_SEARCH_PAGE_SIZE = 20

export function useSearchDesignationsInfinite(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...DESIGNATIONS_KEY, 'search-infinite'],
    queryFn: ({ pageParam }) => getDesignationsPaged(pageParam, DESIGNATIONS_SEARCH_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Guid-carrying picker list scoped to one department
// (get-designations-dropdown.md's deptGuid filter) — only fetched once a
// department is picked, for the Department → Designation cascade.
export function useDesignationsDropdown(deptGuid: string, enabled = true) {
  return useQuery({
    queryKey: [...DESIGNATIONS_KEY, 'dropdown', deptGuid],
    queryFn: () => getDesignationsDropdown(deptGuid),
    enabled: enabled && !!deptGuid,
  })
}

export function useCreateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DesignationInput) => createDesignation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DESIGNATIONS_KEY }),
  })
}

export function useUpdateDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DesignationInput }) => updateDesignation(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DESIGNATIONS_KEY }),
  })
}

export function useDeleteDesignation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDesignation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DESIGNATIONS_KEY }),
  })
}

export type { Designation, DesignationInput }
