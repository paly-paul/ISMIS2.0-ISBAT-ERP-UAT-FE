import { apiGet, apiPostWithMessage } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Discount Report (erp-docs/pages/finance/discount-report-page.md) plus the
// shared report-job endpoints behind the Downloads list. Docs:
// finance-service/reports/*.md and finance-service/discounts/get-discount-dropdown.md.

// ── Filters ────────────────────────────────────────────────────────────────

// Every field optional; empty means "everything". The page saves a copy of
// these on Process and reuses it for every later page and the export, so a
// filter edited without re-processing can't mix two reports.
export interface DiscountReportFilters {
  fromDate?: string        // yyyy-mm-dd
  toDate?: string          // yyyy-mm-dd, inclusive of the whole day
  intakeGuid?: string
  discountGuid?: string
  programGuids?: string[]  // max 50
  search?: string          // trimmed, max 100
}

export const DISCOUNT_REPORT_MAX_PROGRAMMES = 50
export const DISCOUNT_REPORT_MAX_SEARCH = 100

// ── Preview ────────────────────────────────────────────────────────────────

export interface DiscountReportRow {
  payDate: string          // calendar date, time always 00:00:00; no TZ conversion
  receipt: string
  studentNumber: string    // AppRefNo
  studentName: string
  programName: string      // the semester's programme, not the student's current one
  semesterName: string
  semCode: number
  discountName: string
  source: { value: number; name: string }   // 1 DirectPayment, 2 AdvanceAdjustment
  payMode: { value: number; name: string }  // 1 Cash, 2 Cheque, 3 Bank, 4 DemandDraft, 5 Online
  currencyCode: string
  discountAmount: number   // always positive
}

export interface DiscountReportCurrencyTotal {
  currencyCode: string
  rowCount: number
  studentCount: number
  totalDiscount: number
}

export interface DiscountReportSummary {
  totalRows: number
  // Distinct students across all rows. Never sum byCurrency[].studentCount:
  // a student paid in two currencies is counted under each.
  totalStudents: number
  byCurrency: DiscountReportCurrencyTotal[]
}

export interface DiscountReportPreview {
  summary: DiscountReportSummary | null   // null when includeSummary=false
  rows: { items: DiscountReportRow[]; totalCount: number; pageNumber: number; pageSize: number }
}

export const DISCOUNT_REPORT_PAGE_SIZE = 15

// ── Report jobs (Downloads) ────────────────────────────────────────────────

export const REPORT_STATUS = { Queued: 1, Processing: 2, Completed: 3, Failed: 4 } as const

export interface ReportJob {
  reportJobGuid: string
  reportType: string
  reportName: string
  status: { value: number; name: string }
  isExpired: boolean
  fileName: string | null
  fileSizeBytes: number | null
  rowCount: number | null
  errorMessage: string | null
  // UTC. GET /notifications/reports sends a trailing Z; older values may not
  // have one — parseUtcNoZ handles both.
  requestedAt: string
  completedAt: string | null
  expiresAt: string | null
}

// GET /notifications/reports and every export's 202 send `status` as a plain
// number plus `statusName` (get-reports.md), not the { value, name } object
// ReportJob keeps. Normalised here so the Downloads list and the report pages
// read one shape; an object, if a response still sends one, passes through.
type RawReportJob = Partial<Omit<ReportJob, 'status'>> & {
  reportJobGuid: string
  status: number | { value: number; name: string }
  statusName?: string
}
export function normalizeReportJob(raw: RawReportJob): ReportJob {
  const status = typeof raw.status === 'number' ? { value: raw.status, name: raw.statusName ?? '' } : raw.status
  return {
    reportJobGuid: raw.reportJobGuid,
    reportType: raw.reportType ?? '',
    reportName: raw.reportName ?? '',
    status,
    isExpired: raw.isExpired ?? false,
    fileName: raw.fileName ?? null,
    fileSizeBytes: raw.fileSizeBytes ?? null,
    rowCount: raw.rowCount ?? null,
    errorMessage: raw.errorMessage ?? null,
    requestedAt: raw.requestedAt ?? new Date().toISOString(),
    completedAt: raw.completedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
  }
}

export interface ReportDownloadLink {
  url: string
  fileName: string
  expiresAtUtc: string
}

