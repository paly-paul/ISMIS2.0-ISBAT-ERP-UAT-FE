// Dev-only, in-memory mock data for the Refund page's "Mock Data" toggle
// (see MockModeSwitch in page.tsx) — separate from NEXT_PUBLIC_AUTH_MOCK,
// which is an app-wide build-time flag. This lets the whole 3-tab refund
// flow (search → pick a line → submit) be clicked through with no backend
// at all, useful when the dev gateway (.env.local's API_GATEWAY_URL) is
// unreachable or doesn't have the right seed data yet.
//
// Deliberately happy-path only: every submit succeeds, no simulated 400s
// (already-refunded, bulk partial-failure, unresolved applicationGuid). If
// those error states ever need exercising without a backend, extend the
// mockCreateRefund/mockBulkRefund functions below rather than the seed data.

import { PassoutLibraryDepositRefundCandidateDto, RejectedApplicationRefundCandidateDto, TerminatedStudentRefundCandidateDto } from '@/lib/api/academic/refundSearch'
import { BulkRefundLineInput, BulkRefundLineResultDto, RefundDto, RefundLedgerLineDto, RefundResultDto, TotalPaidDto } from '@/lib/api/finance/paymentRefund'

function mockGuid(seed: string) {
  // Not a real UUID — just a stable, readable, unique-enough string per
  // seed so every mock row's guid fields are consistent across renders.
  return `mock-${seed}`
}

// ─── Category 1 — Rejected by Registrar ───────────────────────────────────
export const MOCK_REJECTED_APPLICATIONS: RejectedApplicationRefundCandidateDto[] = [
  { applicationGuid: mockGuid('app-rejected-1'), studentGuid: null, appRefNo: 'APP20241/145', applicantName: 'Ashfa Maryam', email: 'ashfamaryam2004@gmail.com', phone: '741013710' },
  { applicationGuid: mockGuid('app-rejected-2'), studentGuid: null, appRefNo: 'APP20241/210', applicantName: 'Okwir Daniel', email: 'okwir.daniel@example.com', phone: '772004411' },
  { applicationGuid: mockGuid('app-rejected-3'), studentGuid: mockGuid('student-rejected-3'), appRefNo: 'APP20242/018', applicantName: 'Namutebi Sarah', email: 'namutebi.sarah@example.com', phone: '701998822' },
]

// ─── Category 2 — Passout / Library Deposit ───────────────────────────────
export const MOCK_PASSOUT_STUDENTS: PassoutLibraryDepositRefundCandidateDto[] = [
  {
    studentGuid: mockGuid('student-passout-1'),
    applicationGuid: mockGuid('app-passout-1'),
    studentRegNo: '0120231230523', studentNum: '0120231230523', studentName: 'Majok Joseph Madit',
    programGuid: mockGuid('program-1'), programName: 'Bachelor of Science in Applied Information Technology - S22',
    batchGuid: mockGuid('batch-1'), batchCode: 'BSCAITS21DA',
    campusGuid: mockGuid('campus-1'), campusName: 'ISBAT University - Main Campus',
    intakeGuid: mockGuid('intake-1'),
    mainLedgerLines: [
      { ledgerGuid: mockGuid('ledger-passout-1a'), ledgerName: 'Library Deposit', currencyGuid: mockGuid('currency-usd'), currencyCode: 'USD', amount: 50, convertedAmount: 190000, exchangeRateMissing: false, payDate: '2024-02-21T00:00:00', receipt: '89662', receiptBookCode: 'MCC56' },
    ],
    otherLedgerLines: [],
  },
  {
    studentGuid: mockGuid('student-passout-2'),
    applicationGuid: mockGuid('app-passout-2'),
    studentRegNo: '022210044', studentNum: '022210044', studentName: 'Brian Ssemanda',
    programGuid: mockGuid('program-2'), programName: 'Diploma in Nursing',
    batchGuid: mockGuid('batch-2'), batchCode: 'NUR-2022-MAY-A',
    campusGuid: mockGuid('campus-1'), campusName: 'ISBAT University - Main Campus',
    intakeGuid: mockGuid('intake-2'),
    mainLedgerLines: [],
    otherLedgerLines: [
      { ledgerGuid: mockGuid('ledger-passout-2a'), ledgerName: 'Library Deposit', currencyGuid: mockGuid('currency-ugx'), currencyCode: 'UGX', amount: 100000, convertedAmount: 100000, exchangeRateMissing: false, payDate: '2024-09-19T00:00:00', receipt: '160878', receiptBookCode: 'MCCB22' },
      { ledgerGuid: mockGuid('ledger-passout-2b'), ledgerName: 'Library Deposit', currencyGuid: mockGuid('currency-ugx'), currencyCode: 'UGX', amount: 20000, convertedAmount: 20000, exchangeRateMissing: false, payDate: '2023-11-02T00:00:00', receipt: '142201', receiptBookCode: 'MCCB19' },
    ],
  },
]

