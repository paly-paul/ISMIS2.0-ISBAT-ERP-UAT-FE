import { apiGet, apiPostForm, AuthError } from '../client'
import { PagedResult } from './student'
import { searchStudentsAdvanced, StudentSearchFilters } from './studentSearch'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Bulk email (userrole-service Notifications) — per student-bulk-email-page.md
// (2026-09-28). The per-endpoint docs it links (api/userrole-service/
// bulk-email/*.md) aren't available locally, so the DTO field names below are
// taken from that page doc's column/field tables rather than a JSON sample.
//
// Sending is a background job: POST returns straight away with a jobGuid, and
// the list/detail endpoints are polled for progress while a job is running.

export const JOB_STATUSES = ['Draft', 'Resolving', 'Processing', 'Completed', 'PartiallyFailed', 'Failed'] as const
export type BulkEmailJobStatus = typeof JOB_STATUSES[number]

export const RECIPIENT_STATUSES = ['Queued', 'Sending', 'Sent', 'Failed', 'Suppressed'] as const
export type BulkEmailRecipientStatus = typeof RECIPIENT_STATUSES[number]

// Draft/Resolving/Processing mean the job is still running and the page
// should keep polling; the other three are final.
export function isJobActive(status: BulkEmailJobStatus | null | undefined): boolean {
  return status === 'Draft' || status === 'Resolving' || status === 'Processing'
}

// The page doc names the statuses but doesn't say whether the wire value is
// the enum name or its number. Names are the documented form (the ?status=
// filter takes them); a number is mapped by the documented order as a
// fallback — unconfirmed, flagged here rather than silently assumed.
function toJobStatus(raw: unknown): BulkEmailJobStatus {
  if (typeof raw === 'number') return JOB_STATUSES[raw] ?? 'Draft'
  return (JOB_STATUSES as readonly string[]).includes(raw as string) ? raw as BulkEmailJobStatus : 'Draft'
}

function toRecipientStatus(raw: unknown): BulkEmailRecipientStatus {
  if (typeof raw === 'number') return RECIPIENT_STATUSES[raw] ?? 'Queued'
  return (RECIPIENT_STATUSES as readonly string[]).includes(raw as string) ? raw as BulkEmailRecipientStatus : 'Queued'
}

export interface BulkEmailJobDto {
  jobGuid: string
  subject: string
  status: BulkEmailJobStatus
  // 0 until recipient resolution finishes (Draft/Resolving).
  totalRecipients: number
  sentCount: number
  failedCount: number
  suppressedCount: number
  hasAttachment: boolean
  createdDate: string
  startedDate: string | null
  completedDate: string | null
}

export interface BulkEmailJobDetailDto extends BulkEmailJobDto {
  bodyHtml: string
  pendingCount: number
  // Only set when recipient resolution itself failed (e.g. the Students
  // service was unreachable) — never for per-recipient send errors.
  lastError: string | null
  attachmentFileName: string | null
}

export interface BulkEmailRecipientDto {
  // The student GUID for student recipients.
  recipientGuid: string
  toEmail: string
  status: BulkEmailRecipientStatus
  attempts: number
  // A Queued row can still carry the error from its previous attempt.
  lastError: string | null
  processedDate: string | null
}

export interface BulkEmailListParams {
  page: number
  size: number
  status?: BulkEmailJobStatus | null
  search?: string
  // ISO 8601. Callers send `to` as end of day, or jobs created that day are
  // left out.
  from?: string | null
  to?: string | null
}

export interface BulkEmailRecipientParams {
  page: number
  size: number
  status?: BulkEmailRecipientStatus | null
  search?: string
}

export interface SendBulkEmailInput {
  subject: string
  // HTML from the rich-text editor. Sent as the multipart field `body`, not
  // `bodyHtml`.
  body: string
  studentGuids: string[]
  file?: File | null
}

export interface SendBulkEmailResult {
  jobGuid: string
  // Distinct student GUIDs accepted — can be higher than the job's eventual
  // totalRecipients, which only counts students that resolved to an email.
  selectedRecipients: number
}

// Documented limits, enforced client-side before sending.
export const MAX_RECIPIENTS = 10_000
export const MAX_SUBJECT_LENGTH = 998
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx'
export const ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// Student search result as the live POST /students/search/search returns it
// (confirmed via a real response, 2026-09-28) — richer than StudentDto.
// emailId is the application's email, which is the address bulk email uses.
export interface StudentSearchResultDto {
  studentGuid: string
  studentRegNo: string
  studentNum: string
  studentName: string
  programCode: string | null
  batchCode: string | null
  semName: string | null
  schoolName: string | null
  campusName: string | null
  emailId: string | null
}

