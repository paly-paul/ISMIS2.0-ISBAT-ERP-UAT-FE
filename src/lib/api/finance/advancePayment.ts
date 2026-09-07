import { apiGet, apiPost, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via the payment-adjust/ doc set (repo root, 2026-09-05) — the
// "apply an advance deposit to outstanding tuition" flow, ported 1:1 from
// the legacy frmTrnPaymentAdjustment / T_InsertPaymentAdjustments_Advance
// screen+procedure. Distinct from paymentConsole.ts's own createAdvanceDeposit
// (that only ever *creates* a deposit) and from payments.ts's
// getPaymentAdvances (the cross-student, unfiltered back-office list) — this
// file is the per-application "what can I draw from, and what have I already
// drawn" pair plus the draw-down itself.

// ─── GET /advance-payment/deposits/{applicationGuid} ─────────────────────
// This application's own deposits that still have money left — the "pay
// from advance" picker. Fully-drawn deposits are excluded server-side and
// can never reappear (nothing ever credits a deposit back).
export interface AdvanceDepositSummary {
  paymentAdvanceGuid: string
  advPaymentCode: string
  receipt: string
  payDate: string
  originalAmount: number
  balance: number
  currencyGuid: string
  currencyCode: string
  currencyName: string
}

export function getAdvanceDeposits(applicationGuid: string): Promise<AdvanceDepositSummary[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  // Empty result is a normal 200 with an empty array here, not a 404 (per
  // the doc) — no not_found fallback needed, unlike getAdvanceBalance below.
  return apiGet<AdvanceDepositSummary[] | null>(`/api/v1/finance/advance-payment/deposits/${applicationGuid}`)
    .then(data => data ?? [])
}

// ─── GET /advance-payment/balance/{applicationGuid} ──────────────────────
// The student's undrawn total, broken down by currency — informational
// only (it carries no paymentAdvanceGuid, so it can't drive a picker on its
// own; see getAdvanceDeposits above for that).
export interface AdvanceBalanceDto {
  currencyGuid: string
  currencyName: string
  balance: number
}

export function getAdvanceBalance(applicationGuid: string): Promise<AdvanceBalanceDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<AdvanceBalanceDto[] | null>(`/api/v1/finance/advance-payment/balance/${applicationGuid}`)
    .then(data => data ?? [])
    // 404 "No advance balance found." is the common case (no advances, or
    // all fully drawn) — per the doc, treat it as "zero available", not an
    // error.
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// ─── POST /advance-payment/{paymentAdvanceGuid}/adjustments ──────────────
export interface CreateAdjustmentInput {
  amount: number
  currencyGuid: string
  adjustmentDate: string
  remarks: string | null
}

export interface AdjustmentResultDto {
  adjustmentGuid: string
  adjustmentCode: string | null
  paymentGuid: string
  paymentCode: string
  receipt: string
  adjustedAmount: number
  remainingAdvanceBalance: number
  // Non-null when part of the requested amount couldn't be applied and was
  // booked as a new advance instead — the full requested amount is always
  // withdrawn from the funding deposit regardless (see the doc).
  newAdvanceMessage: string | null
}

export function createAdjustment(paymentAdvanceGuid: string, input: CreateAdjustmentInput): Promise<AdjustmentResultDto> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      adjustmentGuid: `mock-adjustment-${Date.now()}`,
      adjustmentCode: `ADJ-MOCK-${Date.now()}`,
      paymentGuid: `mock-payment-${Date.now()}`,
      paymentCode: 'PAY-MOCK-0000',
      receipt: 'RCP-MOCK-0000',
      adjustedAmount: input.amount,
      remainingAdvanceBalance: 0,
      newAdvanceMessage: null,
    })
  }
  return apiPost<AdjustmentResultDto>(`/api/v1/finance/advance-payment/${paymentAdvanceGuid}/adjustments`, input)
}

// ─── GET /advance-payment/{paymentAdvanceGuid}/adjustments ───────────────
// Every adjustment made against one advance deposit, newest-relevant first.
export interface AdjustmentSummaryDto {
  adjustmentGuid: string
  adjustmentCode: string | null
  adjustmentDate: string
  adjustedAmount: number
  currencyGuid: string | null
  currencyName: string | null
  receipt: string
}

export function getAdjustmentsByAdvance(paymentAdvanceGuid: string): Promise<AdjustmentSummaryDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<AdjustmentSummaryDto[] | null>(`/api/v1/finance/advance-payment/${paymentAdvanceGuid}/adjustments`)
    .then(data => data ?? [])
    // 404 "No adjustments found for this advance deposit." is the normal
    // state for a deposit only ever drawn via an other-payment, not
    // through this adjustment flow — per the doc, treat it as "none yet".
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// ─── GET /advance-payment/adjustments/{adjustmentGuid}/ledgers ───────────
// The ledger allocation lines one adjustment produced — the detail view
// behind one row of getAdjustmentsByAdvance above.
export interface AdjustmentLedgerDto {
  ledgerGuid: string
  ledgerName: string
  semesterGuid: string | null
  semName: string | null
  amount: number
  currencyGuid: string
  currencyName: string
  amtDef: number
  discountGuid: string | null
  discountName: string | null
  isDiscountLine: boolean
  isRoundingLine: boolean
}

export function getAdjustmentLedgerBreakdown(adjustmentGuid: string): Promise<AdjustmentLedgerDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<AdjustmentLedgerDto[] | null>(`/api/v1/finance/advance-payment/adjustments/${adjustmentGuid}/ledgers`)
    .then(data => data ?? [])
    // 404 covers both "Adjustment not found." and "No ledger breakdown
    // found for this adjustment." — same genuinely-empty-as-404 treatment
    // as the rest of this file; an adjustment that produced no rows (it
    // shouldn't per the create endpoint's own validation, but the read side
    // doesn't need to assume that) just shows an empty breakdown.
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}