// ─── Category 3 — Fake-Certificate Termination ────────────────────────────
export const MOCK_FAKECERT_STUDENTS: TerminatedStudentRefundCandidateDto[] = [
  {
    studentGuid: mockGuid('student-fakecert-1'), applicationGuid: mockGuid('app-fakecert-1'), studentRegNo: '022210001', studentNum: '022210001', studentName: 'Tusingwire Drake',
    programGuid: mockGuid('program-3'), programName: 'Diploma in Networking and Cyber Security - F21',
    batchGuid: mockGuid('batch-3'), batchCode: null,
    terminationRemarks: 'Submitted a fabricated national diploma certificate',
  },
  {
    studentGuid: mockGuid('student-fakecert-2'), applicationGuid: mockGuid('app-fakecert-2'), studentRegNo: '011230078', studentNum: '011230078', studentName: 'Nabirye Patience',
    programGuid: mockGuid('program-1'), programName: 'Bachelor of Science in Applied Information Technology - S22',
    batchGuid: mockGuid('batch-1'), batchCode: 'BSCAITS21DA',
    terminationRemarks: 'Submitted a forged A-Level transcript',
  },
]

// ─── Main-ledger lines (Categories 1 & 3) — mutable so a submitted refund
// removes its line, same "already-refunded lines excluded" behavior the
// real ledger-details-batch endpoint documents. ───────────────────────────
const mockMainLedgerLines: Record<string, RefundLedgerLineDto[]> = {
  [mockGuid('app-rejected-1')]: [
    { ledgerGuid: mockGuid('ledger-rejected-1a'), ledgerName: 'Admission Fee', currencyGuid: mockGuid('currency-usd'), currencyCode: 'USD', amount: 50, convertedAmount: 190000, exchangeRateMissing: false, payDate: '2024-02-21T00:00:00', receipt: '89662', receiptBookCode: 'MCC56' },
  ],
  [mockGuid('app-rejected-2')]: [
    { ledgerGuid: mockGuid('ledger-rejected-2a'), ledgerName: 'Admission Fee', currencyGuid: mockGuid('currency-ugx'), currencyCode: 'UGX', amount: 150000, convertedAmount: 150000, exchangeRateMissing: false, payDate: '2024-05-14T00:00:00', receipt: '91004', receiptBookCode: 'MCC58' },
  ],
  [mockGuid('app-rejected-3')]: [
    { ledgerGuid: mockGuid('ledger-rejected-3a'), ledgerName: 'Admission Fee', currencyGuid: mockGuid('currency-ugx'), currencyCode: 'UGX', amount: 150000, convertedAmount: 150000, exchangeRateMissing: false, payDate: '2024-06-02T00:00:00', receipt: '92211', receiptBookCode: 'MCC58' },
    { ledgerGuid: mockGuid('ledger-rejected-3b'), ledgerName: 'Tuition Fee', currencyGuid: mockGuid('currency-usd'), currencyCode: 'USD', amount: 300, convertedAmount: 1140000, exchangeRateMissing: false, payDate: '2024-06-02T00:00:00', receipt: '92212', receiptBookCode: 'MCC58' },
  ],
  [mockGuid('app-fakecert-1')]: [
    { ledgerGuid: mockGuid('ledger-fakecert-1a'), ledgerName: 'Tuition Fee', currencyGuid: mockGuid('currency-usd'), currencyCode: 'USD', amount: 300, convertedAmount: 1140000, exchangeRateMissing: false, payDate: '2024-02-21T00:00:00', receipt: '89666', receiptBookCode: 'MCC56' },
  ],
  [mockGuid('app-fakecert-2')]: [
    { ledgerGuid: mockGuid('ledger-fakecert-2a'), ledgerName: 'Tuition Fee', currencyGuid: mockGuid('currency-ugx'), currencyCode: 'UGX', amount: 900000, convertedAmount: 900000, exchangeRateMissing: false, payDate: '2024-03-11T00:00:00', receipt: '90112', receiptBookCode: 'MCC57' },
  ],
}

