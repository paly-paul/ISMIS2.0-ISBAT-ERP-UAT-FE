import { apiGet, apiPostWithMessage } from '../client'
import { mockQueueReportJob, normalizeReportJob, type ReportJob } from './discountReport'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Transaction Report (erp-docs/pages/finance/transaction-report-page.md).
// Docs: finance-service/reports/get-transaction-report-preview.md and
// post-transaction-report-export.md. Report jobs / Downloads are shared with
// the Discount Report (see discountReport.ts and lib/reportDownloads.ts).

// ── Filters ────────────────────────────────────────────────────────────────

// Every field optional; empty means "everything". Saved on Process and reused
// for every later page and the export.
export interface TransactionReportFilters {
  fromDate?: string            // yyyy-mm-dd
  toDate?: string              // yyyy-mm-dd, inclusive of the whole day
  intakeGuid?: string
  applicationGuid?: string     // one student, from vetted-registered-search
  receiptBookGuids?: string[]  // max 50
  ledgerGuids?: string[]       // max 20; the Discount ledger (DA) is ignored
}

export const TRANSACTION_REPORT_MAX_RECEIPT_BOOKS = 50
export const TRANSACTION_REPORT_MAX_LEDGERS = 20
export const TRANSACTION_REPORT_PAGE_SIZE = 15
// The Discount ledger: discount is a column, never a row, so it isn't offered
// as a filter (selecting only it returns nothing).
export const DISCOUNT_LEDGER_CODE = 'DA'

// ── Preview ────────────────────────────────────────────────────────────────

export interface TransactionReportRow {
  payDate: string          // calendar date, time always 00:00:00; no TZ conversion
  receipt: string
  receiptBook: string
  studentNumber: string    // reg no when registered, else AppRefNo
  studentName: string
  programName: string      // the row's semester's programme
  semesterName: string
  semCode: number
  ledgerCode: string
  ledgerName: string
  source: { value: number; name: string }   // 1 DirectPayment, 2 AdvanceAdjustment
  payMode: { value: number; name: string }  // 1 Cash, 2 Cheque, 3 Bank, 4 DemandDraft, 5 Online
  currencyCode: string
  amount: number
  discount: number         // 0 when none
  net: number              // amount − discount
}

export interface TransactionReportCurrencyTotal {
  currencyCode: string
  rowCount: number
  receiptCount: number
  studentCount: number
  gross: number
  discount: number
  unallocatedDiscount: number
  net: number              // gross − discount − unallocatedDiscount
}

export interface TransactionReportSummary {
  totalRows: number
  // Distinct across all rows; never add up byCurrency's counts.
  totalReceipts: number
  totalStudents: number
  byCurrency: TransactionReportCurrencyTotal[]
}

