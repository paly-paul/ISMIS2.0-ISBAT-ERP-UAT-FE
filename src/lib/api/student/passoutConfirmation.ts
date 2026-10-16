import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Manual Passout (REGSTATUS = 5) confirmation for PCSE/PCIM students —
// passout-confirmation/*.md. Unlike every other Passout-eligible population,
// these two program groups have zero M_PROGRAM_UNITS/T_EXAM_RESULT rows, so
// there's nothing for a marks-based check to evaluate; staff are the sole
// source of truth here, browsing/searching this list and confirming
// completion manually rather than the system deriving it.
export interface PassoutConfirmationCandidateDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
  programGuid: string
  programName: string
  programGroup: string
  batchGuid: string
  batchCode: string
}

export interface PassoutConfirmationCandidateDetailDto extends PassoutConfirmationCandidateDto {
  campusGuid: string
  campusName: string
  semesterGuid: string
  semesterName: string
}

export interface ConfirmPassoutRequest {
  remarks?: string
}

export interface ConfirmPassoutResultDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface PassoutCandidateFilters {
  searchTerm?: string
  email?: string
  phone?: string
  // "PCSE" | "PCIM" — omit to search both, per get-candidates.md.
  programGroup?: string
}

const mockCandidates: PassoutConfirmationCandidateDto[] = [
  { studentGuid: 'stu-mock-po-1', studentRegNo: '022210238', studentName: 'Abdi Mohamed', programGuid: 'prog-mock-1', programName: 'Professional Certificate in Software Engineering-F21', programGroup: 'PCSE', batchGuid: 'batch-mock-1', batchCode: 'PCSEF2120212DA' },
  { studentGuid: 'stu-mock-po-2', studentRegNo: '022240071', studentName: 'Namutebi Sarah', programGuid: 'prog-mock-2', programName: 'Professional Certificate in Islamic Microfinance-S22', programGroup: 'PCIM', batchGuid: 'batch-mock-2', batchCode: 'PCIMS2220221DA' },
]

const mockDetails: Record<string, Pick<PassoutConfirmationCandidateDetailDto, 'campusGuid' | 'campusName' | 'semesterGuid' | 'semesterName'>> = {
  'stu-mock-po-1': { campusGuid: 'campus-mock-1', campusName: 'ISBAT University - City Campus', semesterGuid: 'sem-mock-1', semesterName: 'Year Two - Semester Two' },
  'stu-mock-po-2': { campusGuid: 'campus-mock-1', campusName: 'ISBAT University - City Campus', semesterGuid: 'sem-mock-2', semesterName: 'Year One - Semester Three' },
}

export function getPassoutCandidates(pageNumber: number, pageSize: number, filters?: PassoutCandidateFilters): Promise<PagedResult<PassoutConfirmationCandidateDto>> {
  if (MOCK_AUTH) {
    const term = filters?.searchTerm?.trim().toLowerCase()
    const group = filters?.programGroup
    const items = mockCandidates.filter(c => {
      if (group && c.programGroup !== group) return false
      if (term && !`${c.studentRegNo} ${c.studentName}`.toLowerCase().includes(term)) return false
      return true
    })
    return Promise.resolve({ items, totalCount: items.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams()
  if (filters?.searchTerm?.trim()) params.set('searchTerm', filters.searchTerm.trim())
  if (filters?.email?.trim()) params.set('email', filters.email.trim())
  if (filters?.phone?.trim()) params.set('phone', filters.phone.trim())
  if (filters?.programGroup) params.set('programGroup', filters.programGroup)
  // get-candidates.md documents this as `pageNumber`, but sent as `page` here
  // to match the query param name every other paged list endpoint in this
  // app actually uses (getStudents/getStudentsFilter) — per explicit
  // instruction, 2026-09-18.
  params.set('page', String(pageNumber))
  params.set('pageSize', String(pageSize))
  return apiGet<PagedResult<PassoutConfirmationCandidateDto> | null>(`/api/v1/students/passout-confirmation/candidates?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

export function getPassoutCandidateDetail(studentGuid: string): Promise<PassoutConfirmationCandidateDetailDto> {
  if (MOCK_AUTH) {
    const found = mockCandidates.find(c => c.studentGuid === studentGuid)
    if (!found) throw new Error('not_found')
    return Promise.resolve({ ...found, ...mockDetails[studentGuid] })
  }
  return apiGet<PassoutConfirmationCandidateDetailDto>(`/api/v1/students/passout-confirmation/${studentGuid}`)
}

export function confirmPassout(studentGuid: string, payload: ConfirmPassoutRequest): Promise<ConfirmPassoutResultDto> {
  if (MOCK_AUTH) {
    const found = mockCandidates.find(c => c.studentGuid === studentGuid)
    return Promise.resolve({ studentGuid, studentRegNo: found?.studentRegNo ?? 'MOCK', studentName: found?.studentName ?? 'Mock Student' })
  }
  return apiPost<ConfirmPassoutResultDto>(`/api/v1/students/passout-confirmation/${studentGuid}/confirm`, payload)
}
