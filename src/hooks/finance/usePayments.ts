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

// All seven of these are unfiltered back-office list views (no student/date
// filter — see get-payments.md) — never treat the cached page as stale on
// its own, only refetch on remount/page change, same "load it, don't keep
// refiring" convention as most read-only list hooks elsewhere in this app.
export function usePayments(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'list', page, pageSize],
    queryFn: () => getPayments(page, pageSize),
  })
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

export function usePaymentNches(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'nches', page, pageSize],
    queryFn: () => getPaymentNches(page, pageSize),
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
