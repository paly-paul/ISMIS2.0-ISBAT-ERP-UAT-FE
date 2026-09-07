import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRefund,
  getLedgerOptions,
  getPaymentRefunds,
  getRefundsByApplication,
  getTotalPaid,
  CreateRefundInput,
  PaymentRefundListParams,
} from '@/lib/api/finance/paymentRefund'

const PAYMENT_REFUND_KEY = ['payment-refunds']
const LEDGER_OPTIONS_KEY = ['refund-ledger-options']
const TOTAL_PAID_KEY = ['refund-total-paid']
const REFUNDS_BY_APPLICATION_KEY = ['refunds-by-application']

// The ledger picker — enabled once an application is selected.
export function useLedgerOptions(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...LEDGER_OPTIONS_KEY, applicationGuid],
    queryFn: () => getLedgerOptions(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
  })
}

// Shown once a ledger is picked, before submitting — same total-paid figure
// the create endpoint validates against.
export function useTotalPaid(applicationGuid: string | null, ledgerGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...TOTAL_PAID_KEY, applicationGuid, ledgerGuid],
    queryFn: () => getTotalPaid(applicationGuid as string, ledgerGuid as string),
    enabled: enabled && !!applicationGuid && !!ledgerGuid,
  })
}

// This application's own refund history (unpaged — at most one row per
// ledger, ever) — backs the refund page's own "Refund Details" table.
export function useRefundsByApplication(applicationGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUNDS_BY_APPLICATION_KEY, applicationGuid],
    queryFn: () => getRefundsByApplication(applicationGuid as string),
    enabled: enabled && !!applicationGuid,
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
  CreateRefundInput,
  LedgerOptionDto,
  PaymentRefundDto,
  PaymentRefundListParams,
  PaymentRefundListResponse,
  RefundDto,
  RefundResultDto,
  TotalPaidDto,
} from '@/lib/api/finance/paymentRefund'