export interface TransactionReportPreview {
  summary: TransactionReportSummary | null   // null when includeSummary=false
  rows: { items: TransactionReportRow[]; totalCount: number; pageNumber: number; pageSize: number }
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_NAMES = ['Amina Nakato', 'James Okello', 'Grace Nampijja', 'Brian Kamya', 'Esther Tumukunde', 'Peter Ssemwogerere']
const MOCK_PROGS = ['BSc Computer Science - S22', 'MBA Business Administration', 'BBA Accounting', 'Diploma in Nursing']
const MOCK_LEDGERS = [
  { ledgerCode: 'TF', ledgerName: 'Tuition Fee', base: 3000000 },
  { ledgerCode: 'RR', ledgerName: 'Semester Entry Fee', base: 730121 },
  { ledgerCode: 'GF', ledgerName: 'Graduation Fee', base: 250000 },
]
const MOCK_ROWS: TransactionReportRow[] = Array.from({ length: 72 }, (_, i) => {
  const receiptIdx = Math.floor(i / 3)
  const ledger = MOCK_LEDGERS[i % 3]
  const usd = receiptIdx % 8 === 0
  const day = new Date(Date.UTC(2026, 8, 30 - Math.floor(receiptIdx / 2)))
  const amount = usd ? Math.round(ledger.base / 3700) : ledger.base
  const discount = ledger.ledgerCode === 'TF' && receiptIdx % 3 === 0 ? Math.round(amount * 0.3) : 0
  const sem = (receiptIdx % 6) + 1
  return {
    payDate: `${day.toISOString().slice(0, 10)}T00:00:00`,
    receipt: String(142700 - receiptIdx),
    receiptBook: receiptIdx % 4 === 0 ? 'MCB34' : 'CASH01',
    studentNumber: `0112504${String(10 + (receiptIdx % 30)).padStart(2, '0')}`,
    studentName: MOCK_NAMES[receiptIdx % MOCK_NAMES.length],
    programName: MOCK_PROGS[receiptIdx % MOCK_PROGS.length],
    semesterName: `Semester ${sem}`,
    semCode: sem,
    ledgerCode: ledger.ledgerCode,
    ledgerName: ledger.ledgerName,
    source: receiptIdx % 5 === 0 ? { value: 2, name: 'AdvanceAdjustment' } : { value: 1, name: 'DirectPayment' },
    payMode: [{ value: 1, name: 'Cash' }, { value: 3, name: 'Bank' }, { value: 5, name: 'Online' }][receiptIdx % 3],
    currencyCode: usd ? 'USD' : 'UGX',
    amount,
    discount,
    net: amount - discount,
  }
})

function mockFilter(f: TransactionReportFilters): TransactionReportRow[] {
  return MOCK_ROWS.filter(r =>
    (!f.fromDate || r.payDate.slice(0, 10) >= f.fromDate)
    && (!f.toDate || r.payDate.slice(0, 10) <= f.toDate))
}

function mockSummary(rows: TransactionReportRow[]): TransactionReportSummary {
  const currencies = [...new Set(rows.map(r => r.currencyCode))].sort()
  return {
    totalRows: rows.length,
    totalReceipts: new Set(rows.map(r => r.receipt)).size,
    totalStudents: new Set(rows.map(r => r.studentNumber)).size,
    byCurrency: currencies.map(code => {
      const inCur = rows.filter(r => r.currencyCode === code)
      const gross = inCur.reduce((s, r) => s + r.amount, 0)
      const discount = inCur.reduce((s, r) => s + r.discount, 0)
      return {
        currencyCode: code, rowCount: inCur.length,
        receiptCount: new Set(inCur.map(r => r.receipt)).size,
        studentCount: new Set(inCur.map(r => r.studentNumber)).size,
        gross, discount, unallocatedDiscount: 0, net: gross - discount,
      }
    }),
  }
}

// ── Endpoints ──────────────────────────────────────────────────────────────

// GET /finance/reports/transaction/preview. Page 1 with the summary; every
// later page passes includeSummary=false (summary comes back null). Arrays are
// repeated keys: ?receiptBookGuids=a&receiptBookGuids=b.
export function getTransactionReportPreview(filters: TransactionReportFilters, pageNumber: number, pageSize = TRANSACTION_REPORT_PAGE_SIZE): Promise<TransactionReportPreview> {
  const includeSummary = pageNumber === 1
  if (MOCK_AUTH) {
    const rows = mockFilter(filters)
    const start = (pageNumber - 1) * pageSize
    return new Promise(resolve => setTimeout(() => resolve({
      summary: includeSummary ? mockSummary(rows) : null,
      rows: { items: rows.slice(start, start + pageSize), totalCount: rows.length, pageNumber, pageSize },
    }), 450))
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (!includeSummary) params.set('includeSummary', 'false')
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate) params.set('toDate', filters.toDate)
  if (filters.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters.applicationGuid) params.set('applicationGuid', filters.applicationGuid)
  filters.receiptBookGuids?.forEach(g => params.append('receiptBookGuids', g))
  filters.ledgerGuids?.forEach(g => params.append('ledgerGuids', g))
  return apiGet<TransactionReportPreview>(`/api/v1/finance/reports/transaction/preview?${params.toString()}`)
}

// POST /finance/reports/transaction/export (202). The same filters the
// preview used, as JSON with the GUID lists as arrays. An identical export
// already running comes back as that same job.
export function exportTransactionReport(filters: TransactionReportFilters): Promise<{ job: ReportJob; message: string | null }> {
  if (MOCK_AUTH) {
    return Promise.resolve({ job: mockQueueReportJob('TRANSACTION', 'Transaction Report'), message: 'Export started. You will be notified when it is ready to download.' })
  }
  const body = {
    fromDate: filters.fromDate ?? null,
    toDate: filters.toDate ?? null,
    intakeGuid: filters.intakeGuid ?? null,
    applicationGuid: filters.applicationGuid ?? null,
    receiptBookGuids: filters.receiptBookGuids ?? [],
    ledgerGuids: filters.ledgerGuids ?? [],
  }
  return apiPostWithMessage<Parameters<typeof normalizeReportJob>[0]>('/api/v1/finance/reports/transaction/export', body)
    .then(({ data, message }) => ({ job: normalizeReportJob(data), message }))
}
