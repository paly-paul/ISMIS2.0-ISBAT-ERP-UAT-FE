import { apiGet, apiPostWithMessage } from '../client'
import { mockQueueReportJob, normalizeReportJob, type ReportJob } from './discountReport'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Outstanding Report (erp-docs/pages/finance/outstanding-report-page.md).
// Docs: finance-service/reports/get-outstanding-report-preview.md and
// post-outstanding-report-export.md. Report jobs / Downloads are shared with
// the other report pages (see discountReport.ts and lib/reportDownloads.ts).

// ── Filters ────────────────────────────────────────────────────────────────

// Registration statuses (regStatuses). Preview/export default to 1, 2, 4.
export const REG_STATUS_OPTIONS = [
  { value: 1, label: 'Registered' },
  { value: 2, label: 'Yet to Register' },
  { value: 3, label: 'Dropout' },
  { value: 4, label: 'Yet to Clear' },
  { value: 5, label: 'Passout' },
] as const
export const DEFAULT_REG_STATUSES = [1, 2, 4]

// Every field optional. With no intake and no batch the server checks the
// current academic intake; a batch overrides the intake.
export interface OutstandingReportFilters {
  campusGuid?: string
  programGuid?: string
  semesterGuid?: string
  batchGuid?: string
  intakeGuid?: string          // only when not the current intake, and never with a batch
  sponsorCategoryGuid?: string
  regStatuses?: number[]       // each 1–5
  search?: string              // trimmed, max 100
}

export const OUTSTANDING_REPORT_MAX_SEARCH = 100
export const OUTSTANDING_REPORT_PAGE_SIZE = 15

// ── Preview ────────────────────────────────────────────────────────────────

export interface OutstandingAmounts {
  currencyCode: string
  fee: number                  // current semester
  paid: number
  discount: number             // booked + what would apply if paid today
  outstanding: number          // current semester
  previousOutstanding: number  // earlier semesters
  totalOutstanding: number
}

export interface OutstandingReportRow {
  studentGuid: string
  studentNumber: string        // reg no, or student number when there's none
  studentName: string
  campusCode: string
  programName: string          // the student's CURRENT programme
  semesterName: string
  semCode: number
  batchCode: string
  sponsorCategory: string      // short code such as SELF
  regStatus: number
  regStatusName: string
  // One entry per billed currency, same order on every row. An entry can be
  // all zeros when that currency is paid but another one isn't.
  amounts: OutstandingAmounts[]
}

export interface OutstandingCurrencyTotal extends OutstandingAmounts {
  // Students who owe in this currency; never add up across currencies.
  studentCount: number
}

export interface OutstandingReportSummary {
  totalStudents: number
  byCurrency: OutstandingCurrencyTotal[]
}

