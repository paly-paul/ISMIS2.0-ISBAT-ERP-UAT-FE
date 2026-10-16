import { apiDelete, apiGet, apiPost, apiPostForm, apiPutForm, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed against students/student-refugee/*.md — each of the five
// endpoints below now has a real JSON sample checked into that doc set
// (2026-08-31 corrections), superseding this file's own earlier "no
// response sample, prose only" hedge. Two things that hedge got wrong,
// caught re-checking against the doc set (2026-09-04): eligible and
// assigned students are genuinely different shapes (EligibleRefugeeStudentDto
// only carries three fields — no programme/batch/semester at all — while
// this file used to share one RefugeeStudentSummaryDto between both list
// endpoints), and the assign request takes a real `CountryGuid`, not the
// numeric `intCountryCode` this file invented as a placeholder for an
// "unconfirmed" field the doc set actually pins down.

export interface EligibleRefugeeStudentDto {
  studentGuid: string
  studentName: string
  studentRegNo: string
}

export interface RefugeeStudentDto {
  studentGuid: string
  studentName: string
  studentRegNo: string
  refugeeId: string | null
  batchGuid: string | null
  batchCode: string | null
  semesterGuid: string | null
  semesterName: string | null
  programGuid: string | null
  programName: string | null
}

export interface RefugeeStudentDetailsDto {
  studentGuid: string
  studentName: string | null
  studentRegNo: string | null
  refugeeId: string | null
  batchGuid: string | null
  batchCode: string | null
  semesterGuid: string | null
  semesterName: string | null
  programGuid: string | null
  programName: string | null
  // Approval workflow (get-student-refugee-details.md, 2026-10-05) — the
  // detail now returns pending (1 Applied) records as well as approved ones.
  refugeeAssignmentStatus?: RefugeeAssignmentStatus | null
  refugeeAssignmentStatusLabel?: string | null
  remarks?: string | null
  documentUrl: string | null
}

// 1 Applied (pending approval), 2 Approved.
export type RefugeeAssignmentStatus = 1 | 2

// GET /students/refugee/pending-approvals
// (get-pending-refugee-approvals.md, 2026-10-05) — every active student with
// an assignment request at status 1 (Applied), across all campuses.
// Programme/semester/batch names are null for a legacy student whose GUIDs
// don't resolve. documentUrl is a pre-signed S3 URL that expires.
export interface PendingRefugeeApprovalRow {
  studentGuid: string
  studentNum: string | null
  studentRegNo: string | null
  studentName: string | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  batchGuid: string | null
  batchCode: string | null
  refugeeId: string | null
  countryGuid: string | null
  remarks: string | null
  documentUrl: string | null
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Field names/casing (CountryGuid, RefugeeId, document) are exactly what
// post-assign-refugee-status.md's multipart request table specifies —
// mixed-case on purpose, not a typo.
export interface AssignRefugeeStatusRequest {
  studentGuid: string
  countryGuid: string
  refugeeId: string
  // Documented as optional (2026-10-05), but always sent — matches the
  // working Bruno request (CountryGuid, RefugeeId, Remarks, document).
  remarks: string
  document: File
}

const mockEligible: EligibleRefugeeStudentDto[] = [
  { studentGuid: 'stu-mock-1', studentName: 'Aisha Nakamya', studentRegNo: '011240104' },
  { studentGuid: 'stu-mock-2', studentName: 'Okello James', studentRegNo: '012221279' },
]
const mockRefugees: Record<string, RefugeeStudentDetailsDto> = {}

// Unpaged per the docs — the full set comes back in one call, so no
// page/pageSize params here.
export function getEligibleStudents(): Promise<EligibleRefugeeStudentDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockEligible.filter(s => !mockRefugees[s.studentGuid]))
  return apiGet<EligibleRefugeeStudentDto[] | null>('/api/v1/students/refugee/eligible').then(data => data ?? [])
}

export function getRefugeeStudents(): Promise<RefugeeStudentDto[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(
      mockEligible
        .filter(s => mockRefugees[s.studentGuid]?.refugeeAssignmentStatus === 2)
        .map(s => {
          const r = mockRefugees[s.studentGuid]
          return {
            studentGuid: s.studentGuid, studentName: s.studentName, studentRegNo: s.studentRegNo,
            refugeeId: r.refugeeId, batchGuid: null, batchCode: null, semesterGuid: null, semesterName: null,
            programGuid: null, programName: null,
          }
        }),
    )
  }
  return apiGet<RefugeeStudentDto[] | null>('/api/v1/students/refugee').then(data => data ?? [])
}

// A student with no refugee-status record is the common case. The docs say
// 404 `not_found`, but a real response (2026-08-31) came back as a 400 with
// the same `code: "not_found"` body instead — checked via err.code here, not
// the HTTP status, so this still resolves to null either way rather than
// throwing.
export function getStudentRefugeeDetails(studentGuid: string): Promise<RefugeeStudentDetailsDto | null> {
  if (MOCK_AUTH) return Promise.resolve(mockRefugees[studentGuid] ?? null)
  return apiGet<RefugeeStudentDetailsDto>(`/api/v1/students/refugee/${studentGuid}`).catch(err => {
    if (err instanceof AuthError && err.code === 'not_found') return null
    throw err
  })
}

// multipart/form-data — the document is mandatory and validated server-side
// (post-assign-refugee-status.md), unlike most file uploads in this app.
export function assignRefugeeStatus(payload: AssignRefugeeStatusRequest): Promise<RefugeeStudentDetailsDto> {
  if (MOCK_AUTH) {
    const found = mockEligible.find(s => s.studentGuid === payload.studentGuid)
    const row: RefugeeStudentDetailsDto = {
      studentGuid: payload.studentGuid,
      studentName: found?.studentName ?? null,
      studentRegNo: found?.studentRegNo ?? null,
      refugeeId: payload.refugeeId,
      batchGuid: null, batchCode: null, semesterGuid: null, semesterName: null, programGuid: null, programName: null,
      // Assign only raises a request now — approval activates it.
      refugeeAssignmentStatus: 1, refugeeAssignmentStatusLabel: 'Applied', remarks: payload.remarks,
      documentUrl: `/uploads/refugee/${payload.document.name}`,
    }
    mockRefugees[payload.studentGuid] = row
    return Promise.resolve(row)
  }
  const formData = new FormData()
  formData.append('CountryGuid', payload.countryGuid)
  formData.append('RefugeeId', payload.refugeeId)
  formData.append('Remarks', payload.remarks)
  formData.append('document', payload.document)
  return apiPostForm<RefugeeStudentDetailsDto>(`/api/v1/students/refugee/${payload.studentGuid}`, formData)
}

// Same command/validator as assign (put-update-refugee-status.md) — replaces
// country, refugee ID and document together, so the document is mandatory
// here too. 200 vs POST's 201 is the only server-side difference.
export function updateRefugeeStatus(payload: AssignRefugeeStatusRequest): Promise<RefugeeStudentDetailsDto> {
  if (MOCK_AUTH) {
    const existing = mockRefugees[payload.studentGuid]
    if (!existing) return Promise.reject(new AuthError('not_found', 'Student not found'))
    // An edit re-enters the approval workflow (student-refugee-page.md).
    const row: RefugeeStudentDetailsDto = { ...existing, refugeeId: payload.refugeeId, remarks: payload.remarks, refugeeAssignmentStatus: 1, refugeeAssignmentStatusLabel: 'Applied', documentUrl: `/uploads/refugee/${payload.document.name}` }
    mockRefugees[payload.studentGuid] = row
    return Promise.resolve(row)
  }
  const formData = new FormData()
  formData.append('countryGuid', payload.countryGuid)
  formData.append('refugeeId', payload.refugeeId)
  formData.append('remarks', payload.remarks)
  formData.append('document', payload.document)
  return apiPutForm<RefugeeStudentDetailsDto>(`/api/v1/students/refugee/${payload.studentGuid}`, formData)
}

// search matches student number / reg no / refugee ID exactly, or name as
// LIKE '%term%'. pageSize is 1–200 server-side (out of range falls back to 25).
export function getPendingRefugeeApprovals(search: string | null, pageNumber = 1, pageSize = 25): Promise<PagedResult<PendingRefugeeApprovalRow>> {
  if (MOCK_AUTH) {
    const term = search?.trim().toLowerCase() ?? ''
    const items: PendingRefugeeApprovalRow[] = Object.values(mockRefugees)
      .filter(r => r.refugeeAssignmentStatus === 1)
      .filter(r => !term || r.studentRegNo?.toLowerCase() === term || r.refugeeId?.toLowerCase() === term || (r.studentName ?? '').toLowerCase().includes(term))
      .map(r => ({
        studentGuid: r.studentGuid, studentNum: null, studentRegNo: r.studentRegNo, studentName: r.studentName,
        programGuid: r.programGuid, programName: r.programName, semesterGuid: r.semesterGuid, semesterName: r.semesterName,
        batchGuid: r.batchGuid, batchCode: r.batchCode,
        refugeeId: r.refugeeId, countryGuid: null, remarks: r.remarks ?? null, documentUrl: r.documentUrl,
      }))
    return Promise.resolve({ items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), totalCount: items.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
  if (search?.trim()) params.set('search', search.trim())
  return apiGet<PagedResult<PendingRefugeeApprovalRow> | null>(`/api/v1/students/refugee/pending-approvals?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// Approves the pending request (post-approve-refugee-status.md). No body —
// sets REFUGEE = 1 and syncs the country to admissions. 400 `failure` if
// nothing is pending. documentUrl is null on this response.
export function approveRefugeeStatus(studentGuid: string): Promise<RefugeeStudentDetailsDto> {
  if (MOCK_AUTH) {
    const existing = mockRefugees[studentGuid]
    if (existing?.refugeeAssignmentStatus !== 1) return Promise.reject(new Error('No pending refugee assignment request found for this student.'))
    const updated: RefugeeStudentDetailsDto = { ...existing, refugeeAssignmentStatus: 2, refugeeAssignmentStatusLabel: 'Approved' }
    mockRefugees[studentGuid] = updated
    return Promise.resolve({ ...updated, documentUrl: null })
  }
  return apiPost<RefugeeStudentDetailsDto>(`/api/v1/students/refugee/${studentGuid}/approve`, {})
}

// No restore — re-granting requires re-uploading the document via assign
// (delete-remove-refugee-status.md).
export function removeRefugeeStatus(studentGuid: string): Promise<void> {
  if (MOCK_AUTH) { delete mockRefugees[studentGuid]; return Promise.resolve() }
  return apiDelete<void>(`/api/v1/students/refugee/${studentGuid}`)
}
