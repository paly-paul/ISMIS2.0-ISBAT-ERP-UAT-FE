import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query'
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