function normaliseJob(raw: any): BulkEmailJobDto {
  return {
    jobGuid: raw.jobGuid,
    subject: raw.subject ?? '',
    status: toJobStatus(raw.status),
    totalRecipients: raw.totalRecipients ?? 0,
    sentCount: raw.sentCount ?? 0,
    failedCount: raw.failedCount ?? 0,
    suppressedCount: raw.suppressedCount ?? 0,
    hasAttachment: !!raw.hasAttachment,
    createdDate: raw.createdDate,
    startedDate: raw.startedDate ?? null,
    completedDate: raw.completedDate ?? null,
  }
}

function normaliseJobDetail(raw: any): BulkEmailJobDetailDto {
  const job = normaliseJob(raw)
  return {
    ...job,
    hasAttachment: job.hasAttachment || !!raw.attachmentFileName,
    bodyHtml: raw.bodyHtml ?? '',
    pendingCount: raw.pendingCount ?? Math.max(0, job.totalRecipients - job.sentCount - job.failedCount - job.suppressedCount),
    lastError: raw.lastError ?? null,
    attachmentFileName: raw.attachmentFileName ?? null,
  }
}

function normaliseRecipient(raw: any): BulkEmailRecipientDto {
  return {
    recipientGuid: raw.recipientGuid,
    toEmail: raw.toEmail ?? '',
    status: toRecipientStatus(raw.status),
    attempts: raw.attempts ?? 0,
    lastError: raw.lastError ?? null,
    processedDate: raw.processedDate ?? null,
  }
}

function emptyPage<T>(page: number, size: number): PagedResult<T> {
  return { items: [], totalCount: 0, pageNumber: page, pageSize: size }
}

export function getBulkEmails(params: BulkEmailListParams): Promise<PagedResult<BulkEmailJobDto>> {
  if (MOCK_AUTH) return Promise.resolve(mockList(params))
  const q = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.status) q.set('status', params.status)
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  return apiGet<PagedResult<any> | null>(`/api/v1/notifications/bulk-email?${q.toString()}`)
    .then(data => data ? { ...data, items: (data.items ?? []).map(normaliseJob) } : emptyPage(params.page, params.size))
}

export function getBulkEmail(jobGuid: string): Promise<BulkEmailJobDetailDto> {
  if (MOCK_AUTH) {
    const job = mockJobs.find(j => j.jobGuid === jobGuid)
    if (!job) return Promise.reject(new AuthError('not_found', 'This bulk email was not found.'))
    return Promise.resolve(mockDetail(job))
  }
  return apiGet<any>(`/api/v1/notifications/bulk-email/${jobGuid}`).then(normaliseJobDetail)
}

export function getBulkEmailRecipients(jobGuid: string, params: BulkEmailRecipientParams): Promise<PagedResult<BulkEmailRecipientDto>> {
  if (MOCK_AUTH) {
    const job = mockJobs.find(j => j.jobGuid === jobGuid)
    if (!job) return Promise.reject(new AuthError('not_found', 'This bulk email was not found.'))
    return Promise.resolve(mockRecipients(job, params))
  }
  const q = new URLSearchParams({ page: String(params.page), size: String(params.size) })
  if (params.status) q.set('status', params.status)
  if (params.search?.trim()) q.set('search', params.search.trim())
  return apiGet<PagedResult<any> | null>(`/api/v1/notifications/bulk-email/${jobGuid}/recipients?${q.toString()}`)
    .then(data => data ? { ...data, items: (data.items ?? []).map(normaliseRecipient) } : emptyPage(params.page, params.size))
}

// multipart/form-data. `selections` is ONE field holding a JSON string, not
// repeated fields. Recipient type is always Student from this page — the
// backend accepts Employee but has no resolver for it yet.
export function sendBulkEmail(input: SendBulkEmailInput): Promise<SendBulkEmailResult> {
  if (MOCK_AUTH) return Promise.resolve(mockCreate(input))
  const form = new FormData()
  form.append('subject', input.subject.trim())
  form.append('body', input.body)
  form.append('selections', JSON.stringify([{ type: 'Student', guids: input.studentGuids }]))
  if (input.file) form.append('file', input.file)
  return apiPostForm<SendBulkEmailResult>('/api/v1/notifications/bulk-email', form)
}

