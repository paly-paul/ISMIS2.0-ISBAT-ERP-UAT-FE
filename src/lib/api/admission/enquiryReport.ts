import { apiGet, apiPostWithMessage } from '../client'
import { mockQueueReportJob, normalizeReportJob, type ReportJob } from '../finance/discountReport'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Enquiry Report (erp-docs/pages/admission/enquiry-report-page.md). Docs:
// academic-service/admission/reports/get-enquiry-report-preview.md and
// post-enquiry-report-export.md. Report jobs / Downloads are shared with the
// finance report pages (see discountReport.ts and lib/reportDownloads.ts).

// ── Filters ────────────────────────────────────────────────────────────────

// Intake is required (1–50); everything else optional. Saved on Process and
// reused for every later page and the export.
export interface EnquiryReportFilters {
  intakeGuids: string[]
  fromDate?: string              // yyyy-mm-dd, enquiry date, inclusive
  toDate?: string                // yyyy-mm-dd, inclusive
  enquiryStatusGuids?: string[]  // max 50
  followUpStatusGuids?: string[] // max 50
  advisorGuids?: string[]        // "Assigned to", employeeGuid, max 200
}

export const ENQUIRY_REPORT_MAX_INTAKES = 50
export const ENQUIRY_REPORT_MAX_STATUSES = 50
export const ENQUIRY_REPORT_MAX_ADVISORS = 200
export const ENQUIRY_REPORT_PAGE_SIZE = 15
export const NOT_ASSIGNED = 'Not assigned'

// ── Preview ────────────────────────────────────────────────────────────────

export interface EnquiryReportRow {
  enquiryGuid: string
  enquiryCode: string
  enquiryDate: string            // calendar date, time 00:00:00
  intakeName: string | null
  campusName: string | null
  programName: string | null
  studentName: string
  gender: string | null          // Male / Female / Other
  dob: string | null
  mobile: string | null
  email: string | null
  countryName: string | null
  enquirySourceName: string | null
  isbatSourceName: string | null
  sourceName: string | null
  enquiryTag: string | null
  advisorGuid: string | null
  // "Not assigned" when advisorGuid is null; "Unknown employee" when the
  // employee can no longer be found.
  assignedTo: string
  enquiryStatusName: string | null
  followUpStatusName: string | null
  nextFollowDate: string | null
  remarks: string | null
  sponsorName: string | null
  sponsorPhone: string | null
  sponsorEmail: string | null
  emailVerified: boolean
  createdDate: string
}

export interface EnquiryReportSummary {
  totalEnquiries: number
  assignedCount: number
  notAssignedCount: number
}

export interface EnquiryReportPreview {
  summary: EnquiryReportSummary | null   // null when includeSummary=false
  rows: { items: EnquiryReportRow[]; totalCount: number; pageNumber: number; pageSize: number }
}

// ── Filter dropdowns ───────────────────────────────────────────────────────

export interface EnquiryStatusOption { enquiryStatusGuid: string; enquiryStatusName: string; enquiryStatusCode: string }
export interface FollowUpStatusOption { followUpStatusGuid: string; followUpStatusName: string; followUpStatusCode: string; isClose: number }

// GET /admissions/enquiry-statuses/dropdown (get-enquiry-status-dropdown.md).
export function getEnquiryStatusDropdown(): Promise<EnquiryStatusOption[]> {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { enquiryStatusGuid: 'mock-es-close', enquiryStatusName: 'Close', enquiryStatusCode: 'CLS' },
      { enquiryStatusGuid: 'mock-es-reg', enquiryStatusName: 'Registered', enquiryStatusCode: 'REG' },
      { enquiryStatusGuid: 'mock-es-next', enquiryStatusName: 'Required Next Follow Up', enquiryStatusCode: 'RNF' },
    ])
  }
  return apiGet<EnquiryStatusOption[] | null>('/api/v1/admissions/enquiry-statuses/dropdown').then(d => d ?? [])
}

