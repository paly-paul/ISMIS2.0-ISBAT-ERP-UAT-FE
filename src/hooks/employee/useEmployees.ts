import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { approveEmployee, assignEmployeePermissionGroups, createEmployee, CreateEmployeeInput, Employee, EmployeeListItem, EmployeeListResponse, getEmployee, getEmployeePermissionGroups, getEmployees, getPendingEmployees, updateEmployee, getEmployeeDropdown, EmployeeDropdownItemDto } from '@/lib/api/employee/employee'
import { MENU_KEY } from '@/hooks/users/useMenu'

const EMPLOYEES_KEY = ['employees']
const EMPLOYEE_PERMISSION_GROUPS_KEY = ['employeePermissionGroups']

// Load enough rows to cover the full employee list (226+ seen in practice)
// in one request — the page itself paginates client-side on top of this.
const EMPLOYEES_PAGE_SIZE = 1000

// enabled defaults to true so every existing call site (Employee Master's
// own table, Faculty's dean-name resolution, etc.) keeps eagerly fetching
// exactly as before — only a caller that explicitly wants this deferred
// (e.g. a modal that shouldn't hit the network until it's actually open)
// needs to pass enabled={isOpen}. Without this, a modal component's own
// useEmployees() call fires the moment its *page* mounts, since React hooks
// run on every render of an always-mounted-but-conditionally-rendered modal
// regardless of its isOpen prop — confirmed as a real bug in
// New/EditDepartmentModal, which called this unconditionally even though
// department-master/page.tsx itself never needs the employee list at all.
export function useEmployees(enabled = true) {
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: () => getEmployees(1, EMPLOYEES_PAGE_SIZE),
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create/update) explicitly invalidates this key below,
    // instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export function useEmployeeDropdown() {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, 'dropdown'],
    queryFn: () => getEmployeeDropdown(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side search for Employee Master's search box — hits the same list
// endpoint with the backend's own ?search= param (confirmed live, see the
// note on getEmployees) instead of filtering the already-fetched full list
// client-side. Kept as its own hook/query key so useEmployees() above still
// stays the plain unfiltered, cached list — used by every other call site
// (dropdown pickers etc.) — only enabled while the search box actually has a
// query in it, at which point the page falls back to that shared unfiltered
// list instead of issuing a redundant identical request.
export function useEmployeeSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, 'search', q],
    queryFn: () => getEmployees(1, EMPLOYEES_PAGE_SIZE, q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side paginated + isApproved-filtered list for Employee Approvals'
// own table — separate query key from EMPLOYEES_KEY's plain list/search
// (pageNumber/pageSize instead of a flat array) but still prefixed with it,
// so useCreateEmployee's invalidateQueries({ queryKey: EMPLOYEES_KEY })
// below matches this by prefix too and a newly created (pending) employee
// shows up here without an extra invalidation.
export function usePendingEmployees(pageNumber = 1, pageSize = 10) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, 'pending', pageNumber, pageSize],
    queryFn: () => getPendingEmployees(pageNumber, pageSize),
    placeholderData: keepPreviousData,
  })
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: [...EMPLOYEES_KEY, id],
    queryFn: () => getEmployee(id as string),
    enabled: !!id,
    // Same caching rule as useEmployees — cache this employee's details
    // indefinitely and only refetch when useUpdateEmployee's onSuccess
    // invalidates ['employees'] below (which matches this key by prefix).
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateEmployeeInput }) => updateEmployee(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  })
}

// Employee Approvals' Approve action — invalidates both the pending list
// (so the approved row drops off the current page/count) and the plain
// employee list (so Employee Master's own table picks up isApproved: true
// without a hard reload), same invalidation pair as useUpdateEmployee.
export function useApproveEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (employeeGuid: string) => approveEmployee(employeeGuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY }),
  })
}

// Fetches the permission group guids already assigned to an employee, for
// the assign-permissions modal to seed its tabs from. Only enabled while the
// modal is actually open with an employee, same convention as the other
// fetch-by-guid queries (e.g. useLedger).
export function useEmployeePermissionGroups(employeeGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...EMPLOYEE_PERMISSION_GROUPS_KEY, employeeGuid],
    queryFn: () => getEmployeePermissionGroups(employeeGuid as string),
    enabled: enabled && !!employeeGuid,
  })
}

export function useAssignEmployeePermissionGroups() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeGuid, permissionGroupGuids }: { employeeGuid: string; permissionGroupGuids: string[] }) =>
      assignEmployeePermissionGroups(employeeGuid, { permissionGroupGuids }),
    onSuccess: (_data, { employeeGuid }) => {
      queryClient.invalidateQueries({ queryKey: [...EMPLOYEE_PERMISSION_GROUPS_KEY, employeeGuid] })
      // Only actually changes anything when the assigned employee is the
      // logged-in user themselves (e.g. an admin testing on their own
      // account) — /me/menu is scoped server-side to the caller, so
      // assigning some other employee's permissions has no effect on this
      // tab's menu and this invalidation is a harmless no-op refetch there.
      queryClient.invalidateQueries({ queryKey: MENU_KEY })
    },
  })
}

export type { Employee, EmployeeListItem, EmployeeListResponse, CreateEmployeeInput }