export interface OutstandingReportPreview {
  summary: OutstandingReportSummary | null   // null when includeSummary=false
  rows: { items: OutstandingReportRow[]; totalCount: number; pageNumber: number; pageSize: number }
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_NAMES = ['AKAMPURIRA CLEVER', 'NAKATO AMINA', 'OKELLO JAMES', 'NAMPIJJA GRACE', 'KAMYA BRIAN', 'TUMUKUNDE ESTHER']
const MOCK_PROGS = ['BSc Computer Science - S22', 'BSc Animation and Visual Effects - F25', 'BBA Accounting']
const MOCK_ROWS: OutstandingReportRow[] = Array.from({ length: 40 }, (_, i) => {
  const ugxFee = 2250000 + (i % 4) * 500000
  const ugxPaid = (i % 5) * 400000
  const ugxDisc = i % 6 === 0 ? 300000 : 0
  const ugxOut = Math.max(0, ugxFee - ugxPaid - ugxDisc)
  const ugxPrev = i % 3 === 0 ? 250000 : 0
  const amounts: OutstandingAmounts[] = [{
    currencyCode: 'UGX', fee: ugxFee, paid: ugxPaid, discount: ugxDisc, outstanding: ugxOut,
    previousOutstanding: ugxPrev, totalOutstanding: ugxOut + ugxPrev,
  }]
  if (i % 7 === 0) amounts.push({ currencyCode: 'USD', fee: 250, paid: i % 14 === 0 ? 250 : 100, discount: 0, outstanding: i % 14 === 0 ? 0 : 150, previousOutstanding: 0, totalOutstanding: i % 14 === 0 ? 0 : 150 })
  return {
    studentGuid: `mock-out-${i}`,
    studentNumber: `0122608${String(10 + i).padStart(2, '0')}`,
    studentName: MOCK_NAMES[i % MOCK_NAMES.length],
    campusCode: '01',
    programName: MOCK_PROGS[i % MOCK_PROGS.length],
    semesterName: `Year One - Semester ${(i % 2) + 1}`,
    semCode: (i % 2) + 1,
    batchCode: `BSCVFXF26D${String.fromCharCode(65 + (i % 3))}`,
    sponsorCategory: i % 4 === 0 ? 'HEC' : 'SELF',
    regStatus: [1, 2, 4][i % 3],
    regStatusName: ['Registered', 'Yet to Register', 'Yet to Clear'][i % 3],
    amounts,
  }
})

function mockFilter(f: OutstandingReportFilters): OutstandingReportRow[] {
  const term = f.search?.toLowerCase()
  const statuses = f.regStatuses?.length ? f.regStatuses : DEFAULT_REG_STATUSES
  return MOCK_ROWS.filter(r =>
    statuses.includes(r.regStatus)
    && (!term || r.studentName.toLowerCase().includes(term) || r.studentNumber.includes(term)))
}

function mockSummary(rows: OutstandingReportRow[]): OutstandingReportSummary {
  const codes = [...new Set(rows.flatMap(r => r.amounts.map(a => a.currencyCode)))].sort()
  const sum = (list: OutstandingAmounts[], k: keyof Omit<OutstandingAmounts, 'currencyCode'>) => list.reduce((s, a) => s + a[k], 0)
  return {
    totalStudents: rows.length,
    byCurrency: codes.map(code => {
      const list = rows.flatMap(r => r.amounts.filter(a => a.currencyCode === code))
      return {
        currencyCode: code,
        studentCount: list.filter(a => a.totalOutstanding > 0).length,
        fee: sum(list, 'fee'), paid: sum(list, 'paid'), discount: sum(list, 'discount'),
        outstanding: sum(list, 'outstanding'), previousOutstanding: sum(list, 'previousOutstanding'), totalOutstanding: sum(list, 'totalOutstanding'),
      }
    }),
  }
}

// ── Endpoints ──────────────────────────────────────────────────────────────

// GET /finance/reports/outstanding/preview. Page 1 with the summary; every
// later page passes includeSummary=false. Slow by design (whole scope is
// recalculated: ~7 s page 1, ~3 s after). regStatuses is a repeated key.
export function getOutstandingReportPreview(filters: OutstandingReportFilters, pageNumber: number, pageSize = OUTSTANDING_REPORT_PAGE_SIZE): Promise<OutstandingReportPreview> {
  const includeSummary = pageNumber === 1
  if (MOCK_AUTH) {
    const rows = mockFilter(filters)
    const start = (pageNumber - 1) * pageSize
    return new Promise(resolve => setTimeout(() => resolve({
      summary: includeSummary ? mockSummary(rows) : null,
      rows: { items: rows.slice(start, start + pageSize), totalCount: rows.length, pageNumber, pageSize },
    }), includeSummary ? 1200 : 700))
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (!includeSummary) params.set('includeSummary', 'false')
  if (filters.campusGuid) params.set('campusGuid', filters.campusGuid)
  if (filters.programGuid) params.set('programGuid', filters.programGuid)
  if (filters.semesterGuid) params.set('semesterGuid', filters.semesterGuid)
  if (filters.batchGuid) params.set('batchGuid', filters.batchGuid)
  if (filters.intakeGuid) params.set('intakeGuid', filters.intakeGuid)
  if (filters.sponsorCategoryGuid) params.set('sponsorCategoryGuid', filters.sponsorCategoryGuid)
  if (filters.search) params.set('search', filters.search)
  filters.regStatuses?.forEach(s => params.append('regStatuses', String(s)))
  return apiGet<OutstandingReportPreview>(`/api/v1/finance/reports/outstanding/preview?${params.toString()}`)
}

// POST /finance/reports/outstanding/export (202). Same filters as the
// preview, as JSON (regStatuses as an array). An identical export already
// running comes back as that same job.
export function exportOutstandingReport(filters: OutstandingReportFilters): Promise<{ job: ReportJob; message: string | null }> {
  if (MOCK_AUTH) {
    return Promise.resolve({ job: mockQueueReportJob('OUTSTANDING', 'Outstanding Fee Report'), message: 'Export started. You will be notified when it is ready to download.' })
  }
  const body = {
    campusGuid: filters.campusGuid ?? null,
    programGuid: filters.programGuid ?? null,
    semesterGuid: filters.semesterGuid ?? null,
    batchGuid: filters.batchGuid ?? null,
    intakeGuid: filters.intakeGuid ?? null,
    sponsorCategoryGuid: filters.sponsorCategoryGuid ?? null,
    // Left out (null) rather than [] for the default 1, 2, 4.
    regStatuses: filters.regStatuses?.length ? filters.regStatuses : null,
    search: filters.search ?? null,
  }
  return apiPostWithMessage<Parameters<typeof normalizeReportJob>[0]>('/api/v1/finance/reports/outstanding/export', body)
    .then(({ data, message }) => ({ job: normalizeReportJob(data), message }))
}