// GET /admissions/follow-up-statuses/dropdown (get-follow-up-status-dropdown.md).
export function getFollowUpStatusDropdown(): Promise<FollowUpStatusOption[]> {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { followUpStatusGuid: 'mock-fs-cb', followUpStatusName: 'Call Back', followUpStatusCode: 'CB', isClose: 0 },
      { followUpStatusGuid: 'mock-fs-en', followUpStatusName: 'Enrolled', followUpStatusCode: 'EN', isClose: 1 },
      { followUpStatusGuid: 'mock-fs-na', followUpStatusName: 'Not Answering', followUpStatusCode: 'NA', isClose: 0 },
    ])
  }
  return apiGet<FollowUpStatusOption[] | null>('/api/v1/admissions/follow-up-statuses/dropdown').then(d => d ?? [])
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_NAMES = ['JOHN OKELLO', 'SARAH NALULE', 'AMINA NAKATO', 'BRIAN KAMYA', 'GRACE NAMPIJJA', 'PETER SSEMWOGERERE']
const MOCK_ROWS: EnquiryReportRow[] = Array.from({ length: 45 }, (_, i) => {
  const assigned = i % 4 === 0
  const day = new Date(Date.UTC(2025, 8, 2 - Math.floor(i / 3)))
  return {
    enquiryGuid: `mock-enq-${i}`,
    enquiryCode: `EQ20252/${11113 - i}`,
    enquiryDate: `${day.toISOString().slice(0, 10)}T00:00:00`,
    intakeName: 'Fall 2025',
    campusName: i % 2 ? 'ISBAT University - Main Campus' : 'ISBAT University - City Campus',
    programName: i % 2 ? 'Bachelor of Medical Imaging Technology - F22' : 'Professional Certificate in Software Engineering-F21',
    studentName: MOCK_NAMES[i % MOCK_NAMES.length],
    gender: i % 3 ? 'Male' : null,
    dob: '2007-08-08T00:00:00',
    mobile: `07000000${String(i).padStart(2, '0')}`,
    email: `student${i}@example.com`,
    countryName: 'Uganda',
    enquirySourceName: i % 2 ? 'Direct' : 'FrontDesk',
    isbatSourceName: 'Referral',
    sourceName: null,
    enquiryTag: null,
    advisorGuid: assigned ? 'mock-emp-1' : null,
    assignedTo: assigned ? 'A JOAN' : NOT_ASSIGNED,
    enquiryStatusName: assigned ? 'Registered' : null,
    followUpStatusName: assigned ? 'Enrolled' : null,
    nextFollowDate: assigned ? `${day.toISOString().slice(0, 10)}T00:00:00` : null,
    remarks: null, sponsorName: null, sponsorPhone: null, sponsorEmail: null,
    emailVerified: false,
    createdDate: '2026-10-11T18:39:14.463',
  }
})

// ── Endpoints ──────────────────────────────────────────────────────────────

// GET /admissions/reports/enquiry/preview. Page 1 with the summary; every
// later page passes includeSummary=false. Arrays are repeated keys.
export function getEnquiryReportPreview(filters: EnquiryReportFilters, pageNumber: number, pageSize = ENQUIRY_REPORT_PAGE_SIZE): Promise<EnquiryReportPreview> {
  const includeSummary = pageNumber === 1
  if (MOCK_AUTH) {
    const rows = MOCK_ROWS.filter(r =>
      (!filters.fromDate || r.enquiryDate.slice(0, 10) >= filters.fromDate)
      && (!filters.toDate || r.enquiryDate.slice(0, 10) <= filters.toDate)
      && (!filters.advisorGuids?.length || (r.advisorGuid != null && filters.advisorGuids.includes(r.advisorGuid))))
    const start = (pageNumber - 1) * pageSize
    const assignedCount = rows.filter(r => r.advisorGuid).length
    return new Promise(resolve => setTimeout(() => resolve({
      summary: includeSummary ? { totalEnquiries: rows.length, assignedCount, notAssignedCount: rows.length - assignedCount } : null,
      rows: { items: rows.slice(start, start + pageSize), totalCount: rows.length, pageNumber, pageSize },
    }), 600))
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (!includeSummary) params.set('includeSummary', 'false')
  filters.intakeGuids.forEach(g => params.append('intakeGuids', g))
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate) params.set('toDate', filters.toDate)
  filters.enquiryStatusGuids?.forEach(g => params.append('enquiryStatusGuids', g))
  filters.followUpStatusGuids?.forEach(g => params.append('followUpStatusGuids', g))
  filters.advisorGuids?.forEach(g => params.append('advisorGuids', g))
  return apiGet<EnquiryReportPreview>(`/api/v1/admissions/reports/enquiry/preview?${params.toString()}`)
}

// POST /admissions/reports/enquiry/export (202). Same filters as the
// preview, as JSON with each multi-select as an array (null when empty).
export function exportEnquiryReport(filters: EnquiryReportFilters): Promise<{ job: ReportJob; message: string | null }> {
  if (MOCK_AUTH) {
    return Promise.resolve({ job: mockQueueReportJob('ENQUIRY', 'Enquiry Report'), message: 'Export started. You will be notified when it is ready to download.' })
  }
  const body = {
    intakeGuids: filters.intakeGuids,
    fromDate: filters.fromDate ?? null,
    toDate: filters.toDate ?? null,
    enquiryStatusGuids: filters.enquiryStatusGuids?.length ? filters.enquiryStatusGuids : null,
    followUpStatusGuids: filters.followUpStatusGuids?.length ? filters.followUpStatusGuids : null,
    advisorGuids: filters.advisorGuids?.length ? filters.advisorGuids : null,
  }
  return apiPostWithMessage<Parameters<typeof normalizeReportJob>[0]>('/api/v1/admissions/reports/enquiry/export', body)
    .then(({ data, message }) => ({ job: normalizeReportJob(data), message }))
}
