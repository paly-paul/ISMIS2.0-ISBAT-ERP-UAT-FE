import { QueryClient, useMutation, useQuery, useQueryClient, useInfiniteQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import { createIntake, CreateIntakeInput, deleteIntake, getCurrentIntake, getIntakeById, getIntakes, getIntakesPaged, Intake, updateIntake, getIntakesDropdown } from '@/lib/api/academic/intake'
import { getNextPageParam } from '@/lib/pagination'

const INTAKES_KEY = ['intakes']

// Fetch a single page large enough to cover the whole list — nothing in
// this codebase currently paginates the master lists client-side, so the
// hook needs the full set in one request rather than the API's default
// page=1/pageSize=10 (which was silently hiding any row past the 10th).
const INTAKES_PAGE_SIZE = 1000

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually open (e.g. a modal) needs to pass enabled={isOpen}.
export function useIntakes(enabled = true) {
  return useQuery({
    queryKey: INTAKES_KEY,
    queryFn: () => getIntakes(1, INTAKES_PAGE_SIZE),
    // Same reasoning as the other master-data lists in this app: don't
    // re-fetch just because the user switched tabs and came back — only
    // refetch once a create/update mutation actually changes this data.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Server-side search for Intake Master's search box — hits the same list
// endpoint with the backend's own ?search= param (contains-match against
// Description, Month, and IntakeCode) instead of filtering the already-
// fetched full list client-side. Kept as its own hook/query key rather than
// folded into useIntakes() above, so every other page that calls useIntakes()
// unparametrized keeps sharing that one unfiltered, cached full list — only
// disabled while the search box is empty, at which point the page falls back
// to that shared unfiltered list instead of issuing a redundant identical
// request.
export function useIntakeSearch(search: string) {
  const q = search.trim()
  return useQuery({
    queryKey: [...INTAKES_KEY, 'search', q],
    queryFn: () => getIntakes(1, INTAKES_PAGE_SIZE, q),
    enabled: q.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Real server-side pagination (2026-09-09) for Intake Master's own table —
// see getIntakesPaged's own comment.
export function useIntakesPaged(page: number, pageSize: number, search: string) {
  return useQuery({
    queryKey: [...INTAKES_KEY, 'paged', page, pageSize, search],
    queryFn: () => getIntakesPaged(page, pageSize, search),
    placeholderData: keepPreviousData,
  })
}

// Search-as-you-type/scroll picker (2026-09-10), backing IntakeSearchPicker
// — same useInfiniteQuery + fetch-next-on-scroll pattern
// useSearchProgramMastersInfinite (useProgramMaster.ts) uses. Replaces
// ProgrammeModal's own Intake dropdowns, which used to read off useIntakes()'
// capped 1000-row snapshot. Reuses getIntakesPaged, already confirmed to
// genuinely support page/pageSize/search together (built for Intake
// Master's own table pagination).
export function useSearchIntakesInfinite(search: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...INTAKES_KEY, 'search-infinite', search, pageSize],
    queryFn: ({ pageParam }) => getIntakesPaged(pageParam, pageSize, search),
    initialPageParam: 1,
    getNextPageParam,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Batched-by-guid lookup — same convention as useCourseUnitsByGuids
// (useCourseUnits.ts), used by ProgrammeModal to resolve the display label
// (intakeCode — description) for a bounded set of specific intake guids
// (the top-level Programme Intake plus whichever intake each fee structure
// already carries) instead of holding the whole intake list in memory just
// to look labels up, now that useIntakes(isOpen)'s capped 1000-row snapshot
// has been replaced by IntakeSearchPicker's own search/scroll fetch.
export function useIntakesByGuids(guids: string[]) {
  const unique = Array.from(new Set(guids.filter(Boolean)))
  const results = useQueries({
    queries: unique.map(guid => ({
      queryKey: [...INTAKES_KEY, guid],
      queryFn: () => getIntakeById(guid),
      staleTime: Infinity,
      gcTime: Infinity,
    })),
  })
  const byGuid = new Map<string, Intake>()
  results.forEach((r, i) => { if (r.data) byGuid.set(unique[i], r.data) })
  return byGuid
}

// Fetches a single intake (with its full academicCalendar detail) for the
// Edit Intake modal. Only enabled while the modal is actually open with a
// guid, so it doesn't fire on every render of the intake table.
export function useIntake(intakeGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...INTAKES_KEY, intakeGuid],
    queryFn: () => getIntakeById(intakeGuid as string),
    enabled: enabled && !!intakeGuid,
  })
}

// Two hero-card queries for the top of Intake Master. They intentionally stay
// lightweight: the page only needs the current intake summary to render the
// cards, not the fully expanded calendar payload from the by-guid detail API.
// Keeping this as a direct current-intake query avoids the extra GUID fetch on
// page load while still populating the card labels and status.
export function useCurrentAcademicIntake(enabled = true) {
  return useQuery({
    queryKey: [...INTAKES_KEY, 'current-academic'],
    queryFn: () => getCurrentIntake('currentIntake'),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export function useCurrentAdmissionIntake(enabled = true) {
  return useQuery({
    queryKey: [...INTAKES_KEY, 'current-admission'],
    queryFn: () => getCurrentIntake('currentAdmissionIntake'),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export function useCreateIntake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIntakeInput) => createIntake(input),
    // Once a new intake is saved, the cached list is out of date, so tell
    // react-query to go fetch it again next time useIntakes() is used.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INTAKES_KEY }),
  })
}

export function useUpdateIntake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ intakeGuid, input }: { intakeGuid: string; input: CreateIntakeInput }) => updateIntake(intakeGuid, input),
    // Invalidate both the list and the single-intake cache for this guid, so
    // the table and a re-opened Edit modal both pick up the change.
    onSuccess: (_data, { intakeGuid }) => {
      queryClient.invalidateQueries({ queryKey: INTAKES_KEY })
      queryClient.invalidateQueries({ queryKey: [...INTAKES_KEY, intakeGuid] })
    },
  })
}

export function useDeleteIntake() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (intakeGuid: string) => deleteIntake(intakeGuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INTAKES_KEY }),
  })
}

export function useIntakesDropdown(enabled = true) {
  return useQuery({
    queryKey: [...INTAKES_KEY, 'dropdown'],
    queryFn: getIntakesDropdown,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export type { Intake, AcademicCalendarEntry, CreateIntakeInput, CreateAcademicCalendarEntryInput, IntakeDropdownItem } from '@/lib/api/academic/intake'
