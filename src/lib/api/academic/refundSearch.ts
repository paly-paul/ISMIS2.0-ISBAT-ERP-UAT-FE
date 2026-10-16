import { apiGet, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Payment Console → Refund page's three refund-eligibility search
// tabs (2026-09-15, per the refund-search API set). Ledger/payment detail is
// intentionally not embedded in the Rejected/Fake-Certificate responses —
// fetch it separately per selected application from finance-service's
// getLedgerDetailsBatch (src/lib/api/finance/paymentRefund.ts). The
// Passout/Library Deposit search is the one exception: it embeds ledgers
// directly, merged server-side from both payment sources.

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface RefundSearchParams {
  search?: string
  page?: number
  pageSize?: number
}

// ─── GET /admissions/refund-search/rejected-applications ─────────────────
// Category 1 — applications rejected by the registrar (Action =
// RejectedByRegistrar). studentGuid is null for most rows — a rejected
// application usually never went on to register a student.
export interface RejectedApplicationRefundCandidateDto {
  applicationGuid: string
  studentGuid: string | null
  appRefNo: string
  applicantName: string
  email: string | null
  phone: string | null
}

export function searchRejectedApplications(params: RefundSearchParams): Promise<PagedResult<RejectedApplicationRefundCandidateDto>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.search?.trim()) qs.set('search', params.search.trim())
  return apiGet<PagedResult<RejectedApplicationRefundCandidateDto> | null>(`/api/v1/admissions/refund-search/rejected-applications?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// ─── GET /students/refund-search/passout-library-deposit ─────────────────
// Category 2 — students with RegStatus = Passout, eligible for a Library
// Deposit refund. Per the 2026-09-23 frontend integration guide (backend
// fix for the "Ledger not found." bug — see PassoutLibraryDepositTab's own
// comment): a student's Library Deposit can sit in either/both of two
// genuinely different backend sources, kept as two separate arrays rather
// than merged into one — mainLedgerLines (T_PAYMENT_LEDGER, refund with
// `ledgerGuid`) and otherLedgerLines (T_PAYMENT_OTHER_LEDGER, refund with
// `ledgerOthersGuid`). Never flatten these back into one array — which
// array a line came from is the only way to know which request field to
// populate, and getting that backwards is exactly what caused every refund
// to fail with "Ledger not found." before this fix.
export interface PassoutLedgerLineDto {
  ledgerGuid: string
  ledgerName: string
  currencyGuid: string
  currencyCode: string
  amount: number
  convertedAmount: number | null
  exchangeRateMissing: boolean
  payDate: string
  receipt: string
  receiptBookCode: string
}

export interface PassoutLibraryDepositRefundCandidateDto {
  studentGuid: string
  // Nullable — a passout student with no linked application can't be
  // refunded on either ledger (the refund endpoint requires applicationGuid
  // in the path even for otherLedgerLines). Callers must disable the refund
  // action when this is null.
  applicationGuid: string | null
  studentRegNo: string
  studentNum: string
  studentName: string
  programGuid: string | null
  programName: string | null
  batchGuid: string | null
  batchCode: string | null
  campusGuid: string | null
  campusName: string | null
  intakeGuid: string | null
  // Nullable/possibly-missing on a live response as of 2026-09-23, despite
  // the integration guide documenting them as always-present arrays —
  // callers must guard with `?? []`.
  mainLedgerLines: PassoutLedgerLineDto[] | null | undefined
  otherLedgerLines: PassoutLedgerLineDto[] | null | undefined
}

export interface PassoutLibraryDepositSearchParams extends RefundSearchParams {
  intakeGuid?: string
  programGuid?: string
  batchGuid?: string
  campusGuid?: string
}

export function searchPassoutLibraryDeposit(params: PassoutLibraryDepositSearchParams): Promise<PagedResult<PassoutLibraryDepositRefundCandidateDto>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.search?.trim()) qs.set('search', params.search.trim())
  if (params.intakeGuid) qs.set('intakeGuid', params.intakeGuid)
  if (params.programGuid) qs.set('programGuid', params.programGuid)
  if (params.batchGuid) qs.set('batchGuid', params.batchGuid)
  if (params.campusGuid) qs.set('campusGuid', params.campusGuid)
  return apiGet<PagedResult<PassoutLibraryDepositRefundCandidateDto> | null>(`/api/v1/students/refund-search/passout-library-deposit?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// ─── GET /students/refund-search/passout-library-deposit/{studentGuid} ───
// Single-student detail view for Flow 2 (click a row → detail) — same shape
// as one search row. 404 when the student doesn't exist or isn't currently
// Passout status; treated as "not found" rather than an error, same pattern
// used elsewhere in this file's sibling endpoints.
export function getPassoutLibraryDepositByStudent(studentGuid: string): Promise<PassoutLibraryDepositRefundCandidateDto | null> {
  if (MOCK_AUTH) return Promise.resolve(null)
  return apiGet<PassoutLibraryDepositRefundCandidateDto>(`/api/v1/students/refund-search/passout-library-deposit/${studentGuid}`)
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return null
      throw err
    })
}

// ─── GET /students/refund-search/fake-certificate-terminations ───────────
// Category 3 — students terminated mid-program with reason "Fake
// Certificate" (POST /students/{studentGuid}/terminate). Now returns
// applicationGuid directly (2026-09-24 — same fix already shipped for the
// Passout/Library Deposit search) rather than requiring the fragile
// getStudentByGuid(studentGuid) fallback this DTO used to need: that
// resolver's applicationSummary.applicationGuid was intermittently missing
// on a live response, which is exactly what broke this tab before this
// field was added. Kept nullable — undocumented whether every terminated
// student has a linked application — callers must still guard for null.
export interface TerminatedStudentRefundCandidateDto {
  studentGuid: string
  applicationGuid: string | null
  studentRegNo: string
  studentNum: string
  studentName: string
  programGuid: string | null
  programName: string | null
  batchGuid: string | null
  batchCode: string | null
  terminationRemarks: string | null
}

export function searchFakeCertificateTerminations(params: RefundSearchParams): Promise<PagedResult<TerminatedStudentRefundCandidateDto>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.search?.trim()) qs.set('search', params.search.trim())
  return apiGet<PagedResult<TerminatedStudentRefundCandidateDto> | null>(`/api/v1/students/refund-search/fake-certificate-terminations?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}