// Student search for the compose view. Same endpoint and filters as
// searchStudentsAdvanced, typed with the fields the live response carries.
export function searchBulkEmailStudents(filters: StudentSearchFilters): Promise<PagedResult<StudentSearchResultDto>> {
  return searchStudentsAdvanced(filters).then(page => ({
    ...page,
    items: page.items.map((s: any, i: number) => ({
      studentGuid: s.studentGuid,
      studentRegNo: s.studentRegNo ?? '',
      studentNum: s.studentNum ?? '',
      studentName: s.studentName ?? '',
      programCode: s.programCode ?? s.programName ?? null,
      batchCode: s.batchCode ?? null,
      semName: s.semName ?? s.semesterName ?? null,
      schoolName: s.schoolName ?? null,
      campusName: s.campusName ?? null,
      // Mock students have no email field — give most of them one so the
      // "No email" handling can be exercised offline.
      emailId: MOCK_AUTH ? (i % 5 === 4 ? null : `${String(s.studentRegNo ?? s.studentGuid).toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.test`) : (s.emailId || null),
    })),
  }))
}

// ── Mock mode ──────────────────────────────────────────────────────────────
// Jobs advance through Draft → Resolving → Processing → terminal based on how
// long ago they were created, so the list/detail polling can be tried
// without a backend.

interface MockJob {
  jobGuid: string
  subject: string
  bodyHtml: string
  createdMs: number
  selected: number
  emails: number
  failRate: number
  attachmentFileName: string | null
  lastError: string | null
}

const MINUTE = 60_000
const now = () => Date.now()

const mockJobs: MockJob[] = [
  { jobGuid: 'mock-bulk-1', subject: 'Reminder: Outstanding Fee Balance — Spring 2026', bodyHtml: '<p>Dear student,</p><p>This is a reminder that you have an outstanding balance for <strong>Spring 2026</strong>. Please clear it before the deadline.</p><p>Regards,<br>ISBAT Finance Office</p>', createdMs: now() - 90 * MINUTE, selected: 132, emails: 128, failRate: 0.03, attachmentFileName: 'fee-schedule.pdf', lastError: null },
  { jobGuid: 'mock-bulk-2', subject: 'Registration closes this Friday', bodyHtml: '<p>Dear student,</p><p>Registration for the semester closes this Friday. Please complete your registration to avoid late fees.</p><p>Regards,<br>ISBAT Registrar</p>', createdMs: now() - 26 * 60 * MINUTE, selected: 64, emails: 64, failRate: 0, attachmentFileName: null, lastError: null },
  { jobGuid: 'mock-bulk-3', subject: 'Library orientation for new intake', bodyHtml: '<p>The library will run orientation sessions next week.</p>', createdMs: now() - 3 * 24 * 60 * MINUTE, selected: 40, emails: 0, failRate: 0, attachmentFileName: null, lastError: null },
  { jobGuid: 'mock-bulk-4', subject: 'HESFB sponsorship documents required', bodyHtml: '<p>Please submit your HESFB sponsorship letter to the Finance Office.</p>', createdMs: now() - 5 * 24 * 60 * MINUTE, selected: 22, emails: 0, failRate: 0, attachmentFileName: null, lastError: 'Could not resolve recipients: the Students service did not respond.' },
  { jobGuid: 'mock-bulk-5', subject: 'Academic performance review — Semester One', bodyHtml: '<p>Your academic performance requires attention. Please contact your programme coordinator.</p>', createdMs: now() - 8 * 24 * 60 * MINUTE, selected: 48, emails: 45, failRate: 0.2, attachmentFileName: null, lastError: null },
]

// Seconds after creation at which each phase ends.
const DRAFT_S = 2
const RESOLVE_S = 5
const SEND_S = 25

