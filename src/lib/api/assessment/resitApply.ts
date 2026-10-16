import { apiGet, apiPost } from '@/lib/api/client'
export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}
const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'
export interface ResitEligibleStudentDto {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  programName: string
  batchCode: string
  semesterName: string
}

export interface ResitDropdownUnitDto {
  courseUnitGuid: string
  displayName: string
}

export interface ResitCheckboxStateDto {
  iaPassed: boolean
  uePassed: boolean
  hasResult: boolean
  isTheoryPracticalUnit: boolean
}

export interface ResitApplicationListItemDto {
  resitApplicationGuid: string
  courseUnitGuid: string
  unitName: string
  unitCode: string
  unitTypeName: string
  status: number
  cw: boolean
  ue: boolean
  feePaid: boolean
}

export interface ResitApplicationEditDto {
  courseUnitGuid: string
  displayName: string
  cw: boolean
  ue: boolean
  ueType: number
  isTheoryPracticalUnit: boolean
}

export interface SubmitResitApplicationCommand {
  courseUnitGuid: string
  cw: boolean
  ue: boolean
  ueType: number
}

// 1. Student list
export function getResitEligibleStudents(params?: { page?: number; pageSize?: number; search?: string }) {
  if (MOCK_AUTH) {
    const search = params?.search?.toLowerCase() || ''
    const allStudents = [
      { studentGuid: 'std-1', studentRegNo: '2023/DIT/0142', studentName: 'JOHN DOE', programName: 'Diploma in Information Technology', batchCode: 'DIT-2023-A', semesterName: 'Year Two - Semester Two' },
      { studentGuid: 'std-2', studentRegNo: '2023/BSE/0011', studentName: 'JANE SMITH', programName: 'Bachelor of Software Engineering', batchCode: 'BSE-2023-A', semesterName: 'Year One - Semester One' },
    ]
    const filtered = allStudents.filter(s => search === '' || s.studentRegNo?.toLowerCase().includes(search) || s.studentName?.toLowerCase().includes(search))
    return Promise.resolve({ items: filtered, totalCount: filtered.length, pageNumber: params?.page || 1, pageSize: params?.pageSize || 10 } as PagedResult<ResitEligibleStudentDto>)
  }
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', params.page.toString())
  if (params?.pageSize) qs.set('pageSize', params.pageSize.toString())
  if (params?.search) qs.set('search', params.search)
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<PagedResult<ResitEligibleStudentDto>>(`/api/v1/assessment/resit-application/students${query}`)
}

// 2. Course unit dropdown
export function getResitDropdownUnits(studentGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { courseUnitGuid: 'cu-1', displayName: 'Database Systems (DIT2104)' },
      { courseUnitGuid: 'cu-2', displayName: 'Web Programming (DIT2106)' }
    ] as ResitDropdownUnitDto[])
  }
  return apiGet<ResitDropdownUnitDto[]>(`/api/v1/assessment/resit-application/students/${studentGuid}/dropdown`)
}

// 3. Checkbox state
export function getResitCheckboxState(studentGuid: string, courseUnitGuid: string) {
  if (MOCK_AUTH) {
    if (courseUnitGuid === 'cu-1') return Promise.resolve({ iaPassed: true, uePassed: false, hasResult: true, isTheoryPracticalUnit: false })
    return Promise.resolve({ iaPassed: false, uePassed: false, hasResult: false, isTheoryPracticalUnit: true })
  }
  return apiGet<ResitCheckboxStateDto>(`/api/v1/assessment/resit-application/students/${studentGuid}/checkbox-state?courseUnitGuid=${encodeURIComponent(courseUnitGuid)}`)
}

// 4. Applied units
export function getResitAppliedUnits(studentGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { resitApplicationGuid: 'app-1', courseUnitGuid: 'cu-old', unitName: 'Mathematics', unitCode: 'MTH101', unitTypeName: 'Core', status: 2, cw: true, ue: false, feePaid: false }
    ] as ResitApplicationListItemDto[])
  }
  return apiGet<ResitApplicationListItemDto[]>(`/api/v1/assessment/resit-application/students/${studentGuid}/applied-units`)
}

// 5. Submit application
export function submitResitApplication(studentGuid: string, data: SubmitResitApplicationCommand) {
  if (MOCK_AUTH) {
    return Promise.resolve({ resitApplicationGuid: 'app-new', courseUnitGuid: data.courseUnitGuid, unitName: 'Mock Unit', unitCode: 'MCK', unitTypeName: 'Core', status: 2, cw: data.cw, ue: data.ue, feePaid: false } as ResitApplicationListItemDto)
  }
  return apiPost<ResitApplicationListItemDto>(`/api/v1/assessment/resit-application/students/${studentGuid}/submit`, data)
}

// 6. Get for edit
export function getResitApplicationForEdit(resitApplicationGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve({ courseUnitGuid: 'cu-old', displayName: 'Mathematics (MTH101)', cw: true, ue: false, ueType: 0, isTheoryPracticalUnit: false } as ResitApplicationEditDto)
  }
  return apiGet<ResitApplicationEditDto>(`/api/v1/assessment/resit-application/${resitApplicationGuid}/edit`)
}

// 7. Delete application
export function deleteResitApplication(resitApplicationGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve({ deleted: true, message: 'Application deleted.' })
  }
  return apiPost<{ deleted: boolean; message: string }>(`/api/v1/assessment/resit-application/${resitApplicationGuid}/delete`, {})
}
