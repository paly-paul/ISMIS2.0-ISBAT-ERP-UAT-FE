import { apiDelete, apiGet, apiPostForm, AuthError } from '../client'

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
  documentUrl: string | null
}

// Field names/casing (CountryGuid, RefugeeId, document) are exactly what
// post-assign-refugee-status.md's multipart request table specifies —
// mixed-case on purpose, not a typo.
export interface AssignRefugeeStatusRequest {
  studentGuid: string
  countryGuid: string
  refugeeId: string
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
        .filter(s => !!mockRefugees[s.studentGuid])
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
      documentUrl: `/uploads/refugee/${payload.document.name}`,
    }
    mockRefugees[payload.studentGuid] = row
    return Promise.resolve(row)
  }
  const formData = new FormData()
  formData.append('CountryGuid', payload.countryGuid)
  formData.append('RefugeeId', payload.refugeeId)
  formData.append('document', payload.document)
  return apiPostForm<RefugeeStudentDetailsDto>(`/api/v1/students/refugee/${payload.studentGuid}`, formData)
}

// No restore — re-granting requires re-uploading the document via assign
// (delete-remove-refugee-status.md).
export function removeRefugeeStatus(studentGuid: string): Promise<void> {
  if (MOCK_AUTH) { delete mockRefugees[studentGuid]; return Promise.resolve() }
  return apiDelete<void>(`/api/v1/students/refugee/${studentGuid}`)
}
