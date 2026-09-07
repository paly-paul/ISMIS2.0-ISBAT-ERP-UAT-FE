import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via get-payment-others.md (repo root) — the dedicated "other fee"
// payment ledger (GET /api/v1/finance/other-payment, paged, filterable by
// studentGuid/applicationGuid — moved here from /payment-others on
// 2026-09-05, per the doc's changelog). Distinct from paymentConsole.ts's own PaymentOtherResult
// (the POST .../payment-other create response) and PaymentHistoryEntry (the
// cross-category .../payment-history/{applicationGuid} list Payment
// Console's own left-column history card used to show unfiltered — every
// category, not just Other — whenever the Other Payment tab was active).
// This is what that card now calls instead once that tab is active, so it
// only ever lists this application's Other-category payments.
export interface PaymentOtherDto {
  paymentOtherGuid: string
  paymentCode: string
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currency: { currencyGuid: string; currencyCode: string; currencyName: string }
  // Null when funded from an advance deposit (see `advance` below) — no new
  // receipt is issued in that case, per the doc.
  receipt: string | null
  remarks: string | null
  payDate: string
  payType: number
  intakeGuid: string | null
  bank: { bankGuid: string; shortCode: string; bankName: string } | null
  // PaymentAdvanceType: 1 means this payment drew down an advance deposit
  // (get-payment-advances.md) rather than fresh cash — such rows can't be
  // edited directly (PUT /api/v1/finance/other-payment/{guid} rejects them).
  advance: number
  ledger: { ledgerGuid: string; ledgerCode: string; ledgerName: string } | null
  // Raw PaymentGroupCategory byte (1 Tuition/2 Other/3 Nche/4 Guild) — only
  // set when this row was created as part of a unified payment. Nullable;
  // every row from THIS endpoint is Other regardless of whether it's set.
  paymentCategory: number | null
}

export interface PaymentOtherListResponse {
  items: PaymentOtherDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface PaymentOtherListParams {
  page?: number
  pageSize?: number
  studentGuid?: string | null
  applicationGuid?: string | null
}

export function getPaymentOthers(params: PaymentOtherListParams): Promise<PaymentOtherListResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.studentGuid) qs.set('studentGuid', params.studentGuid)
  if (params.applicationGuid) qs.set('applicationGuid', params.applicationGuid)
  return apiGet<PaymentOtherListResponse | null>(`/api/v1/finance/other-payment?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}