const mockRefundHistory: Record<string, RefundDto[]> = {}

export function mockGetLedgerDetailsBatch(applicationGuids: string[]): Record<string, RefundLedgerLineDto[]> {
  const result: Record<string, RefundLedgerLineDto[]> = {}
  applicationGuids.forEach(guid => { result[guid] = mockMainLedgerLines[guid] ?? [] })
  return result
}

export function mockGetTotalPaid(applicationGuid: string, ledgerGuid: string): TotalPaidDto | null {
  const line = (mockMainLedgerLines[applicationGuid] ?? []).find(l => l.ledgerGuid === ledgerGuid)
  if (!line) return null
  return { amount: line.amount, currencyGuid: line.currencyGuid, currencyName: line.currencyCode === 'USD' ? 'US Dollars' : 'Uganda Shilling' }
}

export function mockGetRefundsByApplication(applicationGuid: string): RefundDto[] {
  return mockRefundHistory[applicationGuid] ?? []
}

// Mirrors createRefund's real contract closely enough for the happy path:
// records the refund, then removes the line from the picker so it can't be
// selected again — same effect ledger-details-batch's own already-refunded
// exclusion has server-side.
// ledgerOthersGuid support added (2026-09-23) for Passout single-student
// mode, which reuses this same generic single-refund mock — Categories 1/3
// only ever pass ledgerGuid, unaffected.
export function mockCreateRefund(applicationGuid: string, input: { ledgerGuid?: string | null; ledgerOthersGuid?: string | null; currencyGuid: string; amount: number; refundDate: string; remarks: string | null }): Promise<RefundResultDto> {
  const lines = mockMainLedgerLines[applicationGuid] ?? []
  const line = lines.find(l => l.ledgerGuid === input.ledgerGuid)
  const refundGuid = mockGuid(`refund-${applicationGuid}-${input.ledgerGuid ?? input.ledgerOthersGuid}-${Date.now()}`)
  const history = mockRefundHistory[applicationGuid] ?? (mockRefundHistory[applicationGuid] = [])
  history.push({
    refundGuid,
    refundDate: input.refundDate,
    amount: input.amount,
    currencyGuid: input.currencyGuid,
    currencyName: input.currencyGuid === mockGuid('currency-usd') ? 'US Dollars' : 'Uganda Shilling',
    ledgerGuid: input.ledgerGuid ?? input.ledgerOthersGuid ?? '',
    ledgerName: line?.ledgerName ?? 'Library Deposit',
    remarks: input.remarks,
  })
  if (input.ledgerGuid) {
    mockMainLedgerLines[applicationGuid] = lines.filter(l => l.ledgerGuid !== input.ledgerGuid)
    const student = MOCK_PASSOUT_STUDENTS.find(s => s.applicationGuid === applicationGuid)
    if (student) student.mainLedgerLines = (student.mainLedgerLines ?? []).filter(l => l.ledgerGuid !== input.ledgerGuid)
  }
  if (input.ledgerOthersGuid) {
    const student = MOCK_PASSOUT_STUDENTS.find(s => s.applicationGuid === applicationGuid)
    if (student) student.otherLedgerLines = (student.otherLedgerLines ?? []).filter(l => l.ledgerGuid !== input.ledgerOthersGuid)
  }
  return Promise.resolve({ refundGuid })
}

