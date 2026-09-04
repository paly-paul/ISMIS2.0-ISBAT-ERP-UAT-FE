import { apiGet, apiPost, apiPut, apiDelete } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface AssessmentTypeDto {
  assessmentTypeGuid: string
  assessmentCode: string | null
  assessmentName: string | null
  feeClearance: number | null
  displayFeeClearance: number | null
}

export interface AssessmentTypeDropdownItemDto {
  assessmentTypeGuid: string
  assessmentName: string
}

export interface PagedAssessmentTypeResult {
  items: AssessmentTypeDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface CreateAssessmentTypeRequest {
  assessmentCode: string
  assessmentName: string
  feeClearance?: number | null
  displayFeeClearance?: number | null
}

export interface UpdateFeeClearanceRequest {
  feeClearance: number
  displayFeeClearance: number
}

let mockSeq = 1
const mockData: AssessmentTypeDto[] = [
  {
    assessmentTypeGuid: 'e1029f0b-f719-4739-8149-caa4cdd1ab46',
    assessmentCode: 'ATT',
    assessmentName: 'Attendance',
    feeClearance: null,
    displayFeeClearance: null,
  },
  {
    assessmentTypeGuid: 'e8a25536-cfc1-4e92-891f-a6be1aec967e',
    assessmentCode: 'CW2',
    assessmentName: 'Class Activity',
    feeClearance: 100,
    displayFeeClearance: 100,
  }
]

export function getAssessmentTypes(page = 1, pageSize = 10): Promise<PagedAssessmentTypeResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      items: mockData,
      totalCount: mockData.length,
      pageNumber: page,
      pageSize,
    })
  }
  return apiGet<PagedAssessmentTypeResult | null>(`/api/v1/assessment/assessment-types?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getAssessmentTypeDropdown(): Promise<AssessmentTypeDropdownItemDto[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockData.map(d => ({
      assessmentTypeGuid: d.assessmentTypeGuid,
      assessmentName: d.assessmentName || ''
    })))
  }
  return apiGet<AssessmentTypeDropdownItemDto[] | null>('/api/v1/assessment/assessment-types/dropdown')
    .then(data => data ?? [])
}

export function getAssessmentTypeById(guid: string): Promise<AssessmentTypeDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.assessmentTypeGuid === guid)
    if (!found) return Promise.reject(new Error('Not found'))
    return Promise.resolve(found)
  }
  return apiGet<AssessmentTypeDto>(`/api/v1/assessment/assessment-types/${guid}`)
}

export function createAssessmentType(input: CreateAssessmentTypeRequest): Promise<AssessmentTypeDto> {
  if (MOCK_AUTH) {
    const newItem: AssessmentTypeDto = {
      assessmentTypeGuid: `mock-guid-${mockSeq++}`,
      assessmentCode: input.assessmentCode,
      assessmentName: input.assessmentName,
      feeClearance: input.feeClearance ?? null,
      displayFeeClearance: input.displayFeeClearance ?? null,
    }
    mockData.push(newItem)
    return Promise.resolve(newItem)
  }
  return apiPost<AssessmentTypeDto>('/api/v1/assessment/assessment-types', input)
}

export function updateAssessmentTypeFeeClearance(guid: string, input: UpdateFeeClearanceRequest): Promise<AssessmentTypeDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.assessmentTypeGuid === guid)
    if (!found) return Promise.reject(new Error('Not found'))
    found.feeClearance = input.feeClearance
    found.displayFeeClearance = input.displayFeeClearance
    return Promise.resolve(found)
  }
  return apiPut<AssessmentTypeDto>(`/api/v1/assessment/assessment-types/${guid}/fee-clearance`, input)
}

export function deleteAssessmentType(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const idx = mockData.findIndex(d => d.assessmentTypeGuid === guid)
    if (idx > -1) mockData.splice(idx, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/assessment/assessment-types/${guid}`)
}
