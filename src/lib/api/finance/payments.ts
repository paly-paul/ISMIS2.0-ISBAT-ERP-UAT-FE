import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// This whole file is the "seven sibling list endpoints" family documented in
// payment-console/get-payments.md — unfiltered back-office/reconciliation
// views (no student filter, no date filter), explicitly NOT the way to show
// one student's payments (that's paymentConsole.ts's getPaymentHistory) or a
// searchable receipt register (paymentConsole.ts's getPaymentHistoryList).
// Every endpoint here takes only page/pageSize and returns a
// PagedResult<T> — no per-endpoint validation, no filters, defaults
// page=1/pageSize=10.

interface CurrencyRef { currencyGuid: string; currencyCode: string; currencyName: string }
interface BankRef { bankGuid: string; shortCode: string; bankName: string }
interface PaymentRef { paymentGuid: string; paymentCode: string }
interface LedgerRef { ledgerGuid: string; ledgerCode: string; ledgerName: string }
interface DiscountRef { discountGuid: string; discountCode: string; discountName: string }

interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

function emptyPage<T>(page: number, pageSize: number): PagedResult<T> {
  return { items: [], totalCount: 0, pageNumber: page, pageSize }
}

// Confirmed via payment-console/get-payments.md.
export interface Payment {
  paymentGuid: string
  paymentCode: string
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currency: CurrencyRef | null
  receipt: string | null
  remarks: string | null
  payDate: string
  payType: number
  intakeGuid: string | null
  bank: BankRef | null
  iStatus: number
  advance: number
  bankReconcile: number | null
}

// applicationGuid/studentGuid confirmed as optional filters on this same
// endpoint (get-payments.md) — same "either can be used independently"
// convention as getPaymentAdvances below. Used to answer "is THIS payment
// advance-funded" for a specific application, since the fee-line history
// views (getPaymentHistory/getPaymentHistoryList) carry no `advance` field
// at all — this raw list is the only place that flag lives.
export function getPayments(page = 1, pageSize = 10, applicationGuid?: string | null, studentGuid?: string | null): Promise<PagedResult<Payment>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (applicationGuid) qs.set('applicationGuid', applicationGuid)
  if (studentGuid) qs.set('studentGuid', studentGuid)
  // Route moved from /payments to /payment-console/payments on 2026-09-05
  // (get-payments.md's changelog) — the read endpoint now sits in the
  // payment-console route group next to the tuition create/update
  // endpoints. API ID unchanged.
  return apiGet<PagedResult<Payment> | null>(`/api/v1/finance/payment-console/payments?${qs.toString()}`)
    .then(data => data ?? emptyPage(page, pageSize))
}

// Confirmed via payment-console/get-payment-advances.md — this is the list
// endpoint that was missing when /finance/advanced-payments was first
// looked at (only per-application balance existed then, via
// paymentConsole.ts's getAdvanceBalance-shaped endpoint, never wired up).
// `balance` is what's still undrawn; `baseAmount`/`baseCurrency` are frozen
// at creation, not live-converted.
export interface PaymentAdvance {
  paymentAdvanceGuid: string
  advPaymentCode: string
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currency: CurrencyRef | null
  receipt: string | null
  payDate: string
  remarks: string | null
  payType: number
  intakeGuid: string | null
  bank: BankRef | null
  balance: number
  baseCurrency: CurrencyRef | null
  baseAmount: number
}

// studentGuid confirmed as an optional filter on this same endpoint
// (get-payment-advances.md, 2026-09-01 revision) — narrows the unfiltered
// list to one student's own deposits; omitting it keeps the original
// unfiltered-across-all-students behavior the Advanced Payments console
// page still wants. The doc also documents an independent applicationGuid
// filter, not used here — this app only ever has a studentGuid on hand by
// the time it wants to scope this list.
export function getPaymentAdvances(page = 1, pageSize = 10, studentGuid?: string | null): Promise<PagedResult<PaymentAdvance>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (studentGuid) qs.set('studentGuid', studentGuid)
  // Route moved from /payment-advances to /advance-payment on 2026-09-05
  // (get-payment-advances.md's changelog) — the list now sits at the
  // advance-payment group root, alongside POST /advance-payment. API ID
  // unchanged.
  return apiGet<PagedResult<PaymentAdvance> | null>(`/api/v1/finance/advance-payment?${qs.toString()}`)
    .then(data => data ?? emptyPage(page, pageSize))
}

