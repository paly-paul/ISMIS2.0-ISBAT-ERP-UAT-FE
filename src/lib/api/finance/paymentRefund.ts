import { apiGet, apiPost, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Rebuilt 2026-09-05 against the refund/ doc set (repo root) — the whole
// model changed from "refund a specific tuition payment" to "refund a
// (applicationGuid, ledgerGuid) pair", ported 1:1 from the legacy
// T_InsertPaymentConsole_Refund stored procedure (see post-refund.md's
// business-rules table, bugs included). A refund here is a standalone
// record: it does NOT reverse any ledger line, and an application can be
// refunded at most once per ledger, ever — a second attempt against the
// same (applicationGuid, ledgerGuid) is always rejected regardless of the
// first refund's amount.

// ─── GET /refund/ledger-options/{applicationGuid} ───────────────────────
// The ledger picker — ledgers this application has actually paid into.
export interface LedgerOptionDto {
  ledgerGuid: string
  ledgerName: string
}

export function getLedgerOptions(applicationGuid: string): Promise<LedgerOptionDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<LedgerOptionDto[] | null>(`/api/v1/finance/refund/ledger-options/${applicationGuid}`)
    .then(data => data ?? [])
    // 404 "No paid ledgers found for this application." is the normal shape
    // for an application with nothing to refund — same
    // genuinely-empty-result-as-404 pattern as paymentConsole.ts's own
    // outstanding-ledgers/payment-history calls: treat it as an empty list,
    // not a query error.
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// ─── GET /refund/total-paid ──────────────────────────────────────────────
// Shown once a ledger is picked, before submitting — the exact number the
// create endpoint validates the refund amount against, so it can never
// drift from what a submit will actually enforce.
export interface TotalPaidDto {
  amount: number
  currencyGuid: string
  currencyName: string
}

export function getTotalPaid(applicationGuid: string, ledgerGuid: string): Promise<TotalPaidDto | null> {
  if (MOCK_AUTH) return Promise.resolve(null)
  const qs = new URLSearchParams({ applicationGuid, ledgerGuid })
  return apiGet<TotalPaidDto | null>(`/api/v1/finance/refund/total-paid?${qs.toString()}`)
    // 404 here ("Ledger not found." / "No payments found…") is a real
    // "there's nothing to show" case, not a shape mismatch — null lets the
    // form render "—" rather than blocking on an error box.
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return null
      throw err
    })
}

// ─── POST /refund/applications/{applicationGuid} ─────────────────────────
export interface CreateRefundInput {
  ledgerGuid: string
  currencyGuid: string
  amount: number
  refundDate: string
  studentGuid: string | null
  remarks: string | null
}

// Response is just the new refund's guid now — no more paymentGuid/
// paymentCode/receipt/remainingRefundableBalance (those only made sense
// when a refund reversed a specific payment's ledger line, which it no
// longer does).
export interface RefundResultDto {
  refundGuid: string
}

export function createRefund(applicationGuid: string, input: CreateRefundInput): Promise<RefundResultDto> {
  if (MOCK_AUTH) return Promise.resolve({ refundGuid: `mock-refund-${Date.now()}` })
  return apiPost<RefundResultDto>(`/api/v1/finance/refund/applications/${applicationGuid}`, input)
}

// ─── GET /refund/by-application/{applicationGuid} ────────────────────────
// Every refund issued against one application, across every ledger it was
// ever refunded on — unpaged, since at most one row exists per distinct
// ledger. This is what the refund page's own "Refund Details" history
// table uses now, in place of the cross-application paged list below.
export interface RefundDto {
  refundGuid: string
  refundDate: string
  amount: number
  currencyGuid: string
  currencyName: string
  ledgerGuid: string
  ledgerName: string
  remarks: string | null
}

export function getRefundsByApplication(applicationGuid: string): Promise<RefundDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<RefundDto[] | null>(`/api/v1/finance/refund/by-application/${applicationGuid}`)
    .then(data => data ?? [])
    // 404 "No refunds found for this application." is the usual case, not
    // an error — per the doc, treat it as "no refunds".
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// ─── GET /refund/payments ─────────────────────────────────────────────────
// The cross-application, paged refund ledger — moved from
// /payment-refunds to /refund/payments on 2026-09-05 (API ID unchanged).
// `PaymentRefundDto` no longer carries a `payment` field: refunds aren't
// linked to any specific payment any more, only to
// (applicationGuid, ledgerGuid). Not used by the refund page itself
// (which scopes to one application via getRefundsByApplication above) —
// kept for any future cross-application refunds report.
export interface PaymentRefundDto {
  refundGuid: string
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currency: { currencyGuid: string; currencyCode: string; currencyName: string }
  refundDate: string
  ledger: { ledgerGuid: string; ledgerCode: string; ledgerName: string }
  remarks: string | null
}

export interface PaymentRefundListResponse {
  items: PaymentRefundDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface PaymentRefundListParams {
  page?: number
  pageSize?: number
  studentGuid?: string | null
  applicationGuid?: string | null
}

export function getPaymentRefunds(params: PaymentRefundListParams): Promise<PaymentRefundListResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.studentGuid) qs.set('studentGuid', params.studentGuid)
  if (params.applicationGuid) qs.set('applicationGuid', params.applicationGuid)
  return apiGet<PaymentRefundListResponse | null>(`/api/v1/finance/refund/payments?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}
