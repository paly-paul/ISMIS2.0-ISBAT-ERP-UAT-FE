import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProgramMaster,
  createProgramMasterStep1,
  deleteProgramMasterComplete,
  getProgramMasterFullDetails,
  getProgramMasters,
  getProgramMastersByCampus,
  updateProgramMasterComplete,
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
  ProgramUnitDetail,
  FeeLineDetail,
  FeeStructureDetail,
  ProgramUnitUpdateInput,
  FeeLineUpdateInput,
  FeeStructureUpdateInput,
} from '@/lib/api/academic/programMaster'

// Exported so other mutations that affect the Programme Master list from
// elsewhere — e.g. useUpdateProgramApproval, which approves/rejects a
// programme on a completely separate page — can invalidate this same query
// instead of leaving it stale until the next hard reload.
export const PROGRAM_MASTERS_KEY = ['programMasters']

export function useProgramMasters() {
  return useQuery({
    queryKey: PROGRAM_MASTERS_KEY,
    queryFn: () => getProgramMasters(),
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

export function useCreateProgramMaster() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramMasterInput) => createProgramMaster(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_MASTERS_KEY }),
  })
}

// Step 1 of ProgrammeModal's Add-mode wizard — see post-program-master.md.
// Deliberately a separate mutation from useCreateProgramMaster above, not a
// variant of it: that one calls the combined save-complete endpoint in a
// single shot; this one creates only the bare programme record so Steps
// 2/3 can follow with their own calls using the semesterGuids it returns.
export function useCreateProgramMasterStep1() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramMasterCreateInput) => createProgramMasterStep1(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROGRAM_MASTERS_KEY }),
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
  ProgramUnitDetail,
  FeeLineDetail,
  FeeStructureDetail,
  ProgramUnitUpdateInput,
  FeeLineUpdateInput,
  FeeStructureUpdateInput,
}
