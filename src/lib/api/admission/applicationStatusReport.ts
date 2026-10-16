import { apiGet, apiPostWithMessage } from '../client'
import { mockQueueReportJob, normalizeReportJob, type ReportJob } from '../finance/discountReport'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Application Status Report (erp-docs/pages/admission/application-status-report-page.md).
// Docs: academic-service/admission/reports/get-application-status-report-preview.md
// and post-application-status-report-export.md. Report jobs / Downloads are
// shared with the other report pages (discountReport.ts, lib/reportDownloads.ts).

// ── Stages ─────────────────────────────────────────────────────────────────

// Fixed list, pipeline order (no dropdown API). Sent as numbers.
export const APPLICATION_STAGES = [
  { value: 1, label: 'Payment received' },
  { value: 2, label: 'Application in progress' },
  { value: 3, label: 'Waiting' },
  { value: 4, label: 'Vetting' },
  { value: 5, label: 'Registrar desk' },
  { value: 6, label: 'Rejected' },
  { value: 7, label: 'Registered' },
] as const
export const STAGE_IN_PROGRESS = 2

// ── Filters ────────────────────────────────────────────────────────────────

// Intake is required (1–50); everything else optional. Saved on Process and
// reused for every later page and the export.
export interface ApplicationStatusReportFilters {
  intakeGuids: string[]
  fromDate?: string        // yyyy-mm-dd, payment date, inclusive
  toDate?: string          // yyyy-mm-dd, inclusive
  stages?: number[]        // 1–7
  campusGuids?: string[]   // max 50
  programGuids?: string[]  // max 200
}

export const APP_STATUS_MAX_INTAKES = 50
export const APP_STATUS_MAX_CAMPUSES = 50
export const APP_STATUS_MAX_PROGRAMMES = 200
export const APP_STATUS_PAGE_SIZE = 15
export const NOT_ASSIGNED = 'Not assigned'

// ── Preview ────────────────────────────────────────────────────────────────

export interface ApplicationStatusRow {
  applicationGuid: string | null   // null at stage 1 (no form yet)
  appRefNo: string
  paymentDate: string | null       // null when there's no payment record
  paymentMode: string | null       // Paid / Exempted
  amountUgx: number | null
  studentName: string
  phone: string | null
  email: string | null
  intakeName: string | null
  campusName: string | null
  programName: string | null
  stage: number                    // 0 = Unknown (unexpected status)
  stageName: string
  formStep: string | null          // stage 2 only
  advisorGuid: string | null
  assignedTo: string               // "Not assigned" / "Unknown employee"
  registrarActionDate: string | null
  registrarRemarks: string | null
  provisionalLetterSent: boolean
}

export interface ApplicationStageCount { stage: number; stageName: string; count: number }

export interface ApplicationStatusSummary {
  totalApplicants: number
  // Every stage in pipeline order (zeros included), or only the selected
  // stages when `stages` was sent.
  byStage: ApplicationStageCount[]
}

export interface ApplicationStatusPreview {
  summary: ApplicationStatusSummary | null   // null when includeSummary=false
  rows: { items: ApplicationStatusRow[]; totalCount: number; pageNumber: number; pageSize: number }
}

// ── Mocks ──────────────────────────────────────────────────────────────────

