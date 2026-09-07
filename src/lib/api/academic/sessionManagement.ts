import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via session-management/*.md (repo root) — Session Movement's
// real backend. Five endpoints:
//   - list        GET  /session-management/               (paged, per-intake)
//   - move-status GET  /session-management/{guid}/movement-status  (pre-flight check for one row)
//   - move        POST /session-management/{guid}/move            (execute one row)
//   - move-all    POST /session-management/move-all               (kick off a bulk run)
//   - bulk-status GET  /session-management/move-all/{guid}/status  (audit breakdown for a bulk run)
// get-admission-intake.md (resolving an AdmissionIntake code for a
// programme+semester+intake triple) is an internal backend utility the doc
// itself says isn't called from this UI — not wired here.

export interface SchedulingStatus {
  cw1Scheduled: boolean
  midScheduled: boolean
  mokScheduled: boolean
  cw2Scheduled: boolean
  ueScheduled: boolean
}

export interface SessionListItemDto {
  sessionGuid: string
  programName: string
  programCode: string
  // Integer semester code, sent as a string (e.g. "2") per the doc.
  semesterCode: string
  // Admission intake label (e.g. "Fall 2022") — this is what the legacy
  // screen's own "Admission Intake" column shows, despite the name overlap
  // with the *academic* intake this list is scoped to via intakeGuid below;
  // they're not always the same intake (a batch can carry students admitted
  // in an earlier cycle than the academic session currently being managed).
  intakeText: string
  // true once already moved — disables the row's action.
  sessionMoved: boolean
  schedulingStatus: SchedulingStatus
}

export interface SessionListResponse {
  items: SessionListItemDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
}

export interface SessionListParams {
  intakeGuid: string
  campusGuid?: string | null
  pageNumber?: number
  pageSize?: number
}

// Defensive against the response not matching SessionListResponse exactly
// (a field renamed/nested differently server-side) — confirmed elsewhere on
// this app's notifications list, where a shape mismatch on `items` silently
// crashed the page. Here a mismatch on just the *count* fields wouldn't
// crash anything — rows still render fine off `items` — it would just leave
// Pagination's `totalCount === 0` guard permanently hiding the pagination
// bar. Accept a couple of common aliases and fall back to deriving from
// `items`/pageSize rather than trusting `totalCount`/`totalPages` blindly.
function normalizeSessionList(raw: unknown, pageNumber: number, pageSize: number): SessionListResponse {
  const r = raw as Partial<SessionListResponse> & { totalRecords?: number; total?: number; pageCount?: number } | null
  const items = Array.isArray(r?.items) ? r!.items : []
  if (!r || !Array.isArray(r.items)) {
    console.warn('[session-management] unexpected list response shape:', raw)
  }
  const totalCount =
    typeof r?.totalCount === 'number' ? r.totalCount :
    typeof r?.totalRecords === 'number' ? r.totalRecords :
    typeof r?.total === 'number' ? r.total :
    items.length
  const totalPages =
    typeof r?.totalPages === 'number' ? r.totalPages :
    typeof r?.pageCount === 'number' ? r.pageCount :
    Math.max(1, Math.ceil(totalCount / pageSize))
  if (r && Array.isArray(r.items) && typeof r.totalCount !== 'number') {
    console.warn('[session-management] list response is missing totalCount — pagination counts are derived, not authoritative:', raw)
  }
  return { items, totalCount, pageNumber: r?.pageNumber ?? pageNumber, pageSize: r?.pageSize ?? pageSize, totalPages }
}

export function getSessions(params: SessionListParams): Promise<SessionListResponse> {
  const pageNumber = params.pageNumber ?? 1
  const pageSize = params.pageSize ?? 20
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber, pageSize, totalPages: 1 })
  const qs = new URLSearchParams({ intakeGuid: params.intakeGuid, pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (params.campusGuid) qs.set('campusGuid', params.campusGuid)
  return apiGet<unknown>(`/api/v1/academic/session-management/?${qs.toString()}`)
    .then(raw => normalizeSessionList(raw, pageNumber, pageSize))
}

// Every value the pre-flight check can return — 200 in all cases, this is
// the machine-readable signal, not the HTTP status.
export type MovementResult = 'MovementAllowed' | 'AlreadyMoved' | 'NotPossible' | 'FinalSemester' | 'NoStudents' | 'ResultsNotPublished'

export interface MovementStatusDto {
  sessionGuid: string
  result: MovementResult
  description: string
}

// Called right before showing the Move confirmation dialog — a session that
// looks actionable in the list (sessionMoved: false) can still turn out to
// be a final semester, have no linked students, or belong to an intake whose
// results aren't published yet, none of which the list response itself
// distinguishes.
export function getMovementStatus(sessionGuid: string): Promise<MovementStatusDto> {
  if (MOCK_AUTH) return Promise.resolve({ sessionGuid, result: 'MovementAllowed', description: 'Session movement is possible.' })
  return apiGet<MovementStatusDto>(`/api/v1/academic/session-management/${sessionGuid}/movement-status`)
}

export interface MoveSessionResult {
  sessionGuid: string
  newSessionGuid: string
}

export function executeSessionMove(sessionGuid: string): Promise<MoveSessionResult> {
  if (MOCK_AUTH) return Promise.resolve({ sessionGuid, newSessionGuid: `mock-next-${sessionGuid}` })
  return apiPost<MoveSessionResult>(`/api/v1/academic/session-management/${sessionGuid}/move`, {})
}

export interface MoveAllResult {
  bulkMovementGuid: string
  statusUrl: string
}

export function moveAllSessions(intakeGuid: string): Promise<MoveAllResult> {
  if (MOCK_AUTH) return Promise.resolve({ bulkMovementGuid: `mock-bulk-${Date.now()}`, statusUrl: '' })
  return apiPost<MoveAllResult>(`/api/v1/academic/session-management/move-all?intakeGuid=${encodeURIComponent(intakeGuid)}`, {})
}

export type BulkMovementRunStatus = 'InProgress' | 'Completed' | 'PartiallyFailed' | 'Failed'

export interface BulkAuditEntry {
  sessionGuid: string
  programName: string
  // null for a moved entry; a human-readable reason for skipped/failed.
  reason: string | null
}

export interface BulkMovementStatusDto {
  bulkMovementGuid: string
  status: BulkMovementRunStatus
  requestedAt: string
  completedAt: string | null
  moved: BulkAuditEntry[]
  skipped: BulkAuditEntry[]
  failed: BulkAuditEntry[]
}

export function getBulkMovementStatus(bulkMovementGuid: string): Promise<BulkMovementStatusDto> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      bulkMovementGuid, status: 'Completed', requestedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
      moved: [], skipped: [], failed: [],
    })
  }
  return apiGet<BulkMovementStatusDto>(`/api/v1/academic/session-management/move-all/${bulkMovementGuid}/status`)
}
