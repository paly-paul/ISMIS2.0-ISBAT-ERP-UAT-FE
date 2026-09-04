import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAdvanceDeposit,
  createPayment,
  createPaymentOther,
  getAllOutstandingLedgers,
  getCurrentSemesterPayable,
  getLedgerOthers,
  getOutstandingLedgers,
  getPayableLedgers,
  getPaymentHistory,
  getPaymentHistoryList,
  getStudentProfile,
  searchStudents,
  AdvanceDepositInput,
  PaymentInput,
  PaymentOtherInput,
  PayableLedgersParams,
} from '@/lib/api/finance/paymentConsole'

const PAYMENT_CONSOLE_KEY = ['payment-console']

export function useSearchStudents(searchTerm: string, pageNumber: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'search', searchTerm, pageNumber, pageSize],
    queryFn: () => searchStudents(searchTerm, pageNumber, pageSize),
    enabled,
  })
}

// Infinite-scroll variant of useSearchStudents, same shape as the student
// module's own useStudentSearchAdvancedInfinite (useStudentSearch.ts) — the
// picker dropdowns here (Payment Console, and NCHE/Guild's Guild tab) load
// more results as the list is scrolled instead of a fixed single page.
// staleTime/gcTime: Infinity, same reasoning as that hook — once a page of
// search results is fetched for a given term it doesn't go stale from
// under the user mid-scroll, and there's no case where refetching an
// already-loaded page makes sense here.
export function useSearchStudentsInfinite(searchTerm: string, pageSize: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'search-infinite', searchTerm, pageSize],
    queryFn: ({ pageParam }) => searchStudents(searchTerm, pageParam, pageSize),
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

// studentGuid is optional (see getStudentProfile) — pass it when the caller
// already has one (e.g. straight off a searchStudents() hit) so the backend
// can resolve full student fields instead of falling back to
// application-only ones.
export function useStudentProfile(applicationGuid: string | null, enabled: boolean, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'profile', applicationGuid, studentGuid],
    queryFn: () => getStudentProfile(applicationGuid as string, studentGuid),
    enabled: enabled && !!applicationGuid,
  })
}

// studentGuid is optional (see getOutstandingLedgers) — pass it once the
// caller has one; most callers today don't (the payment console only ever
// resolves an applicationGuid via search, never a separate studentGuid).
export function useOutstandingLedgers(applicationGuid: string | null, enabled: boolean, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'outstanding-ledgers', applicationGuid, studentGuid],
    queryFn: () => getOutstandingLedgers(applicationGuid as string, studentGuid),
    enabled: enabled && !!applicationGuid,
  })
}

// Discount-aware replacement for useOutstandingLedgers on Step 2's
// Outstanding Balance display — see getCurrentSemesterPayable's own comment.
// Same optional-studentGuid convention as useOutstandingLedgers.
export function useCurrentSemesterPayable(applicationGuid: string | null, enabled: boolean, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'current-semester-payable', applicationGuid, studentGuid],
    queryFn: () => getCurrentSemesterPayable(applicationGuid as string, studentGuid),
    enabled: enabled && !!applicationGuid,
  })
}

// Other Payment tab's Ledger dropdown — unpaged catalogue, fetched once and
// cached like every other master-data list in this app.
export function useLedgerOthers() {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'ledger-others'],
    queryFn: getLedgerOthers,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// All four categories (tuition/other/NCHE/guild) in one flat list — see
// getAllOutstandingLedgers' own comment. Takes no studentGuid, unlike
// useOutstandingLedgers above.
export function useAllOutstandingLedgers(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'outstanding-all', applicationGuid],
    queryFn: () => getAllOutstandingLedgers(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

export function usePaymentHistory(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'payment-history', applicationGuid],
    queryFn: () => getPaymentHistory(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

// Cross-application ledger (GET .../payment-history, no guid) — genuinely
// distinct from usePaymentHistory(applicationGuid, enabled) above, see the
// getPaymentHistoryList() comment in lib/api/finance/paymentConsole.ts.
// Backs the standalone /finance/payment-history page's server-side pagination
// (the real totalCount runs into six figures — fetch-all-client-side, the old
// mock page's approach, isn't viable here).
export function usePaymentHistoryList(pageNumber: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'payment-history-list', pageNumber, pageSize],
    queryFn: () => getPaymentHistoryList(pageNumber, pageSize),
  })
}

