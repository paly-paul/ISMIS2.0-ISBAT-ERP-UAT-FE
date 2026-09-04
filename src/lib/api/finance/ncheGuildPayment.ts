import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Merged NCHE + Guild Payment API — backs the single tabbed
// src/app/finance/nche-guild-payment page (replaces the two previously
// separate nche-payment/guild-payment pages and their nchePayment.ts/
// guildPayment.ts modules). Confirmed via nche/*.md (2026-08-31/09-01) and
// guild/*.md (2026-08-31, re-checked 2026-09-01): both are genuinely
// identical-shape CRUD + status surfaces under erp-finance-compliance-
// service — same category-prefixed id field on every response
// (paymentNcheGuid/paymentGuildGuid), same bare-boolean DELETE response,
// same one-row-per-semester array from semester-status — differing only in
// a couple of payload field names (pnrNumber+remarks for NCHE vs.
// bankDeposit+receipt for Guild) and their URL segment (nche/ vs. guild/),
// so a single `category` param drives every call.
export type PaymentCategory = 'nche' | 'guild'

// Every doc's own path header omits the /api/v1 gateway prefix every other
// endpoint in this app goes through — followed here as a likely doc
// omission, matching this app's own convention, rather than assumed literal.
function basePath(category: PaymentCategory) {
  return `/api/v1/finance/${category}`
}

export interface RegulatoryPaymentInput {
  category: PaymentCategory
  applicationGuid: string
  studentGuid: string | null
  amount: number
  payDate: string
  // NCHE-only.
  pnrNumber?: string | null
  remarks?: string | null
  // Guild-only.
  bankDeposit?: string | null
}

export interface RegulatoryPaymentResult {
  paymentGuid: string
  amount: number
  // What's still owed on this category after this payment (rate ×
  // semesterCount, minus what's now paid) — no currency, no receipt book,
  // no bank claimed on create/update for either category.
  remainingBalance: number
}

// The wire response's own id field is category-prefixed — paymentNcheGuid
// (nche/post-payment-nche.md, nche/put-payment-nche.md) and paymentGuildGuid
// (guild/post-payment-guild.md, guild/put-payment-guild.md) — never the
// generic `paymentGuid` RegulatoryPaymentResult exposes to callers.
// Normalized here rather than trusting a straight JSON cast, or every caller
// reading `result.paymentGuid` after a create/update would silently get
// `undefined`.
interface RawPaymentResult {
  paymentNcheGuid?: string
  paymentGuildGuid?: string
  amount: number
  remainingBalance: number
}
function normalizePaymentResult(raw: RawPaymentResult): RegulatoryPaymentResult {
  return { paymentGuid: (raw.paymentNcheGuid ?? raw.paymentGuildGuid) as string, amount: raw.amount, remainingBalance: raw.remainingBalance }
}

export type RegulatoryPaymentUpdateInput = Pick<RegulatoryPaymentInput, 'amount' | 'payDate' | 'pnrNumber' | 'remarks' | 'bankDeposit'>

// Payment-history rows carry more resolved fields (studentName/intakeCode/
// receipt on Guild's side) than the create/update result does — union of
// both categories' shapes, with the fields that don't apply to a given
// category simply left undefined.
export interface RegulatoryPaymentHistoryEntry {
  paymentGuid: string
  applicationGuid: string
  studentGuid: string | null
  studentName?: string | null
  intakeGuid: string | null
  intakeCode?: number | null
  payDate: string
  amount: number
  pnrNumber?: string | null
  remarks?: string | null
  bankDeposit?: string | null
  receipt?: string | null
}

// Same category-prefixed id field as RawPaymentResult above — confirmed via
// nche/get-payment-history.md ("paymentNcheGuid", no studentName/intakeCode/
// receipt at all on NCHE's side) and guild/get-payment-history.md
// ("paymentGuildGuid", with studentName/intakeCode/receipt on Guild's side).
interface RawPaymentHistoryEntry {
  paymentNcheGuid?: string
  paymentGuildGuid?: string
  applicationGuid: string
  studentGuid: string | null
  studentName?: string | null
  intakeGuid: string | null
  intakeCode?: number | null
  payDate: string
  amount: number
  pnrNumber?: string | null
  remarks?: string | null
  bankDeposit?: string | null
  receipt?: string | null
}
function normalizeHistoryEntry(raw: RawPaymentHistoryEntry): RegulatoryPaymentHistoryEntry {
  const { paymentNcheGuid, paymentGuildGuid, ...rest } = raw
  return { ...rest, paymentGuid: (paymentNcheGuid ?? paymentGuildGuid) as string }
}

// Confirmed via nche/get-semester-status.md and guild/get-semester-status.md
// (2026-09-01, identical shape on both) — one entry per semester in the
// student's program (from semester 1, or the registration semester for
// lateral-entry/credit-exemption students), NOT a single current-status
// object as an earlier version of this file assumed (that mismatch is what
// crashed statusBadgeClass on a real response — `.status` read off an array
// is `undefined`). `status` is exactly one of "Paid" | "Due" | "" (not-yet-
// due) per both docs' own tables.
export interface RegulatorySemesterStatus {
  semesterGuid: string
  semCode: number
  semName: string
  status: 'Paid' | 'Due' | ''
}

let mockPaymentSeq = 1
const mockHistory: Record<PaymentCategory, Record<string, RegulatoryPaymentHistoryEntry[]>> = { nche: {}, guild: {} }