function mockState(job: MockJob) {
  const elapsed = (now() - job.createdMs) / 1000
  const failed = Math.round(job.emails * job.failRate)
  const suppressed = job.emails > 0 ? 1 : 0
  const created = new Date(job.createdMs).toISOString()
  const started = elapsed >= DRAFT_S ? new Date(job.createdMs + DRAFT_S * 1000).toISOString() : null
  const doneAt = new Date(job.createdMs + SEND_S * 1000).toISOString()

  let status: BulkEmailJobStatus
  let total = 0, sent = 0, fail = 0, supp = 0
  if (job.lastError) {
    status = elapsed < DRAFT_S ? 'Draft' : elapsed < RESOLVE_S ? 'Resolving' : 'Failed'
  } else if (elapsed < DRAFT_S) {
    status = 'Draft'
  } else if (elapsed < RESOLVE_S) {
    status = 'Resolving'
  } else if (elapsed < SEND_S && job.emails > 0) {
    status = 'Processing'
    total = job.emails
    // Counters move in steps, like the server's ~10 s recompute.
    const progress = Math.floor(((elapsed - RESOLVE_S) / (SEND_S - RESOLVE_S)) * 4) / 4
    sent = Math.floor((total - failed - suppressed) * progress)
    fail = Math.floor(failed * progress)
  } else {
    total = job.emails
    sent = total - failed - suppressed
    fail = failed
    supp = suppressed
    status = total === 0 ? 'Completed' : fail === 0 ? 'Completed' : sent === 0 ? 'Failed' : 'PartiallyFailed'
  }

  return {
    jobGuid: job.jobGuid,
    subject: job.subject,
    status,
    totalRecipients: total,
    sentCount: sent,
    failedCount: fail,
    suppressedCount: supp,
    hasAttachment: !!job.attachmentFileName,
    createdDate: created,
    startedDate: started,
    completedDate: isJobActive(status) ? null : (job.lastError ? new Date(job.createdMs + RESOLVE_S * 1000).toISOString() : doneAt),
  } satisfies BulkEmailJobDto
}

function mockList(params: BulkEmailListParams): PagedResult<BulkEmailJobDto> {
  const q = params.search?.trim().toLowerCase() ?? ''
  const from = params.from ? new Date(params.from).getTime() : null
  const to = params.to ? new Date(params.to).getTime() : null
  const rows = mockJobs
    .map(mockState)
    .filter(j => !params.status || j.status === params.status)
    .filter(j => !q || j.subject.toLowerCase().includes(q))
    .filter(j => (from == null || new Date(j.createdDate).getTime() >= from) && (to == null || new Date(j.createdDate).getTime() <= to))
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  const start = (params.page - 1) * params.size
  return { items: rows.slice(start, start + params.size), totalCount: rows.length, pageNumber: params.page, pageSize: params.size }
}

function mockDetail(job: MockJob): BulkEmailJobDetailDto {
  const s = mockState(job)
  return {
    ...s,
    bodyHtml: job.bodyHtml,
    pendingCount: Math.max(0, s.totalRecipients - s.sentCount - s.failedCount - s.suppressedCount),
    lastError: s.status === 'Failed' ? job.lastError : null,
    attachmentFileName: job.attachmentFileName,
  }
}

function mockRecipients(job: MockJob, params: BulkEmailRecipientParams): PagedResult<BulkEmailRecipientDto> {
  const s = mockState(job)
  const total = s.totalRecipients
  const rows: BulkEmailRecipientDto[] = Array.from({ length: total }, (_, i) => {
    const toEmail = `student${String(i + 1).padStart(4, '0')}@example.test`
    const processed = new Date(job.createdMs + (RESOLVE_S + 1) * 1000).toISOString()
    let status: BulkEmailRecipientStatus = 'Queued'
    let attempts = 0
    let lastError: string | null = null
    if (i < s.sentCount) { status = 'Sent'; attempts = 1 }
    else if (i < s.sentCount + s.failedCount) { status = 'Failed'; attempts = 5; lastError = '550 5.1.1 Mailbox does not exist' }
    else if (i < s.sentCount + s.failedCount + s.suppressedCount) { status = 'Suppressed'; attempts = 0; lastError = 'Address is on the suppression list' }
    else if (i === s.sentCount + s.failedCount && s.status === 'Processing') { status = 'Sending'; attempts = 1 }
    else if (s.status === 'Processing' && i % 7 === 3) { attempts = 2; lastError = '421 4.7.0 Try again later' }
    return { recipientGuid: `${job.jobGuid}-r${i}`, toEmail, status, attempts, lastError, processedDate: status === 'Queued' || status === 'Sending' ? null : processed }
  })
  const q = params.search?.trim().toLowerCase() ?? ''
  const filtered = rows
    .filter(r => !params.status || r.status === params.status)
    .filter(r => !q || r.toEmail.toLowerCase().includes(q))
  const start = (params.page - 1) * params.size
  return { items: filtered.slice(start, start + params.size), totalCount: filtered.length, pageNumber: params.page, pageSize: params.size }
}

function mockCreate(input: SendBulkEmailInput): SendBulkEmailResult {
  const jobGuid = `mock-bulk-${now()}`
  const selected = new Set(input.studentGuids).size
  mockJobs.unshift({
    jobGuid,
    subject: input.subject.trim(),
    bodyHtml: input.body,
    createdMs: now(),
    selected,
    emails: selected,
    failRate: 0.05,
    attachmentFileName: input.file?.name ?? null,
    lastError: null,
  })
  return { jobGuid, selectedRecipients: selected }
}
