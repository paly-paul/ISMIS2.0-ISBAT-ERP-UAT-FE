import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getPassoutLibraryDepositByStudent,
  PassoutLibraryDepositSearchParams,
  RefundSearchParams,
  searchFakeCertificateTerminations,
  searchPassoutLibraryDeposit,
  searchRejectedApplications,
} from '@/lib/api/academic/refundSearch'

const REFUND_SEARCH_KEY = ['refund-search']

// Backs Payment Console → Refund's three eligibility-search tabs. Paged like
// every other master table in this app (keepPreviousData so the page number
// doesn't flash empty between fetches) rather than the infinite-scroll
// pattern the old free-text student search used — these lists are meant to
// be reviewed row by row (and, for Passout/Library Deposit, bulk-selected),
// not typed past.
export function useRejectedApplicationsSearch(params: RefundSearchParams, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUND_SEARCH_KEY, 'rejected', params],
    queryFn: () => searchRejectedApplications(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function usePassoutLibraryDepositSearch(params: PassoutLibraryDepositSearchParams, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUND_SEARCH_KEY, 'passout-library-deposit', params],
    queryFn: () => searchPassoutLibraryDeposit(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

// Flow 2's single-student detail view — fetched fresh by studentGuid rather
// than reused off the search-list row it was picked from, so the refund
// form always works off current data (e.g. a line refunded moments ago
// elsewhere won't still show as outstanding here).
export function usePassoutLibraryDepositByStudent(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUND_SEARCH_KEY, 'passout-library-deposit', 'student', studentGuid],
    queryFn: () => getPassoutLibraryDepositByStudent(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useFakeCertificateTerminationsSearch(params: RefundSearchParams, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUND_SEARCH_KEY, 'fake-certificate', params],
    queryFn: () => searchFakeCertificateTerminations(params),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export type {
  PagedResult,
  PassoutLedgerLineDto,
  PassoutLibraryDepositRefundCandidateDto,
  PassoutLibraryDepositSearchParams,
  RefundSearchParams,
  RejectedApplicationRefundCandidateDto,
  TerminatedStudentRefundCandidateDto,
} from '@/lib/api/academic/refundSearch'