const MOCK_NAMES = ['JOHN OKELLO', 'SARAH NALULE', 'AMINA NAKATO', 'BRIAN KAMYA', 'GRACE NAMPIJJA', 'PETER SSEMWOGERERE']
const MOCK_STEPS = ['General details', 'Qualifications', 'Documents', 'Photo']
const MOCK_ROWS: ApplicationStatusRow[] = Array.from({ length: 40 }, (_, i) => {
  const stage = [7, 7, 7, 5, 4, 2, 7, 1, 3, 6][i % 10]
  const day = new Date(Date.UTC(2026, 9, 1 - Math.floor(i / 2)))
  const assigned = i % 3 === 0
  return {
    applicationGuid: stage === 1 ? null : `mock-app-${i}`,
    appRefNo: `APP20262/${1103 - i}`,
    paymentDate: `${day.toISOString().slice(0, 10)}T00:00:00`,
    paymentMode: i % 7 === 0 ? 'Exempted' : 'Paid',
    amountUgx: i % 7 === 0 ? 0 : 50000,
    studentName: MOCK_NAMES[i % MOCK_NAMES.length],
    phone: `07000000${String(i).padStart(2, '0')}`,
    email: `applicant${i}@example.com`,
    intakeName: 'Fall 2026',
    campusName: i % 2 ? 'ISBAT University - Main Campus' : 'ISBAT University - City Campus',
    programName: i % 2 ? 'Bachelor of Science in Applied Information Technology - S22' : 'Higher Education Certificate - F24',
    stage,
    stageName: APPLICATION_STAGES.find(s => s.value === stage)?.label ?? 'Unknown',
    formStep: stage === 2 ? MOCK_STEPS[i % MOCK_STEPS.length] : null,
    advisorGuid: assigned ? 'mock-emp-1' : null,
    assignedTo: assigned ? 'A JOAN' : NOT_ASSIGNED,
    registrarActionDate: stage >= 3 ? `${day.toISOString().slice(0, 10)}T00:00:00` : null,
    registrarRemarks: stage === 6 ? 'Documents incomplete' : null,
    provisionalLetterSent: stage >= 5,
  }
})

// ── Endpoints ──────────────────────────────────────────────────────────────

// GET /admissions/reports/application-status/preview. Page 1 with the
// summary; every later page passes includeSummary=false. Arrays are repeated
// keys (?stages=4&stages=5).
export function getApplicationStatusPreview(filters: ApplicationStatusReportFilters, pageNumber: number, pageSize = APP_STATUS_PAGE_SIZE): Promise<ApplicationStatusPreview> {
  const includeSummary = pageNumber === 1
  if (MOCK_AUTH) {
    const rows = MOCK_ROWS.filter(r =>
      (!filters.stages?.length || filters.stages.includes(r.stage))
      && (!filters.fromDate || (r.paymentDate != null && r.paymentDate.slice(0, 10) >= filters.fromDate))
      && (!filters.toDate || (r.paymentDate != null && r.paymentDate.slice(0, 10) <= filters.toDate)))
    const start = (pageNumber - 1) * pageSize
    const shown = filters.stages?.length ? APPLICATION_STAGES.filter(s => filters.stages!.includes(s.value)) : APPLICATION_STAGES
    return new Promise(resolve => setTimeout(() => resolve({
      summary: includeSummary
        ? { totalApplicants: rows.length, byStage: shown.map(s => ({ stage: s.value, stageName: s.label, count: rows.filter(r => r.stage === s.value).length })) }
        : null,
      rows: { items: rows.slice(start, start + pageSize), totalCount: rows.length, pageNumber, pageSize },
    }), 600))
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (!includeSummary) params.set('includeSummary', 'false')
  filters.intakeGuids.forEach(g => params.append('intakeGuids', g))
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate) params.set('toDate', filters.toDate)
  filters.stages?.forEach(s => params.append('stages', String(s)))
  filters.campusGuids?.forEach(g => params.append('campusGuids', g))
  filters.programGuids?.forEach(g => params.append('programGuids', g))
  return apiGet<ApplicationStatusPreview>(`/api/v1/admissions/reports/application-status/preview?${params.toString()}`)
}

// POST /admissions/reports/application-status/export (202). Same filters as
// the preview, as JSON: each multi-select an array (null when empty), stages
// as numbers.
export function exportApplicationStatusReport(filters: ApplicationStatusReportFilters): Promise<{ job: ReportJob; message: string | null }> {
  if (MOCK_AUTH) {
    return Promise.resolve({ job: mockQueueReportJob('APPLICATION_STATUS', 'Application Status Report'), message: 'Export started. You will be notified when it is ready to download.' })
  }
  const body = {
    intakeGuids: filters.intakeGuids,
    fromDate: filters.fromDate ?? null,
    toDate: filters.toDate ?? null,
    stages: filters.stages?.length ? filters.stages : null,
    campusGuids: filters.campusGuids?.length ? filters.campusGuids : null,
    programGuids: filters.programGuids?.length ? filters.programGuids : null,
  }
  return apiPostWithMessage<Parameters<typeof normalizeReportJob>[0]>('/api/v1/admissions/reports/application-status/export', body)
    .then(({ data, message }) => ({ job: normalizeReportJob(data), message }))
}
