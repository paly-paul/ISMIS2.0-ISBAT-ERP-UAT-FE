import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDepartment, deleteDepartment, Department, DepartmentDropdownItem, DepartmentInput, getDepartments, getDepartmentsDropdown, getDepartmentsPaged, updateDepartment } from '@/lib/api/academic/department'
import { getNextPageParam } from '@/lib/pagination'

const DEPARTMENTS_KEY = ['departments']

// Load enough rows to cover the full department list in one request.
const DEPARTMENTS_PAGE_SIZE = 1000

export function useDepartments() {
  return useQuery({
    queryKey: DEPARTMENTS_KEY,
    queryFn: () => getDepartments(1, DEPARTMENTS_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-paginated, load-more-on-scroll picker (2026-09-15) — backs
// EmployeeFormModal's Department dropdown, same convention as Intake/
// Campus/Country's own useSearchXInfinite hooks, in place of useDepartments()'
// single eager 1000-row fetch. get-departments.md documents no `search`
// query param on this endpoint, so there's no server-side text filter to
// wire up here — SearchSelect's own built-in client-side filter still
// narrows whatever pages have loaded so far.
const DEPARTMENTS_SEARCH_PAGE_SIZE = 20

export function useSearchDepartmentsInfinite(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...DEPARTMENTS_KEY, 'search-infinite'],
    queryFn: ({ pageParam }) => getDepartmentsPaged(pageParam, DEPARTMENTS_SEARCH_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Full guid-carrying list for pickers (get-departments-dropdown.md) — no
// pagination, so SearchSelect's own client-side filter covers search.
export function useDepartmentsDropdown(enabled = true) {
  return useQuery({
    queryKey: [...DEPARTMENTS_KEY, 'dropdown'],
    queryFn: () => getDepartmentsDropdown(),
    enabled,
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DepartmentInput) => createDepartment(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DepartmentInput }) => updateDepartment(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY }),
  })
}

export type { Department, DepartmentDropdownItem, DepartmentInput }
