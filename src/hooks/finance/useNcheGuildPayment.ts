import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRegulatoryPayment,
  deleteRegulatoryPayment,
  getRegulatoryPaymentHistory,
  getRegulatorySemesterStatus,
  searchNcheStudents,
  updateRegulatoryPayment,
  PaymentCategory,
  RegulatoryPaymentInput,
  RegulatoryPaymentUpdateInput,
} from '@/lib/api/finance/ncheGuildPayment'
import { invalidateAfterCategoryPayment } from './usePaymentConsole'

// Merged NCHE + Guild Payment hooks — backs the single tabbed
// src/app/finance/nche-guild-payment page. Every hook here takes the active
// `category` and scopes its own query key under [`${category}-payment`, ...]
// so switching tabs never serves stale/wrong-category data from cache.

function keyFor(category: PaymentCategory) {
  return [`${category}-payment`]
}

export function useCreateRegulatoryPayment(category: PaymentCategory) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<RegulatoryPaymentInput, 'category'>) => createRegulatoryPayment(category, input),
    // Same invalidation Payment Console's own category-payment mutations
    // use — this category's outstanding-all entry and payment-history both
    // go stale the moment this lands, plus this page's own history/
    // semester-status queries.
    onSuccess: (_result, input) => {
      invalidateAfterCategoryPayment(queryClient, input.applicationGuid)
      if (input.studentGuid) queryClient.invalidateQueries({ queryKey: [...keyFor(category), 'history', input.studentGuid] })
      queryClient.invalidateQueries({ queryKey: [...keyFor(category), 'semester-status', input.applicationGuid] })
    },
  })
}

export function useUpdateRegulatoryPayment(category: PaymentCategory) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentGuid, input }: { paymentGuid: string; input: RegulatoryPaymentUpdateInput; applicationGuid: string; studentGuid: string | null }) =>
      updateRegulatoryPayment(category, paymentGuid, input),
    onSuccess: (_result, { applicationGuid, studentGuid }) => {
      invalidateAfterCategoryPayment(queryClient, applicationGuid)
      if (studentGuid) queryClient.invalidateQueries({ queryKey: [...keyFor(category), 'history', studentGuid] })
      queryClient.invalidateQueries({ queryKey: [...keyFor(category), 'semester-status', applicationGuid] })
    },
  })
}

export function useDeleteRegulatoryPayment(category: PaymentCategory) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ paymentGuid }: { paymentGuid: string; applicationGuid: string; studentGuid: string | null }) =>
      deleteRegulatoryPayment(category, paymentGuid),
    onSuccess: (_result, { applicationGuid, studentGuid }) => {
      invalidateAfterCategoryPayment(queryClient, applicationGuid)
      if (studentGuid) queryClient.invalidateQueries({ queryKey: [...keyFor(category), 'history', studentGuid] })
      queryClient.invalidateQueries({ queryKey: [...keyFor(category), 'semester-status', applicationGuid] })
    },
  })
}

export function useRegulatoryPaymentHistory(category: PaymentCategory, studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...keyFor(category), 'history', studentGuid],
    queryFn: () => getRegulatoryPaymentHistory(category, studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useRegulatorySemesterStatus(category: PaymentCategory, applicationGuid: string | null, enabled: boolean, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...keyFor(category), 'semester-status', applicationGuid, studentGuid],
    // getRegulatorySemesterStatus never rejects (see its own comment) — any
    // failure, including the 404 seen live before this route exists on the
    // backend, resolves to null instead, so there's nothing here for
    // react-query's retry to act on.
    queryFn: () => getRegulatorySemesterStatus(category, applicationGuid as string, studentGuid),
    enabled: enabled && !!applicationGuid,
  })
}

// NCHE's own dedicated student picker (get-nche-search.md) — see
// searchNcheStudents' own comment. Query-keyed separately from Payment
// Console's ['payment-console','search',...] since it's a different backend
// call with a different response shape, not just a different category
// filter on the same one.
export function useNcheStudentSearch(searchTerm: string, page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: [...keyFor('nche'), 'search', searchTerm, page, pageSize],
    queryFn: () => searchNcheStudents(searchTerm, page, pageSize),
    enabled,
  })
}

// Infinite-scroll variant of useNcheStudentSearch, same shape as the
// student module's own useStudentSearchAdvancedInfinite (useStudentSearch.ts)
// — the NCHE tab's picker dropdown loads more results as the list is
// scrolled instead of a fixed single page. staleTime/gcTime: Infinity, same
// reasoning as that hook.
export function useNcheStudentSearchInfinite(searchTerm: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...keyFor('nche'), 'search-infinite', searchTerm, pageSize],
    queryFn: ({ pageParam }) => searchNcheStudents(searchTerm, pageParam, pageSize),
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

export type { PaymentCategory, RegulatoryPaymentInput, RegulatoryPaymentResult, RegulatoryPaymentUpdateInput, RegulatoryPaymentHistoryEntry, RegulatorySemesterStatus, NcheStudentSearchResult, NcheStudentSearchResponse } from '@/lib/api/finance/ncheGuildPayment'
