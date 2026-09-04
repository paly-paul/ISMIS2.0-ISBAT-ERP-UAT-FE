import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEnquiry, Enquiry, EnquiryCounts, EnquiryCountsFilters, EnquiryInput, EnquiryUpdateInput, getEnquiries, getEnquiryById, getEnquiryCounts, updateEnquiry } from '@/lib/api/admission/enquiry'

const ENQUIRIES_KEY = ['enquiries']
const ENQUIRY_COUNTS_KEY = ['enquiry-counts']

// Real (paginated) — 11k+ rows in the sample data, so unlike the small
// master-data lists elsewhere in this app, this can't just fetch everything
// in one big page. page/pageSize are part of the query key so each page is
// cached separately.
export function useEnquiries(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...ENQUIRIES_KEY, page, pageSize],
    queryFn: () => getEnquiries(page, pageSize),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Stats-row summary (Total/Converted/Pending Follow-up/ODL Specific/Closed) —
// a separate endpoint from the paginated list above, not derived from it.
// Accepts the same intakeGuid/sourceGuid filters the page's Intake/Channel
// dropdowns already narrow the table by, so the cards track the active
// filters instead of always showing unfiltered global totals.
export function useEnquiryCounts(filters?: EnquiryCountsFilters) {
  return useQuery({
    queryKey: [...ENQUIRY_COUNTS_KEY, filters?.intakeGuid ?? '', filters?.sourceGuid ?? ''],
    queryFn: () => getEnquiryCounts(filters),
  })
}

export function useCreateEnquiry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EnquiryInput) => createEnquiry(input),
    // Invalidates every cached page (partial key match), not just page 1,
    // plus the counts tile — a new enquiry moves totalCount (and possibly
    // odelSourceCount) too.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY })
      queryClient.invalidateQueries({ queryKey: ENQUIRY_COUNTS_KEY })
    },
  })
}

// Fetches a single enquiry for the assign/view modal. Only enabled while
// the modal is actually open with a guid, same convention as the other
// fetch-by-guid Edit modals in this app.
export function useEnquiry(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ENQUIRIES_KEY, guid],
    queryFn: () => getEnquiryById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useUpdateEnquiry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: EnquiryUpdateInput }) => updateEnquiry(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY })
      queryClient.invalidateQueries({ queryKey: [...ENQUIRIES_KEY, guid] })
    },
  })
}

export type { Enquiry, EnquiryCounts, EnquiryCountsFilters, EnquiryInput, EnquiryUpdateInput }