export function createRegulatoryPayment(category: PaymentCategory, input: Omit<RegulatoryPaymentInput, 'category'>): Promise<RegulatoryPaymentResult> {
  if (MOCK_AUTH) {
    const paymentGuid = `mock-${category}-${mockPaymentSeq++}`
    const entry: RegulatoryPaymentHistoryEntry = {
      paymentGuid, applicationGuid: input.applicationGuid, studentGuid: input.studentGuid, studentName: null,
      intakeGuid: null, intakeCode: null, payDate: input.payDate, amount: input.amount,
      pnrNumber: input.pnrNumber ?? null, remarks: input.remarks ?? null, bankDeposit: input.bankDeposit ?? null, receipt: null,
    }
    const key = input.studentGuid ?? input.applicationGuid
    mockHistory[category][key] = [...(mockHistory[category][key] ?? []), entry]
    return Promise.resolve({ paymentGuid, amount: input.amount, remainingBalance: 0 })
  }
  return apiPost<RawPaymentResult>(`${basePath(category)}/payment-${category}`, input).then(normalizePaymentResult)
}

export function updateRegulatoryPayment(category: PaymentCategory, paymentGuid: string, input: RegulatoryPaymentUpdateInput): Promise<RegulatoryPaymentResult> {
  if (MOCK_AUTH) return Promise.resolve({ paymentGuid, amount: input.amount, remainingBalance: 0 })
  return apiPut<RawPaymentResult>(`${basePath(category)}/payment-${category}/${paymentGuid}`, input).then(normalizePaymentResult)
}

// Response 200 is the bare boolean `true` (confirmed via
// nche/delete-payment-nche.md and guild/delete-payment-guild.md), not a
// `{ success }` envelope.
export function deleteRegulatoryPayment(category: PaymentCategory, paymentGuid: string): Promise<boolean> {
  if (MOCK_AUTH) return Promise.resolve(true)
  return apiDelete<boolean>(`${basePath(category)}/payment-${category}/${paymentGuid}`)
}

export function getRegulatoryPaymentHistory(category: PaymentCategory, studentGuid: string): Promise<RegulatoryPaymentHistoryEntry[]> {
  if (MOCK_AUTH) return Promise.resolve(mockHistory[category][studentGuid] ?? [])
  return apiGet<RawPaymentHistoryEntry[] | null>(`${basePath(category)}/payment-history/${studentGuid}`)
    .then(data => (data ?? []).map(normalizeHistoryEntry))
}

// A 404 here is documented as "Application not found" — but confirmed live
// (2026-08-31) on an application known to exist (its own outstanding-all/
// profile calls succeed), meaning this route isn't actually live on this
// backend yet for either category. Swallowed unconditionally (not matched
// against a specific AuthError code) rather than surfaced as an error: both
// docs' error tables are the least detailed of any endpoint wired so far
// ("Bearer cookie via gateway; requires permission (TBD)"), from what looks
// like a different codegen than the rest of this app's finance-service
// endpoints. There's nothing actionable for the cashier to do about a
// missing status badge either way, and a hard error here shouldn't block the
// rest of the page (outstanding balance, payment form, history) from working.
export function getRegulatorySemesterStatus(category: PaymentCategory, applicationGuid: string, studentGuid?: string | null): Promise<RegulatorySemesterStatus[] | null> {
  if (MOCK_AUTH) return Promise.resolve([
    { semesterGuid: 'sem-mock-1', semCode: 1, semName: 'Semester 1', status: 'Paid' },
    { semesterGuid: 'sem-mock-2', semCode: 2, semName: 'Semester 2', status: 'Due' },
    { semesterGuid: 'sem-mock-3', semCode: 3, semName: 'Semester 3', status: '' },
  ])
  const qs = studentGuid ? `?studentGuid=${encodeURIComponent(studentGuid)}` : ''
  return apiGet<RegulatorySemesterStatus[]>(`${basePath(category)}/semester-status/${applicationGuid}${qs}`).catch(() => null)
}

// Confirmed via get-nche-search.md (2026-09-01) — a dedicated student picker
// for the NCHE payment flow, distinct service (erp-academic-service, not
// erp-finance-compliance-service) and path shape from every other function
// in this file, so it isn't run through basePath()/category. Structurally
// identical to GET /api/v1/students but each item is pre-enriched with the
// student's active applicationGuid/programGuid+programName/semesterGuid+
// semesterName (resolved from the active history entry, falling back to the
// top-level student fields) — the fields the NCHE tab's outstanding-balance/
// profile/history calls need, without a second round-trip. Guild has no
// documented equivalent yet — the Guild tab still uses Payment Console's own
// searchStudents().
export interface NcheStudentSearchResult {
  studentGuid: string
  studentName: string | null
  studentNum: string | null
  // Guid? server-side — a hit with no active application can't be selected
  // into this page's flow (everything downstream keys off applicationGuid),
  // so callers should treat a null here as non-selectable.
  applicationGuid: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
}

export interface NcheStudentSearchResponse {
  items: NcheStudentSearchResult[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export function searchNcheStudents(searchTerm: string, page = 1, pageSize = 25): Promise<NcheStudentSearchResponse> {
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (searchTerm.trim()) qs.set('searchTerm', searchTerm.trim())
  return apiGet<NcheStudentSearchResponse | null>(`/api/v1/students/nche-search?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}