// params is expected to already be debounced by the caller (Step 3's Amount/
// Currency/Date fields change on every keystroke — this hook itself doesn't
// debounce, it just fetches whatever params it's given).
export function usePayableLedgers(params: PayableLedgersParams | null, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENT_CONSOLE_KEY, 'payable-ledgers', params],
    queryFn: () => getPayableLedgers(params as PayableLedgersParams),
    enabled: enabled && !!params,
    // The global QueryClient (providers.tsx) defaults to 3 retries with
    // exponential backoff, meant for transient network/5xx failures. A 400
    // here (confirmed live: "Today's exchange rate has not been entered for
    // the payment date") is a permanent validation error that will keep
    // failing identically on retry — left at the default, the cashier saw
    // "Calculating allocation…" for 7+ seconds before isPreviewError ever
    // flipped, since react-query stays in a fetching state through every
    // retry attempt.
    retry: false,
  })
}

export function useCreatePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentInput) => createPayment(input),
    // Step 2's outstanding-ledgers/payment-history for this application are
    // now stale the moment the payment lands — refetch both.
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: [...PAYMENT_CONSOLE_KEY, 'outstanding-ledgers', input.applicationGuid] })
      queryClient.invalidateQueries({ queryKey: [...PAYMENT_CONSOLE_KEY, 'current-semester-payable', input.applicationGuid] })
      queryClient.invalidateQueries({ queryKey: [...PAYMENT_CONSOLE_KEY, 'payment-history', input.applicationGuid] })
    },
  })
}

// Shared invalidation for category payment mutations — each lands money
// against a category outstanding-all (get-all-outstanding-ledgers.md)
// covers, and payment-history spans all categories too (per the flow doc),
// so both need refetching regardless of which category the payment was in.
// Unlike useCreatePayment (Tuition) above, none of these touch
// outstanding-ledgers — that endpoint is tuition-only. Exported for the
// merged NCHE/Guild payment page's own hooks (useNcheGuildPayment.ts),
// which need the identical invalidation but create against their own
// dedicated endpoints, not this file's.
export function invalidateAfterCategoryPayment(queryClient: ReturnType<typeof useQueryClient>, applicationGuid: string) {
  queryClient.invalidateQueries({ queryKey: [...PAYMENT_CONSOLE_KEY, 'outstanding-all', applicationGuid] })
  queryClient.invalidateQueries({ queryKey: [...PAYMENT_CONSOLE_KEY, 'payment-history', applicationGuid] })
}

export function useCreatePaymentOther() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentOtherInput) => createPaymentOther(input),
    onSuccess: (_result, input) => invalidateAfterCategoryPayment(queryClient, input.applicationGuid),
  })
}

// Invalidates advanced-payments' own list (usePaymentAdvances, in
// usePayments.ts) — a separate query-key family (['payments','advances'])
// from this file's own ['payment-console', …] keys, but a new deposit here
// is exactly the data that list shows, so it needs to refetch too. Broad
// invalidation (no page number) matches useCreatePayment's own
// outstanding-ledgers/payment-history invalidation above — cheap to
// refetch, and the mutation has no way to know which page the caller has
// open.
export function useCreateAdvanceDeposit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AdvanceDepositInput) => createAdvanceDeposit(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments', 'advances'] }),
  })
}

export type { AdvanceDepositInput, AdvanceDepositResult, AllOutstandingItem, ApplicationSummary, CurrentSemesterPayableLedger, CurrentSemesterPayableTotal, LedgerOthersDto, OutstandingLedger, PayableLedgerLine, PayableLedgersParams, PaymentHistoryEntry, PaymentHistoryListEntry, PaymentInput, PaymentOtherInput, PaymentOtherResult, PaymentResult, StudentProfile } from '@/lib/api/finance/paymentConsole'
export { PAYMENT_CATEGORY_LABELS, PAY_TYPE_LABELS, PAY_TYPE_TO_RECEIPT_CATEGORY } from '@/lib/api/finance/paymentConsole'
