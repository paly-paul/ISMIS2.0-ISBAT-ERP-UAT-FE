import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  createCourseUnit, deleteCourseUnit, getCourseUnits, getCourseUnitWithDetails, updateCourseUnit,
  CourseUnit, CourseUnitInput, CourseUnitListResponse, CourseUnitWithDetails, CourseUnitOutlineDetail, CourseUnitTopicDetail,
} from '@/lib/api/academic/courseUnit'
import { upsertCourseUnitOutlines, UpsertCourseUnitOutlineInput } from '@/lib/api/academic/courseUnitOutlines'

const COURSE_UNITS_KEY = ['courseUnits']

// Real server-side pagination, page/pageSize/search as part of the query
// key so each combination is cached independently — same convention as
// useEnquiries.ts. Was previously a single pageSize=1000 fetch of the whole
// table on mount; switched to fetching 10 rows at a time (matching the
// page's own PAGE_SIZE) so the initial page load doesn't wait on the entire
// dataset. search is a real server-side filter (get-courseunits.md) — not
// applied client-side, so results stay correct no matter how large the real
// table gets (confirmed via a live example: a search against a client-side
// cap of the first 1000 of 1500 rows silently missed anything past it).
// keepPreviousData avoids a loading flash between pages by leaving the
// previous page's rows on screen while the next page's request is in
// flight. staleTime/gcTime: Infinity is what actually stops a re-fetch on
// every click, though — each page is meant to be fetched once and then
// served from cache (invalidated only by a mutation) rather than re-hit on
// every Next/Previous, including re-visiting a page already seen.
export function useCourseUnits(page: number, pageSize: number, search = '') {
  return useQuery({
    queryKey: [...COURSE_UNITS_KEY, page, pageSize, search],
    queryFn: () => getCourseUnits(page, pageSize, search),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

const ALL_COURSE_UNITS_PAGE_SIZE = 1000

// Full, unpaginated list — for pickers that need every course unit at once
// (ProgrammeModal's per-semester Course Unit Allocation step), as opposed
// to the course-units table page itself, which now pages 10 at a time via
// useCourseUnits() above. Kept as a separate query key/staleTime so paging
// through the table doesn't touch this cache and vice versa.
export function useAllCourseUnits(enabled = true) {
  return useQuery({
    queryKey: [...COURSE_UNITS_KEY, 'all'],
    queryFn: () => getCourseUnits(1, ALL_COURSE_UNITS_PAGE_SIZE).then(res => res.items),
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export function useCreateCourseUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CourseUnitInput) => createCourseUnit(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COURSE_UNITS_KEY }),
  })
}

// Load one course unit — for the View/Edit modals, and ProgrammeModal's
// Syllabus/Outline/Taught By popup. Fetches via GET /courseunits/{guid}/details
// (see get-courseunit-details-by-guid.md) rather than the plain by-guid
// endpoint, since that one doesn't return outlines at all (confirmed in
// get-courseunit-by-guid.md) — every consumer of this hook reads .outlines,
// so they'd silently get nothing against the real backend otherwise.
export function useCourseUnit(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...COURSE_UNITS_KEY, guid],
    queryFn: () => getCourseUnitWithDetails(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateCourseUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: CourseUnitInput }) => updateCourseUnit(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: COURSE_UNITS_KEY })
      queryClient.invalidateQueries({ queryKey: [...COURSE_UNITS_KEY, guid] })
    },
  })
}

// Standalone outlines-only save — used by CourseUnitModal's Step 2 (Course
// Outline) once Step 1 has already created the course unit via
// useCreateCourseUnit above. See put-courseunit-outlines-by-courseunit.md /
// courseUnitOutlines.ts: this always sends the FULL desired outline state,
// not just what changed.
export function useUpsertCourseUnitOutlines() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ courseUnitGuid, outlines }: { courseUnitGuid: string; outlines: UpsertCourseUnitOutlineInput[] }) =>
      upsertCourseUnitOutlines(courseUnitGuid, outlines),
    onSuccess: (_data, { courseUnitGuid }) => {
      queryClient.invalidateQueries({ queryKey: COURSE_UNITS_KEY })
      queryClient.invalidateQueries({ queryKey: [...COURSE_UNITS_KEY, courseUnitGuid] })
    },
  })
}

export function useDeleteCourseUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteCourseUnit(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COURSE_UNITS_KEY }),
  })
}

export type { CourseUnit, CourseUnitInput, CourseUnitListResponse, CourseUnitWithDetails, CourseUnitOutlineDetail, CourseUnitTopicDetail, UpsertCourseUnitOutlineInput }
