import { apiGet, apiPost, apiPut, apiDelete } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface ResitConfigDto {
  resitConfigGuid: string
  refCode: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean | null
  academicIntakeGuid: string | null
}

export interface PagedResitConfigResult {
  items: ResitConfigDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface SaveResitConfigRequest {
  refCode: string
  startDate: string
  endDate: string
  academicIntakeGuid: string
  isActive: boolean
}

let mockSeq = 1
let mockData: ResitConfigDto[] = [
  {
    resitConfigGuid: '281240df-0e06-46dd-9cdb-119745e65f03',
    refCode: 'Resit Spring 2026',
    startDate: '2026-01-06T00:00:00',
    endDate: '2026-03-13T00:00:00',
    isActive: true,
    academicIntakeGuid: 'de6d9dfa-5634-4a87-88b7-7e8d2e93b4e2'
  }
]

export function getResitConfigs(page = 1, pageSize = 10, academicIntakeGuid?: string): Promise<PagedResitConfigResult> {
  if (MOCK_AUTH) {
    let filtered = [...mockData]
    if (academicIntakeGuid) {
      filtered = filtered.filter(d => d.academicIntakeGuid === academicIntakeGuid)
    }
    // Sort descending by creation
    filtered.reverse()
    return Promise.resolve({
      items: filtered,
      totalCount: filtered.length,
      pageNumber: page,
      pageSize,
    })
  }
  const query = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() })
  if (academicIntakeGuid) query.append('academicIntakeGuid', academicIntakeGuid)
  return apiGet<PagedResitConfigResult | null>(`/api/v1/assessment/resit-configs?${query.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function getResitConfigById(guid: string): Promise<ResitConfigDto> {
  if (MOCK_AUTH) {
    const found = mockData.find(d => d.resitConfigGuid === guid)
    if (!found) return Promise.reject(new Error('Not found'))
    return Promise.resolve(found)
  }
  return apiGet<ResitConfigDto>(`/api/v1/assessment/resit-configs/${guid}`)
}

export function createResitConfig(input: SaveResitConfigRequest): Promise<ResitConfigDto> {
  if (MOCK_AUTH) {
    const exists = mockData.find(d => d.refCode?.toLowerCase() === input.refCode.toLowerCase())
    if (exists) return Promise.reject(new Error('refCode already in use by a non-deleted resit config'))

    if (input.isActive) {
      mockData.forEach(d => { d.isActive = false })
    }

    const newItem: ResitConfigDto = {
      resitConfigGuid: `mock-resit-${mockSeq++}`,
      refCode: input.refCode,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: input.isActive,
      academicIntakeGuid: input.academicIntakeGuid
    }
    mockData.push(newItem)
    return Promise.resolve(newItem)
  }
  return apiPost<ResitConfigDto>('/api/v1/assessment/resit-configs', input)
}

export function updateResitConfig(guid: string, input: SaveResitConfigRequest): Promise<ResitConfigDto> {
  if (MOCK_AUTH) {
    const exists = mockData.find(d => d.resitConfigGuid !== guid && d.refCode?.toLowerCase() === input.refCode.toLowerCase())
    if (exists) return Promise.reject(new Error('refCode already in use by a different resit config'))

    const found = mockData.find(d => d.resitConfigGuid === guid)
    if (!found) return Promise.reject(new Error('Not found'))

    if (input.isActive) {
      mockData.forEach(d => { if (d.resitConfigGuid !== guid) d.isActive = false })
    }

    found.refCode = input.refCode
    found.startDate = input.startDate
    found.endDate = input.endDate
    found.isActive = input.isActive
    found.academicIntakeGuid = input.academicIntakeGuid
    return Promise.resolve(found)
  }
  return apiPut<ResitConfigDto>(`/api/v1/assessment/resit-configs/${guid}`, input)
}

export function deleteResitConfig(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    mockData = mockData.filter(d => d.resitConfigGuid !== guid)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/assessment/resit-configs/${guid}`)
}
