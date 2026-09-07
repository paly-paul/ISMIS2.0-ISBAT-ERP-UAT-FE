import { useInfiniteQuery, useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
import { createEnquiryFollowUp, EnquiryFollowUpInput, EnquiryFollowUpListItem, getEnquiryFollowUps, getEnquiryFollowUpsByAdvisor } from '@/lib/api/admission/enquiryFollowUp'

const ENQUIRY_FOLLOW_UPS_KEY = ['enquiryFollowUps']
const ENQUIRY_FOLLOW_UPS_BY_ADVISOR_KEY = ['enquiryFollowUpsByAdvisor']

// Real server-side pagination AND search — search is forwarded to the
// endpoint's own confirmed ?search= param (see the note on
// getEnquiryFollowUps), not applied client-side, so results stay correct no
// matter how large the real table gets. Was previously a single
// pageSize=1000 fetch of the whole table backing a client-side
// usePagination() slice + client-side text filter — same class of "silently
// misses rows past the cap once the table outgrows it" issue useCourseUnits
// hit at 1000-of-1500 rows (826 rows in the sample here, already close).
// keepPreviousData avoids a loading flash between pages/searches by leaving
// the previous result on screen while the next one is in flight.
export function useEnquiryFollowUps(page: number, pageSize: number, search = '', enabled = true) {
  return useQuery({
    queryKey: [...ENQUIRY_FOLLOW_UPS_KEY, page, pageSize, search],
    queryFn: () => getEnquiryFollowUps(page, pageSize, search),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

// Cheap unfiltered count for the "Total Follow-ups" stat tile — pageSize=1
// so it doesn't pull real row data, just totalCount, and stays decoupled
// from whatever the search box above is currently scoped to.
export function useEnquiryFollowUpsCount() {
  return useQuery({
    queryKey: [...ENQUIRY_FOLLOW_UPS_KEY, 'count'],
    queryFn: () => getEnquiryFollowUps(1, 1),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Scroll-to-load-more variant backing NewFollowUpLogModal's Enquiry picker —
// replaces a single capped pageSize=1000 fetch (same "silently misses rows
// past the cap" class of bug useCourseUnits hit at 1000-of-1500 rows; this
// list was already 826-of-totalCount, getting close). Deliberately has NO
// search param, unlike useEnquiryFollowUps above — the picker sends each
// selected enquiry as its 1-based *position* within this exact fetch (see
// the long note on EnquiryFollowUpInput.intEnquiry: the real id mapping is
// still unconfirmed, so position-in-the-full-unfiltered-list is the
// existing guess). A server-side search would reorder/subset that position
// out from under the guess, silently sending a DIFFERENT wrong number than
// today's already-wrong-but-at-least-consistent one — so this only ever
// paginates the same canonical (unfiltered) order, never searches it. The
// modal still offers a search box, but purely as a client-side filter over
// whatever's already loaded (same as SearchSelect's own behavior), which
// only narrows what's *visible* — it never changes an item's position in
// the underlying flattened list.
export function useEnquiryFollowUpsInfinite(pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...ENQUIRY_FOLLOW_UPS_KEY, 'picker-infinite', pageSize],
    queryFn: ({ pageParam }) => getEnquiryFollowUps(pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Real (paginated), scoped to the authenticated advisor server-side. Kept
// under a distinct query key from useEnquiryFollowUps so the two lists
// cache independently.
export function useEnquiryFollowUpsByAdvisor(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...ENQUIRY_FOLLOW_UPS_BY_ADVISOR_KEY, page, pageSize],
    queryFn: () => getEnquiryFollowUpsByAdvisor(page, pageSize),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// No onSuccess invalidation — the list endpoint doesn't echo back enough to
// know for certain the create actually landed correctly (see the note on
// EnquiryFollowUpInput), so let the page decide whether to refetch.
export function useCreateEnquiryFollowUp() {
  return useMutation({
    mutationFn: (input: EnquiryFollowUpInput) => createEnquiryFollowUp(input),
  })
}

export type { EnquiryFollowUpInput, EnquiryFollowUpListItem }
