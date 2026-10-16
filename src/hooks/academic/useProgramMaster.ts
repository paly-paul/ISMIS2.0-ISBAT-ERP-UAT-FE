import { useMutation, useQuery, useQueryClient, useInfiniteQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import {
  createProgramMaster,
  createProgramMasterStep1,
  deleteProgramMasterComplete,
  getProgramMasterByGuid,
  getProgramMasterFullDetails,
  getProgramMasters,
  getProgramMastersPage,
  getProgramDropdown,
  getProgramMastersByCampus,
  getProgramMastersByCampusPaged,
  updateProgramMasterComplete,
  updateProgramMasterStep1,
  ProgramMaster,
  ProgramMasterInput,
  ProgramMasterCreateInput,
  ProgramMasterCreated,
  ProgramMasterSemester,
  ProgramUnitInput,
  FeeStructureInput,
  FeeLineInput,
  ProgramMasterFullDetails,
  ProgramMasterUpdateInput,
  ProgramMasterUpdateStep1Input,
  ProgramUnitDetail,
  FeeLineDetail,
  FeeStructureDetail,
  ProgramUnitUpdateInput,
  FeeLineUpdateInput,
  FeeStructureUpdateInput,
} from '@/lib/api/academic/programMaster'
import { getNextPageParam } from '@/lib/pagination'

// Exported so other mutations that affect the Programme Master list from
// elsewhere — e.g. useUpdateProgramApproval, which approves/rejects a
// programme on a completely separate page — can invalidate this same query
// instead of leaving it stale until the next hard reload.
export const PROGRAM_MASTERS_KEY = ['programMasters']

// Single-programme fetch, for when a real programGuid (e.g. prefilled from
// another record, like Application Filing's locked Programme field) isn't
// found in useProgramMasters()' own list — CONFIRMED live: a real
// application-payments row's programGuid ("Aaron Tendo Magala",
// f44b4f73-213b-43c7-9136-700940a9208f) resolved a real Fee Structure
// (filtered client-side by that same programGuid) but had no matching entry
// in useProgramMasters(), so the Programme dropdown rendered as unselected
// — this fills that gap by fetching the one missing record directly instead
// of guessing why the list omitted it (pagination cap, filtering, etc. —
// unconfirmed).
export function useProgramMasterByGuid(programGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'by-guid', programGuid],
    queryFn: () => getProgramMasterByGuid(programGuid),
    enabled: enabled && !!programGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Batched-by-guid lookup — same convention as useCourseUnitsByGuids/
// useIntakesByGuids/useFacultiesByGuids, used to resolve display labels for
// a bounded set of specific programGuids (e.g. just the ones referenced by
// the current page of the standalone Fee Structure page's own table)
// without holding the whole programme list in memory. Shares the same
// query key as useProgramMasterByGuid above, so a guid already resolved by
// one is reused by the other.
//
// Unlike the other useXByGuids hooks in this app, this one also reports
// isLoading — the Fee Structure page uses it to decide whether a guid this
// endpoint came back without (a programme still pending approval — see GET
// /api/v1/academic/program-master's own "approved only" note) is a genuine
// gap worth falling back to the separate not-approved list for, or just
// this batch still being in flight.
export function useProgramMastersByGuids(guids: string[]) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...PROGRAM_MASTERS_KEY, 'by-guid', guid],
      queryFn: () => getProgramMasterByGuid(guid),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  const byGuid = new Map<string, ProgramMaster>()
  results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
  const isLoading = results.some(r => r.isLoading)
  return { byGuid, isLoading }
}

