import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createIntake, CreateIntakeInput, deleteIntake, getIntakeById, getIntakes, Intake, updateIntake } from '@/lib/api/academic/intake'

const INTAKES_KEY = ['intakes']

// Fetch a single page large enough to cover the whole list — nothing in
// this codebase currently paginates the master lists client-side, so the
// hook needs the full set in one request rather than the API's default
// page=1/pageSize=10 (which was silently hiding any row past the 10th).
const INTAKES_PAGE_SIZE = 1000

export function useIntakes() {
  return useQuery({
    queryKey: INTAKES_KEY,
    queryFn: () => getIntakes(1, INTAKES_PAGE_SIZE),
    // Same reasoning as the other master-data lists in this app: don't
    // re-fetch just because the user switched tabs and came back — only
    // refetch once a create/update mutation actually changes this data.
    staleTime: Infinity,
    gcTime: Infinity,
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

// Two hero-card queries for the top of Intake Master. These used to ask the
// backend to filter via currentIntake=/currentAdmissionIntake= query params,
// but both flags are already present on every row of the plain (unfiltered)
// list response, so the current academic/admission intake is now found by
// scanning that same list client-side instead of sending extra params. Only
// one intake can ever be flagged current for each, so the first match is the
// one to show — but the list response only carries the same abbreviated
// academicCalendar as every other list row (see the note on getIntakeById
// above: only the by-guid endpoint fully populates it), which left the
// Academic card's Sem Start/Term 1 End/Sem End chips stuck on "—" even once
// the card itself resolved. Re-fetching the match by guid gives the hero
// cards the fully populated record to read date fields off.
// react-query rejects a queryFn that resolves to `undefined` ("Query data
// cannot be undefined") — null is the explicit "no current intake found"
// value instead.
//
// Both the list lookup and the by-guid lookup go through queryClient's own
// cache (ensureQueryData) using the same query keys as useIntakes/useIntake,
// instead of calling getIntakes/getIntakeById directly. react-query dedupes
// ensureQueryData calls that share a queryKey — including concurrent
// in-flight ones — so useCurrentAcademicIntake and useCurrentAdmissionIntake
// no longer each trigger their own full ?pageSize=1000 request (or their own
// by-guid request when they happen to resolve to the same intake); they
// reuse whatever useIntakes() already fetched/is fetching.
async function fetchCurrentIntake(queryClient: QueryClient, predicate: (intake: Intake) => boolean): Promise<Intake | null> {
  const intakes = await queryClient.ensureQueryData({
    queryKey: INTAKES_KEY,
    queryFn: () => getIntakes(1, INTAKES_PAGE_SIZE),
    staleTime: Infinity,
  })
  const match = intakes.find(predicate)
  if (!match) return null
  return queryClient.ensureQueryData({
    queryKey: [...INTAKES_KEY, match.intakeGuid],
    queryFn: () => getIntakeById(match.intakeGuid),
    staleTime: Infinity,
  })
}

export function useCurrentAcademicIntake() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...INTAKES_KEY, 'current-academic'],
    queryFn: () => fetchCurrentIntake(queryClient, i => i.currentIntake),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCurrentAdmissionIntake() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: [...INTAKES_KEY, 'current-admission'],
    queryFn: () => fetchCurrentIntake(queryClient, i => i.currentAdmissionIntake),
    staleTime: Infinity,
    gcTime: Infinity,
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

export type { Intake, AcademicCalendarEntry, CreateIntakeInput, CreateAcademicCalendarEntryInput } from '@/lib/api/academic/intake'