// Confirmed via guild/get-payment-guilds.md — no currency/pay-type columns
// on this table at all (not just nullable — genuinely absent), unlike
// Payment/PaymentAdvance/PaymentOther above. studentName/intakeCode are
// pre-resolved here (and on guild/get-payment-history.md's own rows) —
// NCHE's equivalent list carries neither.
export interface PaymentGuild {
  paymentGuildGuid: string
  applicationGuid: string
  studentGuid: string | null
  studentName: string | null
  intakeGuid: string | null
  intakeCode: number | null
  payDate: string
  bankDeposit: string | null
  receipt: string | null
  amount: number
}

export function getPaymentGuilds(page = 1, pageSize = 10): Promise<PagedResult<PaymentGuild>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  // Route moved from /payment-guilds to /guild/payment-guilds on
  // 2026-09-05 (get-payment-guilds.md's changelog) — the read endpoint
  // now sits in the Guild route group with the create/update/delete
  // endpoints. API ID unchanged. Unlike NCHE's sibling list, this doc
  // documents no studentGuid filter — stays unfiltered.
  return apiGet<PagedResult<PaymentGuild> | null>(`/api/v1/finance/guild/payment-guilds?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? emptyPage(page, pageSize))
}

// Confirmed via payment-console/get-payment-ledgers.md — allocation lines,
// the join between a tuition payment and the ledgers it settled. Several
// rows per tuition payment is normal (oldest-first allocation).
export interface PaymentLedger {
  paymentLedgerGuid: string
  payment: PaymentRef | null
  ledger: LedgerRef | null
  amount: number
  currency: CurrencyRef | null
  amtDef: number
  semesterGuid: string | null
  discount: DiscountRef | null
}

export function getPaymentLedgers(page = 1, pageSize = 10): Promise<PagedResult<PaymentLedger>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  return apiGet<PagedResult<PaymentLedger> | null>(`/api/v1/finance/payment-ledgers?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? emptyPage(page, pageSize))
}

// Confirmed via payment-console/get-payment-nches.md — same "no
// currency/pay-type column" shape as PaymentGuild above.
export interface PaymentNche {
  paymentNcheGuid: string
  applicationGuid: string
  studentGuid: string | null
  intakeGuid: string | null
  payDate: string
  pnrNumber: string | null
  amount: number
  remarks: string | null
}

// studentGuid confirmed as an optional filter (nche/get-payment-nches.md).
export function getPaymentNches(page = 1, pageSize = 10, studentGuid?: string | null): Promise<PagedResult<PaymentNche>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (studentGuid) qs.set('studentGuid', studentGuid)
  // Route moved from /payment-nches to /nche/payments on 2026-09-05
  // (get-payment-nches.md's changelog) — the read endpoint now sits in the
  // NCHE route group with the create/update/delete endpoints. API ID
  // unchanged.
  return apiGet<PagedResult<PaymentNche> | null>(`/api/v1/finance/nche/payments?${qs.toString()}`)
    .then(data => data ?? emptyPage(page, pageSize))
}

// Confirmed via payment-console/get-payment-others.md. `advance: 1` means
// funded from an advance deposit — receipt/bank are null in that case
// (no new receipt claimed).
export interface PaymentOther {
  paymentOtherGuid: string
  paymentCode: string
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currency: CurrencyRef | null
  receipt: string | null
  remarks: string | null
  payDate: string
  payType: number
  intakeGuid: string | null
  bank: BankRef | null
  advance: number
  ledger: LedgerRef | null
  paymentCategory: number | null
}

export function getPaymentOthers(page = 1, pageSize = 10): Promise<PagedResult<PaymentOther>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  return apiGet<PagedResult<PaymentOther> | null>(`/api/v1/finance/payment-others?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? emptyPage(page, pageSize))
}

// Confirmed via payment-console/get-payment-refunds.md — issued against a
// single allocation line (ledger), never split across several.
export interface PaymentRefund {
  refundGuid: string
  payment: PaymentRef | null
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currency: CurrencyRef | null
  refundDate: string
  ledger: LedgerRef | null
  remarks: string | null
}

export function getPaymentRefunds(page = 1, pageSize = 10): Promise<PagedResult<PaymentRefund>> {
  if (MOCK_AUTH) return Promise.resolve(emptyPage(page, pageSize))
  return apiGet<PagedResult<PaymentRefund> | null>(`/api/v1/finance/payment-refunds?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? emptyPage(page, pageSize))
}
