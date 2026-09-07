import { useQuery } from '@tanstack/react-query'
import {
  getPayments,
  getPaymentAdvances,
  getPaymentGuilds,
  getPaymentLedgers,
  getPaymentNches,
  getPaymentOthers,
  getPaymentRefunds,
} from '@/lib/api/finance/payments'

const PAYMENTS_KEY = ['payments']

// Unfiltered by default (no student/date filter — see get-payments.md),
// same "load it, don't keep refiring" convention as most read-only list
// hooks elsewhere in this app — never treat the cached page as stale on its
// own, only refetch on remount/page change. applicationGuid/studentGuid are
// optional per the doc; passed by useAdvanceStatusByPayment below to scope
// this to one application instead of the whole back-office table.
export function usePayments(page: number, pageSize: number, enabled = true, applicationGuid?: string | null, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'list', page, pageSize, applicationGuid ?? null, studentGuid ?? null],
    queryFn: () => getPayments(page, pageSize, applicationGuid, studentGuid),
    enabled,
  })
}

// Answers "is this payment advance-funded" for a specific application —
// the fee-line history views (getPaymentHistory/getPaymentHistoryList) that
// back Payment Console's and Payment History's own tables carry no
// `advance` field at all (see get-payments.md's own note: those are
// deliberately NOT the raw table), so this raw list is the only place that
// flag lives. pageSize 200 covers realistic single-application payment
// counts in one request — this is a lookup map, not a paged UI.
export function useAdvanceStatusByPayment(applicationGuid: string | null, enabled: boolean) {
  const { data } = usePayments(1, 200, enabled && !!applicationGuid, applicationGuid)
  const items = data?.items ?? []
  return new Map(items.map(p => [p.paymentGuid, p.advance === 1]))
}

// enabled defaults to true (the advanced-payments console page's own usage,
// always visible, unfiltered — no studentGuid passed) — the Other Payment
// tab's Advance Payment picker modal (AdvanceDepositPickerModal) passes
// false until it's actually open, plus studentGuid (per
// get-payment-advances.md's own optional filter) to scope the list to just
// the currently-selected student instead of every deposit in the system.
export function usePaymentAdvances(page: number, pageSize: number, enabled = true, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'advances', page, pageSize, studentGuid ?? null],
    queryFn: () => getPaymentAdvances(page, pageSize, studentGuid),
    enabled,
  })
}

export function usePaymentGuilds(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'guilds', page, pageSize],
    queryFn: () => getPaymentGuilds(page, pageSize),
  })
}

export function usePaymentLedgers(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'ledgers', page, pageSize],
    queryFn: () => getPaymentLedgers(page, pageSize),
  })
}

export function usePaymentNches(page: number, pageSize: number, enabled = true, studentGuid?: string | null) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'nches', page, pageSize, studentGuid ?? null],
    queryFn: () => getPaymentNches(page, pageSize, studentGuid),
    enabled,
  })
}

export function usePaymentOthers(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'others', page, pageSize],
    queryFn: () => getPaymentOthers(page, pageSize),
  })
}

export function usePaymentRefunds(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'refunds', page, pageSize],
    queryFn: () => getPaymentRefunds(page, pageSize),
  })
}

export type {
  Payment,
  PaymentAdvance,
  PaymentGuild,
  PaymentLedger,
  PaymentNche,
  PaymentOther,
  PaymentRefund,
} from '@/lib/api/finance/payments'
