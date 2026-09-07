import { apiGet, apiPost, apiPut, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Read-side of the Payment Console spec (Payment-Console/*.bru at repo
// root) — search/profile/ledgers/history only. Create/Update/Refund/
// Advance-Deposit endpoints are documented in that folder too but
// intentionally not wired here yet; /finance/payment-console's "Record
// Payment" step still fabricates its receipt locally.

// Confirmed via PaymentConsoleStudentSearch.bru — FinanceStudentSearchDto.
// Replaces the earlier ApplicationSummary shape (applicationGuid/appRefNo/
// firstName/lastName/phone/emailId/programGuid/action) that matched the
// Finance-side proxy endpoint this used to call: this DTO has no lastName/
// programGuid/action, but carries studentGuid and a pre-combined studentName
// up front — no separate profile fetch needed just to learn the display
// name or (for an already-enrolled applicant) the studentGuid.
export interface ApplicationSummary {
  applicationGuid: string
  studentGuid: string | null
  studentName: string | null
  firstName: string | null
  appRefNo: string
  emailId: string | null
  phone: string | null
}

interface ApplicationSummaryListResponse {
  items: ApplicationSummary[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Confirmed via payment-console/get-student-profile.md plus a real live
// response — the live DTO carries more than the spec's own sample shows.
// The docs mention the response also carries "any active discount
// assignments" but give no field name/shape for it — still omitted here
// rather than guessing.
export interface StudentProfile {
  applicationGuid: string
  appRefNo: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  emailId: string | null
  intakeCode: string | null
  yearCode: string | null
  intakeGuid: string | null
  campusGuid: string | null
  programGuid: string | null
  semesterGuid: string | null
  feeHdGuid: string | null
  batchGuid: string | null
  refugee: number | null
  refugeeId: string | null
  studCategory: number | null
  gender: number | null
  action: number | null
  universityEmail: string | null
  // Confirmed via a real live student-profile response — not in the .md
  // spec's own sample. studentGuid is the one that matters functionally:
  // it's the studentGuid outstanding-ledgers/payable-ledgers/createPayment
  // all optionally accept (see get-outstanding-ledgers.md,
  // get-payable-ledgers.md) — null until the application becomes an
  // enrolled student, same lifecycle as studentRegNo/studentNum below.
  studentGuid: string | null
  studentRegNo: string | null
  studentNum: string | null
  studentName: string | null
  // Pre-resolved display names, server-side — prefer these over the
  // client-side GUID lookups (useProgramMasters/useBatches/
  // useSemestersForProgram) the page falls back to when a field here comes
  // back null, which a live sample confirms it can (programName, batchCode
  // and semesterName were all null on an application with a fee structure
  // and program level otherwise fully resolved).
  programCode: string | null
  programName: string | null
  programLevelGuid: string | null
  levelCode: string | null
  levelName: string | null
  semesterName: string | null
  batchCode: string | null
  batchIntakeCode: string | null
  feeCode: string | null
  intType: string | null
  admissionTypeLabel: string | null
  // Type genuinely unconfirmed — null on every live sample seen so far, no
  // spec coverage, and the name isn't self-explanatory enough to guess a
  // shape for. Left as unknown rather than assuming string; narrow it once
  // a non-null sample turns up.
  ucam: unknown
}

// Confirmed via payment-console/get-outstanding-ledgers.md — tuition-only
// ledger lines for the student's current programme/semester. Unlike the old
// mock's flat Admission/Registration/Tuition/NCHE/Guild list, this endpoint
// has no "priority" or fee-category concept at all — GetAllOutstandingLedgers
// (not wired here) is what covers the other/NCHE/guild categories.
//
// GUID-keyed (ledgerGuid/currencyGuid) per the .md spec, but a real live
// response (an application with no studentGuid yet, billed across its full
// remaining programme — 4 semesters, several repeating ledgerNames like
// "Tuition Fee") carried none of ledgerGuid/semesterGuid/currencyGuid at
// all, only semesterName — so all three GUIDs are kept but marked optional
// rather than assumed always-present, and semesterName is added since it's
// the only thing that disambiguates same-named ledger rows across semesters
// when no studentGuid narrows the billed range (see getOutstandingLedgers'
// own studentGuid comment below).
export interface OutstandingLedger {
  ledgerGuid?: string | null
  semesterGuid?: string | null
  semesterName: string | null
  ledgerName: string
  ledgerNum: number | null
  currencyGuid?: string | null
  currencyName: string
  ledgerAmount: number
  paidAmount: number
  outstanding: number
}

// Confirmed via payment-console/get-payment-history.md — category is
// documented with an explicit int↔label mapping right in the spec (unlike
// most other int-enum fields in this codebase), so PAYMENT_CATEGORY_LABELS
// below is safe, not a guess. payType, however, comes back **pre-resolved**
// as `{ value, name }` (and null for NCHE/guild rows, which have no
// pay-type column) — a correction from an earlier version of this file that
// treated it as a bare number per a since-superseded .bru sample; use
// `payType.name` directly instead of cross-referencing PAY_TYPE_LABELS for
// this endpoint. Likewise currencyGuid, not intCurrency; receiptBookGuid,
// not intReceipt.
export interface PaymentHistoryEntry {
  paymentGuid: string
  category: number
  paymentCode: string
  payDate: string
  amount: number
  currencyGuid: string | null
  currencyName: string
  receipt: string | null
  receiptBookGuid: string | null
  bookCode: string | null
  payType: { value: number; name: string } | null
}

// Confirmed via payment-console/get-payable-ledgers.md — given a tuition
// amount + currency + date, the backend returns how it would actually be
// allocated (discount and rounding lines included, flagged explicitly
// rather than needing to be inferred). currencyGuid here — same GUID as
// CreatePayment's own currencyGuid below, both sourced from the same
// useFinanceCurrencies() record — not intCurrency, which an earlier version
// of this file used per a since-superseded .bru sample; the query is bound
// straight off currencyGuid and rejects an int.
export interface PayableLedgerLine {
  ledgerGuid: string | null
  semesterGuid: string | null
  ledgerName: string
  ledgerNum: number | null
  amount: number
  currencyGuid: string | null
  currencyName: string
  amtDef: number
  isDiscountLine: boolean
  isRoundingLine: boolean
}

export interface PayableLedgersResult {
  lines: PayableLedgerLine[]
  balance: number
}

export interface PayableLedgersParams {
  applicationGuid: string
  studentGuid?: string | null
  amount: number
  currencyGuid: string
  payDate: string
}

// Confirmed via CreatePayment.bru — records a tuition payment, auto-
// allocated server-side against the outstanding ledgers (same allocation
// GetPayableLedgers previews). procBankGuid references the ProcBank master
// (lib/api/finance/procBank.ts, useProcBanks()) — confirmed by the matching
// field name, NOT the plain Bank master (bank.ts) the old mock UI used.
export interface PaymentInput {
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currencyGuid: string
  receiptBookGuid: string
  payDate: string
  payType: number
  procBankGuid: string | null
  remarks: string | null
  // The student is behind on results — POST .../payments (per the Payment
  // Console flow doc) 409s with code `reregistration_required` the first
  // time, carrying an explanation to show the cashier in a confirm dialog.
  // Resubmitting the identical body with this flipped to true overrides
  // that check. Always sent (false on the first attempt), never omitted.
  confirmOverride: boolean
}

export interface PaymentResult {
  paymentGuid: string
  paymentCode: string
  receipt: string
  balance: number
  advanceMessage: string | null
  // Surfaced alongside advanceMessage as a notice, not an error, per the
  // Payment Console flow doc — the reregistration warning the 409 above
  // would have blocked on, now just informational since confirmOverride
  // already cleared it.
  reRegistrationWarning: string | null
}

export const PAYMENT_CATEGORY_LABELS: Record<number, string> = {
  1: 'Tuition',
  2: 'Other',
  3: 'NCHE',
  4: 'Guild',
  5: 'Advance',
}

export const PAY_TYPE_LABELS: Record<number, string> = {
  1: 'Cash',
  2: 'Cheque',
  3: 'Bank',
  4: 'Demand Draft',
  5: 'Online',
}

// Maps payType (1=Cash/2=Cheque/3=Bank/4=DemandDraft/5=Online, per
// CreatePayment.bru) onto ReceiptBook.category (0=Cash/1=Bank, per
// receiptBook.ts's CATEGORY_VALUES) so a Receipt Book dropdown only offers
// books the backend will actually accept for the chosen payment method —
// picking a mismatched pair is otherwise only caught after Save, via a real
// backend validation_error ("Receipt book category does not match the
// selected payment type."). Confirmed via the Payment Console flow doc:
// "category=0 (Cash) for payType: 1, category=1 (Bank) otherwise" — every
// non-cash payType, Online included, takes the Bank category; there is no
// separate Online receipt-book category for this endpoint.
// Shared by both CreatePayment (payment-console/page.tsx) and
// CreateAdvanceDeposit (NewAdvanceDepositModal.tsx) — the same receipt book
// master applies to both.
export const PAY_TYPE_TO_RECEIPT_CATEGORY: Record<number, number> = { 1: 0, 2: 1, 3: 1, 4: 1, 5: 1 }

const mockApplicationSummaries: ApplicationSummary[] = []
const mockStudentProfiles: Record<string, StudentProfile> = {}
const mockOutstandingLedgers: Record<string, OutstandingLedger[]> = {}
const mockPaymentHistory: Record<string, PaymentHistoryEntry[]> = {}
let mockPaymentSeq = 1

// Points straight at the Admissions module's own endpoint per
// PaymentConsoleStudentSearch.bru — the endpoint actually meant for this
// picker, per the backend team. Not the same route as PaymentSearch.bru's
// plain "/payment-search" (get-payment-search.md's ../admission/
// application-filling/payment-search) — that one is a more general
// "applications eligible for payment" search with a different response DTO
// (ApplicationSummary's old firstName/lastName/programGuid/action shape);
// this "/payment-console/search" route is explicitly documented as "for use
// in the Finance Payment Console student picker" and returns
// FinanceStudentSearchDto instead (see ApplicationSummary above).
export function searchStudents(searchTerm: string, pageNumber = 1, pageSize = 20): Promise<ApplicationSummaryListResponse> {
  if (MOCK_AUTH) {
    const items = searchTerm.trim()
      ? mockApplicationSummaries.filter(a => `${a.appRefNo} ${a.firstName} ${a.studentName} ${a.emailId} ${a.phone}`.toLowerCase().includes(searchTerm.toLowerCase()))
      : mockApplicationSummaries
    return Promise.resolve({ items, totalCount: items.length, pageNumber, pageSize })
  }
  return apiGet<ApplicationSummaryListResponse | null>(
    `/api/v1/admissions/application-filling/payment-console/search?searchTerm=${encodeURIComponent(searchTerm)}&pageNumber=${pageNumber}&pageSize=${pageSize}`,
  ).then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// PaymentConsoleStudentProfile.bru — same path already confirmed last turn,
// now also confirmed to take an optional `studentGuid` query param: "omit
// it for an application that hasn't registered as a student yet (no
// StudentGuid exists until the first semester fee is paid); the response
// then falls back to application-only fields." searchStudents() above now
// returns studentGuid directly on each search hit, so callers can pass it
// straight through here instead of only learning it after the profile
// itself has already loaded.
export function getStudentProfile(applicationGuid: string, studentGuid?: string | null): Promise<StudentProfile> {
  if (MOCK_AUTH) {
    const existing = mockStudentProfiles[applicationGuid]
    if (!existing) return Promise.reject(new Error('Application not found'))
    return Promise.resolve(existing)
  }
  const query = studentGuid ? `?studentGuid=${encodeURIComponent(studentGuid)}` : ''
  return apiGet<StudentProfile>(`/api/v1/admissions/application-filling/payment-console/student-profile/${applicationGuid}${query}`)
}

// studentGuid is optional per get-outstanding-ledgers.md, but supplying it
// once the applicant has become a student lets the handler resolve the
// student's real current/registration semester instead of falling back to
// the application's own semester, which can widen or narrow the billed
// range.
export function getOutstandingLedgers(applicationGuid: string, studentGuid?: string | null): Promise<OutstandingLedger[]> {
  if (MOCK_AUTH) return Promise.resolve(mockOutstandingLedgers[applicationGuid] ?? [])
  const qs = studentGuid ? `?studentGuid=${encodeURIComponent(studentGuid)}` : ''
  return apiGet<OutstandingLedger[] | null>(`/api/v1/finance/payment-console/outstanding-ledgers/${applicationGuid}${qs}`)
    .then(data => data ?? [])
    // Confirmed live: an application with no fee structure lines wired up
    // yet returns a 404 `not_found` ("No fee structure lines found.")
    // instead of a 200 with an empty array — a real empty-result case, not
    // a genuine error. Without this, react-query treats it as a query
    // error (retries a few times, then leaves the page stuck on an error
    // state) instead of just showing "no outstanding ledgers".
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// Confirmed via get-current-semester-payable-ledgers.md — same scoping as
// getOutstandingLedgers above (current semester + carried-forward semester-1
// registration fee), but with each ledger's applicable discount already
// computed and unconditionally applied (no proposed amount to check against,
// unlike getPayableLedgers' simulation) — the "what do I owe this semester,
// discount included" figure Step 2's Outstanding Balance card needs, which
// getOutstandingLedgers alone can't show since it carries no discount
// fields at all.
//
// 2026-09-03 backend change: the response used to be a
// CurrentSemesterPayableResultDto wrapper ({ ledgers, totals }) with a
// server-computed per-currency totals[] block. That wrapper and the totals
// block are both gone — the endpoint now returns a flat
// List<CurrentSemesterPayableLedgerDto> (one row per ledger, ordered by
// semester code then ledgerNum) with no totals of any kind; callers sum
// client-side, per currency (see the page's own ledgerTotals useMemo).
// currencyCode and the discount detail fields below (discountCalcType
// through discountWarning) are new in the same change.
export interface CurrentSemesterPayableLedger {
  ledgerGuid: string | null
  semesterGuid: string | null
  ledgerName: string
  ledgerNum: number | null
  currencyGuid: string | null
  currencyCode: string | null
  currencyName: string
  ledgerAmount: number
  paidAmount: number
  outstanding: number
  discountGuid: string | null
  discountName: string | null
  // DiscountCalcType: 1 Amount, 2 Percentage. null when discountGuid is null.
  discountCalcType: number | null
  // The configured flat amount or percentage (paired with discountCalcType
  // above to interpret it) — null when discountGuid is null.
  discountAmtPer: number | null
  // The ledgerNums sharing this ledger's discount group; [] when no
  // discount. Purely informational here — unlike payable-ledgers'
  // simulation, this endpoint doesn't gate the discount on the group being
  // paid in full, it's shown unconditionally regardless of this list.
  discountGroupLedgerNums: number[]
  // This ledger's apportioned share of its discount group's total discount,
  // rounded to 2dp.
  discountAmount: number
  // Display string from the discount formatter, e.g. "TALENT 1-10%: 75.00
  // USD off if this group is paid in full".
  discountMessage: string | null
  // Portion of discountAmount that exceeds this ledger's own outstanding
  // and couldn't be applied to it.
  discountExcessAmount: number
  // Non-null only when the discount needs the cashier's attention.
  discountWarning: string | null
  // outstanding - discountAmount, floored at 0.
  netPayable: number
}

// No longer sent by the backend (see CurrentSemesterPayableLedger's own
// comment) — kept as the shape the page's own client-side per-currency
// aggregation produces from the flat ledger list, so the render code below
// didn't need to change shape.
export interface CurrentSemesterPayableTotal {
  currencyGuid: string | null
  currencyName: string
  totalOutstanding: number
  totalDiscount: number
  totalNetPayable: number
}

// studentGuid is optional, same reasoning as getOutstandingLedgers' own —
// without it the handler can't resolve the student's discount assignment or
// academic status and falls back to the application's own semester.
export function getCurrentSemesterPayable(applicationGuid: string, studentGuid?: string | null): Promise<CurrentSemesterPayableLedger[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  const qs = studentGuid ? `?studentGuid=${encodeURIComponent(studentGuid)}` : ''
  return apiGet<CurrentSemesterPayableLedger[] | null>(`/api/v1/finance/payment-console/current-semester-payable/${applicationGuid}${qs}`)
    .then(data => data ?? [])
    // Same "empty result surfaces as a 404" behavior as getOutstandingLedgers
    // — "No outstanding ledgers found" here means fully paid, a normal
    // state, not an error (see the doc's own Errors table).
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// Confirmed via get-all-outstanding-ledgers.md — everything the student
// owes across all four fee categories (tuition/other/NCHE/guild) in one
// flat list, each row tagged with `category`. Unlike getOutstandingLedgers
// above (tuition-only, semester-scoped, takes an optional studentGuid),
// this endpoint takes no studentGuid at all and isn't semester-scoped —
// it's the "whole picture" the doc says feeds a not-yet-built unified
// payment screen. Used here just to show a real what's-owed figure on the
// Other/NCHE/Guild tabs, whose own payment-entry forms stay mock (no
// documented single-category submit endpoint for them yet).
//
// 2026-09 backend change (confirmed live, no doc update seen yet): rows now
// also carry ledgerNum, scheduledAmount/paidAmount (outstanding used to be
// the only figure on a row), and the same discount detail block
// current-semester-payable's own DTO gained on 2026-09-03 (discountGuid
// through discountWarning) — null/[] on NCHE/GUILD rows (category 3/4),
// which have no ledgerGuid/currency of their own either. Typed here for
// completeness; OutstandingCategoryTable (this file's only consumer, via
// the Other Payment tab's category-2 rows) still only reads
// description/currencyCode/outstanding — nothing here surfaces the new
// scheduledAmount/paidAmount/discount fields in the UI yet.
export interface AllOutstandingItem {
  category: number
  ledgerGuid: string | null
  ledgerName: string | null
  ledgerNum: number | null
  semesterGuid: string | null
  semesterName: string | null
  semCode: number | null
  description: string
  currencyGuid: string | null
  currencyCode: string | null
  currencyName: string | null
  scheduledAmount: number
  paidAmount: number
  outstanding: number
  discountGuid: string | null
  discountName: string | null
  discountCalcType: number | null
  discountAmtPer: number | null
  discountGroupLedgerNums: number[]
  discountAmount: number
  discountMessage: string | null
  discountExcessAmount: number
  discountWarning: string | null
}

export function getAllOutstandingLedgers(applicationGuid: string): Promise<AllOutstandingItem[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<AllOutstandingItem[] | null>(`/api/v1/finance/payment-console/outstanding-all/${applicationGuid}`)
    .then(data => data ?? [])
    // Same "genuinely-empty-result-as-404" behavior as getOutstandingLedgers
    // above — confirmed by the doc's own error table: 404 `not_found`
    // covers both "Application not found." and "No outstanding fees
    // found." (the latter meaning nothing owed at all, not a real error).
    // Distinguishing those two would need reading the error message text,
    // which the doc doesn't give a machine-checkable code for — treating
    // both as "nothing owed" is the safer default (an unknown application
    // would already have failed earlier, at student-profile load).
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

export function getPaymentHistory(applicationGuid: string): Promise<PaymentHistoryEntry[]> {
  if (MOCK_AUTH) return Promise.resolve(mockPaymentHistory[applicationGuid] ?? [])
  return apiGet<PaymentHistoryEntry[] | null>(`/api/v1/finance/payment-console/payment-history/${applicationGuid}`)
    .then(data => data ?? [])
    // Same "genuinely-empty-result-as-404" behavior confirmed live on
    // GetOutstandingLedgers above — an application with no payments yet
    // returns a 404 `not_found` instead of a 200 with an empty array.
    // Without this, react-query treats a brand-new application (no payment
    // history at all) as a query error instead of just "no history".
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// Confirmed via a real GetPaymentHistoryList sample response. **A genuinely
// different resource from `getPaymentHistory`/`PaymentHistoryEntry` above**
// despite sharing the same "payment-history" URL segment — that one is
// scoped to one application (`.../payment-history/{applicationGuid}`, a flat
// per-payment-line list with no student/programme info since it's already
// known from context); this one is the full cross-application ledger
// (`.../payment-history`, no guid), paginated, and each row carries its own
// studentNo/studentName/programName/feeType — same "route look-alike, don't
// conflate" pattern as enquirySource.ts/enquirySourceMaster.ts elsewhere in
// this app. Backs /finance/payment-history (the standalone page, not Payment
// Console's own Step 3 history tab). studentNo/studentName/programName are
// nullable on every row seen so far (real sample data), same "server always
// sends null for this field" shape as enquiry.ts's campusName/programName —
// display a "—" fallback, don't assume it'll ever populate. `rate` is null
// whenever `currencyCode` is already `"UGX"` (no conversion applied — pesky
// only for foreign-currency rows). `payType` is an object with its label
// already resolved server-side (`{value, name}`) — unlike the scoped
// endpoint's bare `payType: number`, there's no need to cross-reference
// PAY_TYPE_LABELS for this one. Confirmed via a real production crash that
// `payType` itself can come back `null` on some rows (not just always an
// object) — treat it as genuinely optional, don't assume every row has one.
export interface PaymentHistoryListEntry {
  paymentGuid: string
  category: number
  receiptNo: string
  payDate: string
  studentNo: string | null
  studentName: string | null
  programName: string | null
  feeType: string
  amount: number
  currencyCode: string
  ugxValue: number
  rate: number | null
  payType: { value: number; name: string } | null
}

export interface PaymentHistoryListResponse {
  items: PaymentHistoryListEntry[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export function getPaymentHistoryList(pageNumber = 1, pageSize = 20): Promise<PaymentHistoryListResponse> {
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber, pageSize })
  return apiGet<PaymentHistoryListResponse | null>(
    `/api/v1/finance/payment-console/payment-history?pageNumber=${pageNumber}&pageSize=${pageSize}`,
  ).then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// Confirmed via get-paid-ledgers-by-payment.md — the receipt detail view:
// what one TUITION payment's money was actually applied to, ledger by
// ledger/semester. The after-the-fact counterpart of getPayableLedgers'
// pre-submit preview below. Only a category-1 payment ever has allocation
// lines — NCHE/guild/other/advance-deposit GUIDs 404 here, which this
// treats as "nothing to show" rather than an error, same
// genuinely-empty-as-404 pattern used elsewhere in this file.
export interface PaidLedgerDto {
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
}

export function getPaidLedgersByPayment(paymentGuid: string): Promise<PaidLedgerDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<PaidLedgerDto[] | null>(`/api/v1/finance/payment-console/paid-ledgers/${paymentGuid}`)
    .then(data => data ?? [])
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

export function getPayableLedgers(params: PayableLedgersParams): Promise<PayableLedgersResult> {
  if (MOCK_AUTH) return Promise.resolve({ lines: [], balance: 0 })
  const qs = new URLSearchParams({
    applicationGuid: params.applicationGuid,
    amount: String(params.amount),
    currencyGuid: params.currencyGuid,
    payDate: params.payDate,
  })
  if (params.studentGuid) qs.set('studentGuid', params.studentGuid)
  return apiGet<PayableLedgersResult | null>(`/api/v1/finance/payment-console/payable-ledgers?${qs.toString()}`)
    .then(data => data ?? { lines: [], balance: 0 })
}

export function createPayment(input: PaymentInput): Promise<PaymentResult> {
  if (MOCK_AUTH) {
    const result: PaymentResult = {
      paymentGuid: `mock-payment-${mockPaymentSeq}`,
      paymentCode: `PAY-MOCK-${mockPaymentSeq++}`,
      receipt: `RCP-MOCK-${Date.now()}`,
      balance: 0,
      advanceMessage: null,
      reRegistrationWarning: null,
    }
    return Promise.resolve(result)
  }
  return apiPost<PaymentResult>('/api/v1/finance/payment-console/payments', input)
}

// Confirmed via put-payment.md — corrects a TUITION payment (amount, date,
// bank, remarks, and optionally its currency/receipt book/pay type).
// Changing amount/currency/date re-runs the allocation engine, so the
// payment's ledger lines get rewritten. Two things make a payment
// permanently uneditable — advance-funded, or one of its ledger lines has
// an associated refund — both enforced server-side; this client doesn't
// pre-check either (the row this is called from, PaymentHistoryListEntry,
// carries neither `advance` nor refund status), so a rejection surfaces as
// the server's own message rather than being pre-empted here.
//
// currencyGuid/receiptBookGuid/payType are genuinely optional here (per the
// doc: "nullable; omit to leave unchanged") — send null for any of them the
// cashier isn't deliberately changing. bankGuid and remarks carry no such
// "omit to leave unchanged" note in the doc, so — unlike the three fields
// above — treat them as always-set-to-this-value: leaving Remarks blank
// clears it, and Bank is only meaningful (and only sent) alongside a
// deliberate payType change.
export interface UpdatePaymentInput {
  amount: number
  payDate: string
  bankGuid: string | null
  remarks: string | null
  currencyGuid: string | null
  receiptBookGuid: string | null
  payType: number | null
  changeAllSemesters: boolean
}

export function updatePayment(paymentGuid: string, input: UpdatePaymentInput): Promise<PaymentResult> {
  if (MOCK_AUTH) {
    const result: PaymentResult = {
      paymentGuid,
      paymentCode: 'PAY-MOCK-EDITED',
      receipt: 'RCP-MOCK-EDITED',
      balance: 0,
      advanceMessage: null,
      reRegistrationWarning: null,
    }
    return Promise.resolve(result)
  }
  return apiPut<PaymentResult>(`/api/v1/finance/payment-console/payments/${paymentGuid}`, input)
}

// Confirmed via CreateAdvanceDeposit.bru / payment-console/post-advance-
// deposit.md — takes money ahead of any specific fee and holds it as a
// credit, later drawn down by an "other" payment referencing this
// deposit's paymentAdvanceGuid. Same shape as PaymentInput above; the only
// real difference is `amount` must be strictly > 0 here (CreatePayment
// allows 0, to book a pure-discount settlement that moves no cash).
export interface AdvanceDepositInput {
  applicationGuid: string
  studentGuid: string | null
  amount: number
  currencyGuid: string
  receiptBookGuid: string
  payDate: string
  payType: number
  procBankGuid: string | null
  remarks: string | null
}

export interface AdvanceDepositResult {
  paymentAdvanceGuid: string
  advPaymentCode: string
  receipt: string
  balance: number
}

export function createAdvanceDeposit(input: AdvanceDepositInput): Promise<AdvanceDepositResult> {
  if (MOCK_AUTH) {
    const result: AdvanceDepositResult = {
      paymentAdvanceGuid: `mock-advance-${mockPaymentSeq}`,
      advPaymentCode: `ADV-MOCK-${mockPaymentSeq++}`,
      receipt: `RCP-MOCK-${Date.now()}`,
      balance: input.amount,
    }
    return Promise.resolve(result)
  }
  // Route moved from /payment-console/advance-deposit to /advance-payment
  // on 2026-09-05 (post-advance-deposit.md's changelog) — advance-payment
  // (deposits + adjustments) is now a standalone feature folder.
  return apiPost<AdvanceDepositResult>('/api/v1/finance/advance-payment', input)
}

// NCHE/Guild payment creation moved out to their own dedicated pages/files
// (finance/nchePayment.ts, finance/guildPayment.ts) — confirmed via
// post-payment-nche.md/post-payment-guild.md (2026-08-31) that both now
// live on their own erp-finance-compliance-service routes
// (/finance/nche/payment-nche, /finance/guild/payment-guild), not nested
// under payment-console/ the way this file's old scaffolding assumed.
// Search/profile/outstanding-all below are still shared with those two
// pages — only the create call itself moved.

// Confirmed via get-ledger-others.md — the "other fees" catalogue
// (ID replacement, transcript, lateral-entry fee, …), a separate table from
// tuition ledgers; ledgerOthersGuid is not interchangeable with a
// ledgerGuid. Unpaged/unfiltered, matching what a dropdown wants.
export interface LedgerOthersDto {
  ledgerOthersGuid: string
  ledgerCode: string
  ledgerName: string
}

const mockLedgerOthers: LedgerOthersDto[] = [
  { ledgerOthersGuid: 'ldo-mock-1', ledgerCode: 'LFN', ledgerName: 'Library Fine' },
  { ledgerOthersGuid: 'ldo-mock-2', ledgerCode: 'IDCF', ledgerName: 'ID Card Fee' },
  { ledgerOthersGuid: 'ldo-mock-3', ledgerCode: 'TRSF', ledgerName: 'Transcript Fee' },
  { ledgerOthersGuid: 'ldo-mock-4', ledgerCode: 'CTM', ledgerName: 'Caution Money' },
  { ledgerOthersGuid: 'ldo-mock-5', ledgerCode: 'UNF', ledgerName: 'Uniform Fee' },
  { ledgerOthersGuid: 'ldo-mock-6', ledgerCode: 'OTH', ledgerName: 'Other Fee' },
]

export function getLedgerOthers(): Promise<LedgerOthersDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockLedgerOthers)
  return apiGet<LedgerOthersDto[] | null>('/api/v1/finance/payment-console/ledger-others').then(data => data ?? [])
}

// Confirmed via post-payment-other.md — now wired to the Other Payment tab's
// real submit, ledgerOthersGuid sourced from getLedgerOthers() above. Two
// funding modes: cash/bank (paymentAdvanceGuid omitted — receiptBookGuid
// required, procBankGuid required too unless payType is Cash) or from an
// existing advance deposit (paymentAdvanceGuid supplied — no receipt/book/
// bank needed). Only cash/bank mode is wired on the form: there's no picker
// anywhere in this app for an existing advance deposit's paymentAdvanceGuid
// (createAdvanceDeposit only *creates* one; nothing lists a student's
// existing deposits with remaining balance) — the Advance Payment checkbox
// stays local-only and blocks submit with a toast rather than sending a
// fabricated paymentAdvanceGuid that would 404.
export interface PaymentOtherInput {
  applicationGuid: string
  studentGuid: string | null
  ledgerOthersGuid: string
  amount: number
  currencyGuid: string
  payDate: string
  payType: number
  remarks: string | null
  // Cash/bank mode (paymentAdvanceGuid null): receiptBookGuid required,
  // procBankGuid required too unless payType is Cash. Advance mode
  // (paymentAdvanceGuid set): both left null — no receipt is claimed, the
  // money was already receipted when the advance was deposited.
  receiptBookGuid: string | null
  procBankGuid: string | null
  paymentAdvanceGuid: string | null
}

export interface PaymentOtherResult {
  paymentOtherGuid: string
  paymentCode: string
  // null in advance mode — no receipt is claimed there.
  receipt: string | null
  amount: number
}

export function createPaymentOther(input: PaymentOtherInput): Promise<PaymentOtherResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      paymentOtherGuid: `mock-other-${mockPaymentSeq}`,
      paymentCode: `OTH-MOCK-${mockPaymentSeq++}`,
      receipt: input.paymentAdvanceGuid ? null : `RCP-MOCK-${Date.now()}`,
      amount: input.amount,
    })
  }
  return apiPost<PaymentOtherResult>('/api/v1/finance/payment-console/payment-other', input)
}