// Flow 2 (single-student) lookup — mirrors getPassoutLibraryDepositByStudent
// for the dev "Mock Data" toggle.
export function mockGetPassoutStudentByGuid(studentGuid: string): PassoutLibraryDepositRefundCandidateDto | null {
  return MOCK_PASSOUT_STUDENTS.find(s => s.studentGuid === studentGuid) ?? null
}

// ─── Bulk refund (Category 2) — happy path only, every line succeeds and is
// removed from its student's embedded ledgers so a re-search shows it as
// refunded. ─────────────────────────────────────────────────────────────
export function mockBulkRefund(lines: BulkRefundLineInput[]): Promise<BulkRefundLineResultDto[]> {
  const results = lines.map((l): BulkRefundLineResultDto => {
    const student = MOCK_PASSOUT_STUDENTS.find(s => s.applicationGuid === l.applicationGuid)
    if (student) {
      if (l.ledgerGuid) student.mainLedgerLines = (student.mainLedgerLines ?? []).filter(led => led.ledgerGuid !== l.ledgerGuid)
      if (l.ledgerOthersGuid) student.otherLedgerLines = (student.otherLedgerLines ?? []).filter(led => led.ledgerGuid !== l.ledgerOthersGuid)
    }
    return {
      applicationGuid: l.applicationGuid, ledgerGuid: l.ledgerGuid, ledgerOthersGuid: l.ledgerOthersGuid,
      success: true, refundGuid: mockGuid(`bulk-refund-${l.applicationGuid}-${l.ledgerGuid ?? l.ledgerOthersGuid}-${Date.now()}`), error: null,
    }
  })
  return Promise.resolve(results)
}

// ─── Search filtering — loose contains-match across the same fields each
// real endpoint's own `search` param documents, so typing in the mock tables
// behaves the same as it would against the real API. ──────────────────────
function contains(haystack: (string | null | undefined)[], needle: string) {
  const q = needle.trim().toLowerCase()
  if (!q) return true
  return haystack.some(h => (h ?? '').toLowerCase().includes(q))
}

export function mockSearchRejected(search: string): RejectedApplicationRefundCandidateDto[] {
  return MOCK_REJECTED_APPLICATIONS.filter(a => contains([a.applicantName, a.appRefNo, a.email, a.phone], search))
}

export function mockSearchFakeCert(search: string): TerminatedStudentRefundCandidateDto[] {
  return MOCK_FAKECERT_STUDENTS.filter(s => contains([s.studentName, s.studentRegNo, s.studentNum], search))
}

export interface MockPassoutFilters {
  search: string
  intakeGuid?: string
  programGuid?: string
  batchGuid?: string
  campusGuid?: string
}

export function mockSearchPassout(filters: MockPassoutFilters): PassoutLibraryDepositRefundCandidateDto[] {
  return MOCK_PASSOUT_STUDENTS.filter(s =>
    contains([s.studentName, s.studentRegNo, s.studentNum], filters.search) &&
    (!filters.intakeGuid || s.intakeGuid === filters.intakeGuid) &&
    (!filters.programGuid || s.programGuid === filters.programGuid) &&
    (!filters.batchGuid || s.batchGuid === filters.batchGuid) &&
    (!filters.campusGuid || s.campusGuid === filters.campusGuid),
  )
}