// Job dates come back as UTC with no "Z"; new Date() would read them as
// local time and show them 3 hours early in Uganda.
export function parseUtcNoZ(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

// Local-development quirk (get-report-job-download.md): the Local storage
// provider can hand back http://localhost:44310/… although that port is
// HTTPS-only. Deployed S3 links are untouched.
export function fixLocalDownloadUrl(url: string): string {
  return url.replace(/^http:\/\/localhost:44310\//, 'https://localhost:44310/')
}

// ── Discount dropdown ──────────────────────────────────────────────────────

export interface DiscountDropdownItem {
  discountGuid: string
  discountCode: string
  discountName: string
  calcType: number
  amtPer: number
  cop: number | null
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDiscounts: DiscountDropdownItem[] = [
  { discountGuid: 'mock-disc-staff', discountCode: 'STAFF20', discountName: 'Staff Child 20%', calcType: 2, amtPer: 20, cop: null },
  { discountGuid: 'mock-disc-lump', discountCode: 'LUMP', discountName: 'Lumpsum', calcType: 1, amtPer: 0, cop: null },
  { discountGuid: 'mock-disc-sib', discountCode: 'SIB10', discountName: 'Sibling 10%', calcType: 2, amtPer: 10, cop: null },
]

const MOCK_NAMES = ['Amina Nakato', 'James Okello', 'Grace Nampijja', 'Brian Kamya', 'Esther Tumukunde', 'Peter Ssemwogerere', 'Ruth Achieng', 'Daniel Mugisha']
const MOCK_PROGS = ['BSc Computer Science', 'MBA Business Administration', 'BBA Accounting', 'Diploma in Nursing']
const MOCK_ROWS: DiscountReportRow[] = Array.from({ length: 64 }, (_, i) => {
  const usd = i % 9 === 0
  const discount = mockDiscounts[i % mockDiscounts.length]
  const day = new Date(Date.UTC(2026, 8, 30 - Math.floor(i / 3)))
  const sem = (i % 6) + 1
  return {
    payDate: `${day.toISOString().slice(0, 10)}T00:00:00`,
    receipt: String(169300 - i),
    studentNumber: `APP/2026/${String(1800 + (i % 40)).padStart(5, '0')}`,
    studentName: MOCK_NAMES[i % MOCK_NAMES.length],
    programName: MOCK_PROGS[i % MOCK_PROGS.length],
    semesterName: `Semester ${sem}`,
    semCode: sem,
    discountName: i === 17 ? 'Unknown discount' : discount.discountName,
    source: i % 5 === 0 ? { value: 2, name: 'AdvanceAdjustment' } : { value: 1, name: 'DirectPayment' },
    payMode: [{ value: 1, name: 'Cash' }, { value: 3, name: 'Bank' }, { value: 5, name: 'Online' }][i % 3],
    currencyCode: usd ? 'USD' : 'UGX',
    discountAmount: usd ? 120 + (i % 4) * 35 : 150000 + (i % 7) * 75000,
  }
})

let mockJobs: ReportJob[] = [
  {
    reportJobGuid: 'mock-job-done', reportType: 'DISCOUNT', reportName: 'Discount Report - 09 Oct 2026, 16:45',
    status: { value: 3, name: 'Completed' }, isExpired: false, fileName: 'Discount_Report_20261009_1645.xlsx',
    fileSizeBytes: 223_418, rowCount: 3716, errorMessage: null,
    requestedAt: '2026-10-09T13:45:02', completedAt: '2026-10-09T13:45:11', expiresAt: '2026-11-08T13:45:11',
  },
  {
    reportJobGuid: 'mock-job-old', reportType: 'DISCOUNT', reportName: 'Discount Report - 02 Sep 2026, 09:01',
    status: { value: 3, name: 'Completed' }, isExpired: true, fileName: 'Discount_Report_20260902_0901.xlsx',
    fileSizeBytes: 198_002, rowCount: 3120, errorMessage: null,
    requestedAt: '2026-09-02T06:01:00', completedAt: '2026-09-02T06:01:09', expiresAt: '2026-10-02T06:01:09',
  },
]

function mockFilter(f: DiscountReportFilters): DiscountReportRow[] {
  const term = f.search?.toLowerCase()
  const discountName = f.discountGuid ? mockDiscounts.find(d => d.discountGuid === f.discountGuid)?.discountName : undefined
  return MOCK_ROWS.filter(r =>
    (!f.fromDate || r.payDate.slice(0, 10) >= f.fromDate)
    && (!f.toDate || r.payDate.slice(0, 10) <= f.toDate)
    && (!discountName || r.discountName === discountName)
    && (!term || r.studentName.toLowerCase().includes(term) || r.studentNumber.toLowerCase() === term))
}

// ── Endpoints ──────────────────────────────────────────────────────────────

function appendFilterParams(params: URLSearchParams, f: DiscountReportFilters) {
  if (f.fromDate) params.set('fromDate', f.fromDate)
  if (f.toDate) params.set('toDate', f.toDate)
  if (f.intakeGuid) params.set('intakeGuid', f.intakeGuid)
  if (f.discountGuid) params.set('discountGuid', f.discountGuid)
  if (f.search) params.set('search', f.search)
  // Repeated key, not a comma list: ?programGuids=a&programGuids=b
  f.programGuids?.forEach(g => params.append('programGuids', g))
}

// GET /finance/reports/discount/preview. Page 1 with the summary; every
// later page passes includeSummary=false (summary comes back null).
export function getDiscountReportPreview(filters: DiscountReportFilters, pageNumber: number, pageSize = DISCOUNT_REPORT_PAGE_SIZE): Promise<DiscountReportPreview> {
  const includeSummary = pageNumber === 1
  if (MOCK_AUTH) {
    const rows = mockFilter(filters)
    const start = (pageNumber - 1) * pageSize
    const currencies = [...new Set(rows.map(r => r.currencyCode))]
    const summary: DiscountReportSummary = {
      totalRows: rows.length,
      totalStudents: new Set(rows.map(r => r.studentNumber)).size,
      byCurrency: currencies.map(code => {
        const inCur = rows.filter(r => r.currencyCode === code)
        return { currencyCode: code, rowCount: inCur.length, studentCount: new Set(inCur.map(r => r.studentNumber)).size, totalDiscount: inCur.reduce((s, r) => s + r.discountAmount, 0) }
      }),
    }
    return new Promise(resolve => setTimeout(() => resolve({
      summary: includeSummary ? summary : null,
      rows: { items: rows.slice(start, start + pageSize), totalCount: rows.length, pageNumber, pageSize },
    }), 450))
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (!includeSummary) params.set('includeSummary', 'false')
  appendFilterParams(params, filters)
  return apiGet<DiscountReportPreview>(`/api/v1/finance/reports/discount/preview?${params.toString()}`)
}

// POST /finance/reports/discount/export (202). The same filters the preview
// used, as JSON (programGuids as an array). An identical export already
// running comes back as that same job, with its own message.
export function exportDiscountReport(filters: DiscountReportFilters): Promise<{ job: ReportJob; message: string | null }> {
  if (MOCK_AUTH) {
    const now = new Date()
    const job: ReportJob = {
      reportJobGuid: `mock-job-${now.getTime()}`, reportType: 'DISCOUNT',
      reportName: `Discount Report - ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toTimeString().slice(0, 5)}`,
      status: { value: 1, name: 'Queued' }, isExpired: false, fileName: null, fileSizeBytes: null, rowCount: null, errorMessage: null,
      requestedAt: now.toISOString().replace('Z', ''), completedAt: null, expiresAt: null,
    }
    mockJobs = [job, ...mockJobs]
    return Promise.resolve({ job, message: 'Export started. You will be notified when it is ready to download.' })
  }
  const body = {
    fromDate: filters.fromDate ?? null,
    toDate: filters.toDate ?? null,
    intakeGuid: filters.intakeGuid ?? null,
    programGuids: filters.programGuids ?? [],
    discountGuid: filters.discountGuid ?? null,
    search: filters.search ?? null,
  }
  return apiPostWithMessage<RawReportJob>('/api/v1/finance/reports/discount/export', body)
    .then(({ data, message }) => ({ job: normalizeReportJob(data), message }))
}

// Mock-mode stand-in for any report's export 202, shared by the Transaction
// and Outstanding report modules so the Downloads list shows them too.
export function mockQueueReportJob(reportType: string, title: string): ReportJob {
  const now = new Date()
  const job: ReportJob = {
    reportJobGuid: `mock-job-${now.getTime()}`, reportType,
    reportName: `${title} - ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toTimeString().slice(0, 5)}`,
    status: { value: 1, name: 'Queued' }, isExpired: false, fileName: null, fileSizeBytes: null, rowCount: null, errorMessage: null,
    requestedAt: now.toISOString(), completedAt: null, expiresAt: null,
  }
  mockJobs = [job, ...mockJobs]
  return job
}

// GET /notifications/reports (get-reports.md) — the signed-in user's own
// exports from EVERY report page and service, newest first. Replaced
// GET /finance/reports/jobs, which was removed on 2026-10-13.
export function getReportJobs(pageNumber = 1, pageSize = 15): Promise<{ items: ReportJob[]; totalCount: number }> {
  if (MOCK_AUTH) return Promise.resolve({ items: mockJobs, totalCount: mockJobs.length })
  return apiGet<{ items: RawReportJob[]; totalCount: number } | null>(`/api/v1/notifications/reports?pageNumber=${pageNumber}&pageSize=${pageSize}`)
    .then(data => ({ items: (data?.items ?? []).map(normalizeReportJob), totalCount: data?.totalCount ?? 0 }))
}

// GET /notifications/reports/{guid}/download (get-report-download.md) — a
// fresh, ~10-minute link. Fetch one per click; never store it. Same response
// as the removed /finance/reports/jobs/{guid}/download.
export function getReportJobDownload(reportJobGuid: string): Promise<ReportDownloadLink> {
  if (MOCK_AUTH) {
    const job = mockJobs.find(j => j.reportJobGuid === reportJobGuid)
    return Promise.resolve({ url: '#', fileName: job?.fileName ?? 'report.xlsx', expiresAtUtc: new Date(Date.now() + 600_000).toISOString() })
  }
  return apiGet<ReportDownloadLink>(`/api/v1/notifications/reports/${reportJobGuid}/download`)
}

// GET /finance/discounts/dropdown — deleted discounts aren't listed.
export function getDiscountDropdown(): Promise<DiscountDropdownItem[]> {
  if (MOCK_AUTH) return Promise.resolve(mockDiscounts)
  return apiGet<DiscountDropdownItem[] | null>('/api/v1/finance/discounts/dropdown').then(data => data ?? [])
}
