import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bulkRefundPassoutLibraryDeposit,
  createRefund,
  getLedgerDetailsBatch,
  getLedgerOptions,
  getOtherLedgerDetailsBatch,
  getPaymentRefunds,
  getRefundsByApplication,
  getTotalPaid,
  BulkRefundLineInput,
  CreateRefundInput,
  PaymentRefundListParams,
} from '@/lib/api/finance/paymentRefund'

const PAYMENT_REFUND_KEY = ['payment-refunds']
const LEDGER_OPTIONS_KEY = ['refund-ledger-options']
const TOTAL_PAID_KEY = ['refund-total-paid']
const REFUNDS_BY_APPLICATION_KEY = ['refunds-by-application']
const LEDGER_DETAILS_BATCH_KEY = ['refund-ledger-details-batch']
const OTHER_LEDGER_DETAILS_BATCH_KEY = ['refund-other-ledger-details-batch']

// The ledger picker — enabled once an application is selected.
export function useLedgerOptions(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...LEDGER_OPTIONS_KEY, applicationGuid],
    queryFn: () => getLedgerOptions(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  })
}

// Shown once a ledger is picked, before submitting — same total-paid figure
// the create endpoint validates against.
export function useTotalPaid(applicationGuid: string | null, ledgerGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...TOTAL_PAID_KEY, applicationGuid, ledgerGuid],
    queryFn: () => getTotalPaid(applicationGuid as string, ledgerGuid as string),
    enabled: enabled && !!applicationGuid && !!ledgerGuid,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  })
}

// This application's own refund history (unpaged — at most one row per
// ledger, ever) — backs the refund page's own "Refund Details" table.
export function useRefundsByApplication(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUNDS_BY_APPLICATION_KEY, applicationGuid],
    queryFn: () => getRefundsByApplication(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  })
}

// Cross-application, paged refund ledger — not used by the refund page
// itself (see getPaymentRefunds's own comment), kept for any future
// cross-application refunds report.
export function usePaymentRefundsList(params: PaymentRefundListParams, enabled: boolean) {
  return useQuery({
    queryKey: [...PAYMENT_REFUND_KEY, 'list', params],
    queryFn: () => getPaymentRefunds(params),
    enabled,
  })
}

// Refund-Eligibility Search categories 1 (Rejected by Registrar) and 3
// (Fake-Certificate Termination) both pick a ledger line off this — the
// unrefunded main-ledger payments for a (small, just-selected) batch of
// applications, usually just one. Array-keyed so callers pass a stable
// query key rather than the array reference itself.
export function useLedgerDetailsBatch(applicationGuids: string[], ledgerName: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...LEDGER_DETAILS_BATCH_KEY, applicationGuids, ledgerName],
    queryFn: () => getLedgerDetailsBatch(applicationGuids, ledgerName),
    enabled: enabled && applicationGuids.length > 0,
    staleTime: 60 * 1000,
  })
}

// Category 2 (Passout/Library Deposit) already gets its ledgers embedded in
// the search response itself — this backs a manual re-check only, not the
// tab's normal flow.
export function useOtherLedgerDetailsBatch(studentGuids: string[], ledgerName: string, enabled: boolean) {
  return useQuery({
    queryKey: [...OTHER_LEDGER_DETAILS_BATCH_KEY, studentGuids, ledgerName],
    queryFn: () => getOtherLedgerDetailsBatch(studentGuids, ledgerName),
    enabled: enabled && studentGuids.length > 0 && !!ledgerName,
    staleTime: 60 * 1000,
  })
}

// Category 2's bulk-confirm step — one call refunding every checked line,
// each processed independently server-side (see bulkRefundPassoutLibraryDeposit's
// own comment). Invalidates the same caches a single createRefund success
// does, across every distinct application touched by the batch.
export function useBulkRefundPassoutLibraryDeposit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lines: BulkRefundLineInput[]) => bulkRefundPassoutLibraryDeposit(lines),
    onSuccess: (_results, lines) => {
      const applicationGuids = new Set(lines.map(l => l.applicationGuid))
      applicationGuids.forEach(applicationGuid => {
        queryClient.invalidateQueries({ queryKey: [...REFUNDS_BY_APPLICATION_KEY, applicationGuid] })
      })
      queryClient.invalidateQueries({ queryKey: PAYMENT_REFUND_KEY })
      queryClient.invalidateQueries({ queryKey: OTHER_LEDGER_DETAILS_BATCH_KEY })
    },
  })
}

export function useCreateRefund() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ applicationGuid, input }: { applicationGuid: string; input: CreateRefundInput }) =>
      createRefund(applicationGuid, input),
    onSuccess: (_result, { applicationGuid }) => {
      // This application's refund history and ledger picker (a just-refunded
      // ledger should no longer be offered) are both now stale.
      queryClient.invalidateQueries({ queryKey: [...REFUNDS_BY_APPLICATION_KEY, applicationGuid] })
      queryClient.invalidateQueries({ queryKey: [...LEDGER_OPTIONS_KEY, applicationGuid] })
      queryClient.invalidateQueries({ queryKey: PAYMENT_REFUND_KEY })
    },
  })
}

export type {
  BulkRefundLineInput,
  BulkRefundLineResultDto,
  CreateRefundInput,
  LedgerOptionDto,
  PaymentRefundDto,
  PaymentRefundListParams,
  PaymentRefundListResponse,
  RefundDto,
  RefundLedgerLineDto,
  RefundResultDto,
  TotalPaidDto,
} from '@/lib/api/finance/paymentRefund'