export function useProgramMasters(enabled = true) {
  return useQuery({
    queryKey: PROGRAM_MASTERS_KEY,
    queryFn: () => getProgramMasters(),
    enabled,
    // Never treat the cached list as stale on its own — only refetch when a
    // mutation (create) explicitly invalidates this key below, instead of on
    // every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Server-side search for Programme Master's search box — hits the same list
// endpoint with the backend's own ?search= param instead of filtering the
// already-fetched full list client-side. Kept as its own hook/query key so
// useProgramMasters() above still stays the plain unfiltered, cached list —
// only enabled while the search box actually has a query in it, at which
// point the page falls back to that shared unfiltered list instead of
// issuing a redundant identical request.
export function useProgramMasterSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'search', q],
    queryFn: () => getProgramMasters(q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Real server-side pagination (2026-09-10) for Programme Master's own
// table — replaces the useProgramMasters()/useProgramMasterSearch() pair
// (a full 1000-row fetch + a separate page-1-only search query) with one
// hook, same consolidation useBatches/useLecturerSkills already went
// through. Reuses getProgramMastersPage, confirmed to genuinely support
// page/pageSize/search together (built for ProgramSearchPicker's own
// infinite scroll). useProgramMasters() above stays untouched — programme-
// master's own name-resolution consumers elsewhere (ProgrammeModal,
// ViewProgrammeModal, course-allocation, etc.) still need the full list.
export function useProgramMastersPaged(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'paged', page, pageSize, search],
    queryFn: () => getProgramMastersPage(page, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

// Search-as-you-type/scroll picker (2026-09-09), backing ProgramSearchPicker
// — same useInfiniteQuery + fetch-next-on-scroll pattern
// useSearchCourseUnitsInfinite (useCourseUnits.ts) uses. Replaces the
// Course Units page's own "All Programmes" filter, which used a plain
// SearchSelect over useProgramMasters()' capped 1000-row snapshot. Confirmed
// the endpoint genuinely supports page/pageSize/search together, unlike
// getProgramMasters()'s own hardcoded pageSize=1000 — see getProgramMastersPage.
export function useSearchProgramMastersInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getProgramMastersPage(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Per Application_Payment_Change_Requests_Final_Updated.md #7 — backs the
// Application Payment page's Interested Programme dropdown, scoped to
// whichever Campus is currently selected. Only enabled once a campus is
// picked, same convention as other cascading dropdowns in this app.
export function useProgramMastersByCampus(campusGuid: string, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'byCampus', campusGuid],
    queryFn: () => getProgramMastersByCampus(campusGuid),
    enabled: enabled && !!campusGuid,
  })
}

export function useSearchProgramMastersByCampusInfinite(campusGuid: string, search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'byCampusInfinite', campusGuid, search, pageSize],
    queryFn: ({ pageParam }) => getProgramMastersByCampusPaged(campusGuid, pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled: enabled && !!campusGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Full program master by GUID (single record query)
export function useProgramMaster(programGuid?: string, enabled = true) {
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'detail', programGuid ?? ''],
    queryFn: () => (programGuid ? getProgramMasterByGuid(programGuid) : Promise.reject(new Error('No guid'))),
    enabled: enabled && !!programGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Program dropdown query — hits /api/v1/academic/program-master/dropdown
export function useProgramDropdown(facultyGuid?: string, enabled = true) {
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'dropdown', facultyGuid ?? ''],
    queryFn: () => getProgramDropdown(facultyGuid),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCreateProgramMaster() {
  return useMutation({
    mutationFn: (input: ProgramMasterInput) => createProgramMaster(input),
  })
}

// Step 1 of ProgrammeModal's Add-mode wizard — see post-program-master.md.
// Deliberately a separate mutation from useCreateProgramMaster above, not a
// variant of it: that one calls the combined save-complete endpoint in a
// single shot; this one creates only the bare programme record so Steps
// 2/3 can follow with their own calls using the semesterGuids it returns.
export function useCreateProgramMasterStep1() {
  return useMutation({
    mutationFn: (input: ProgramMasterCreateInput) => createProgramMasterStep1(input),
  })
}

// Fetches the full course-unit/fee-structure breakdown for the Edit modal.
// Only enabled while the modal is actually open in edit mode with a guid,
// same fetch-by-guid convention as the other real Edit modals in this app.
export function useProgramMasterFullDetails(programGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PROGRAM_MASTERS_KEY, 'fullDetails', programGuid],
    queryFn: () => getProgramMasterFullDetails(programGuid as string),
    enabled: enabled && !!programGuid,
  })
}

export function useUpdateProgramMasterComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ programGuid, input }: { programGuid: string; input: ProgramMasterUpdateInput }) => updateProgramMasterComplete(programGuid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_MASTERS_KEY }),
  })
}

export function useUpdateProgramMasterStep1() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ programGuid, input }: { programGuid: string; input: ProgramMasterUpdateStep1Input }) =>
      updateProgramMasterStep1(programGuid, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_MASTERS_KEY }),
  })
}

export function useDeleteProgramMasterComplete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (programGuid: string) => deleteProgramMasterComplete(programGuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_MASTERS_KEY }),
  })
}

export type {
  ProgramMaster,
  ProgramMasterInput,
  ProgramMasterCreateInput,
  ProgramMasterCreated,
  ProgramMasterSemester,
  ProgramUnitInput,
  FeeStructureInput,
  FeeLineInput,
  ProgramMasterFullDetails,
  ProgramMasterUpdateInput,
  ProgramMasterUpdateStep1Input,
  ProgramUnitDetail,
  FeeLineDetail,
  FeeStructureDetail,
  ProgramUnitUpdateInput,
  FeeLineUpdateInput,
  FeeStructureUpdateInput,
}

