import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApplicationPaymentInput,
  createApplicationPayment,
  getApplicationPaymentExemptionTypes,
  getApplicationPaymentTypes,
  getUnconvertedEnquiries,
} from '@/lib/api/admission/applicationPayment'

const APPLICATION_PAYMENTS_KEY = ['application-payments']

// `search` is optional server-side filtering (part of the key, so each term
// caches separately); omit it for the full list.
export function useApplicationPaymentExemptionTypes(search = '') {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'exemption-types', search],
    queryFn: () => getApplicationPaymentExemptionTypes(search),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Per Application_Payment_Change_Requests_Final_Updated.md #1/#2 — only
// enabled once an Intake has actually been picked, same "gate the dependent
// dropdown" convention as useApplicationPaymentFees/useSemestersForProgram.
export function useUnconvertedEnquiries(intakeGuid: string, page: number, pageSize: number, enabled: boolean, search = '') {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'unconverted-enquiries', intakeGuid, page, pageSize, search],
    queryFn: () => getUnconvertedEnquiries(intakeGuid, page, pageSize, search),
    enabled: enabled && !!intakeGuid,
  })
}

// Real server-paginated, scroll-to-load-more variant of the same endpoint —
// backs the Payment page's Enquiry dropdown, replacing
// the old single pageSize=1000 "fetch nearly everything for this intake up
// front" SearchSelect. Same useInfiniteQuery + fetch-next-on-scroll
// mechanism as useSearchCourseUnitsInfinite (useCourseUnits.ts). The typed
// term goes out as ?search= (student name / enquiry code, see
// getUnconvertedEnquiries) and is part of the query key — each typed term's pages are cached
// separately, no client-side re-filtering.
export function useUnconvertedEnquiriesInfinite(intakeGuid: string, searchTerm: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'unconverted-enquiries-infinite', intakeGuid, searchTerm, pageSize],
    queryFn: ({ pageParam }) => getUnconvertedEnquiries(intakeGuid, pageParam, pageSize, searchTerm),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.items.length, 0)
      return fetched < lastPage.totalCount ? allPages.length + 1 : undefined
    },
    enabled: enabled && !!intakeGuid,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useApplicationPaymentTypes(search = '') {
  return useQuery({
    queryKey: [...APPLICATION_PAYMENTS_KEY, 'payment-types', search],
    queryFn: () => getApplicationPaymentTypes(search),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// A successful payment converts its enquiry (status → Registered) in the same
// transaction, and "already been converted" means our cached list is stale —
// so after any attempt, refresh the unconverted-enquiry picker and the
// enquiry list. Intake errors mean the current/admission intake flags
// changed under us — refetch those (keys from useIntakes).
export function useCreateApplicationPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ApplicationPaymentInput) => createApplicationPayment(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [...APPLICATION_PAYMENTS_KEY, 'unconverted-enquiries-infinite'] })
      queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      queryClient.invalidateQueries({ queryKey: ['enquiry-counts'] })
    },
    onError: (error: Error) => {
      if (/current intake only|no active admission intake/i.test(error.message)) {
        queryClient.invalidateQueries({ queryKey: ['intakes', 'current-academic'] })
        queryClient.invalidateQueries({ queryKey: ['intakes', 'current-admission'] })
      }
    },
  })
}

export type {
  ApplicationPaymentInput,
  BankAccountInfoDto,
  BatchInfoDto,
  ExemptionTypeDto,
  ProgramFeeHeadInfoDto,
  PaymentTypeDto,
  CreateApplicationPaymentResponse,
} from '@/lib/api/admission/applicationPayment'
