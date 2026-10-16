import { apiGet, apiPost, apiPut, apiDelete } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// M_TERMINATION_REASON master — the reason picker used by
// POST /students/{studentGuid}/terminate (student-termination/post-terminate-student.md).
// A genuinely tiny resource: just a guid + name, soft-deleted on remove.

export interface TerminationReasonListItemDto {
  terminationReasonGuid: string
  reasonName: string
}

// GET by guid returns the same shape as the list item — kept as its own
// alias rather than reusing the list type name directly, so a future field
// added to only one of them doesn't have to be threaded through the other.
export type TerminationReasonDto = TerminationReasonListItemDto

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockReasons: TerminationReasonDto[] = [
  { terminationReasonGuid: 'mock-reason-1', reasonName: 'Fake Certificate' },
  { terminationReasonGuid: 'mock-reason-2', reasonName: 'Academic Dishonesty' },
]

// GET /students/termination-reasons — paged, searchable. Default pageSize
// on the wire is 25; passed explicitly here anyway so the table's own
// pagination stays in sync with what was actually requested.
export function getTerminationReasons(page: number, pageSize: number, search?: string): Promise<PagedResult<TerminationReasonDto>> {
  if (MOCK_AUTH) {
    const q = search?.trim().toLowerCase()
    const items = q ? mockReasons.filter(r => r.reasonName.toLowerCase().includes(q)) : mockReasons
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search?.trim()) qs.set('search', search.trim())
  return apiGet<PagedResult<TerminationReasonDto> | null>(`/api/v1/students/termination-reasons?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// GET /students/termination-reasons/dropdown — unpaged, for the reason
// picker on the Terminate Student screen (not this master page's own table).
export function getTerminationReasonsDropdown(search?: string): Promise<TerminationReasonListItemDto[]> {
  if (MOCK_AUTH) {
    const q = search?.trim().toLowerCase()
    return Promise.resolve(q ? mockReasons.filter(r => r.reasonName.toLowerCase().includes(q)) : mockReasons)
  }
  const qs = new URLSearchParams()
  if (search?.trim()) qs.set('search', search.trim())
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<TerminationReasonListItemDto[] | null>(`/api/v1/students/termination-reasons/dropdown${suffix}`)
    .then(data => data ?? [])
}

export function getTerminationReasonByGuid(guid: string): Promise<TerminationReasonDto> {
  if (MOCK_AUTH) {
    const found = mockReasons.find(r => r.terminationReasonGuid === guid)
    if (!found) throw new Error('not_found')
    return Promise.resolve(found)
  }
  return apiGet<TerminationReasonDto>(`/api/v1/students/termination-reasons/${guid}`)
}

export interface TerminationReasonInput {
  reasonName: string
}

export function createTerminationReason(input: TerminationReasonInput): Promise<TerminationReasonDto> {
  if (MOCK_AUTH) {
    const created = { terminationReasonGuid: `mock-reason-${Date.now()}`, reasonName: input.reasonName }
    mockReasons.push(created)
    return Promise.resolve(created)
  }
  return apiPost<TerminationReasonDto>('/api/v1/students/termination-reasons', input)
}

export function updateTerminationReason(guid: string, input: TerminationReasonInput): Promise<TerminationReasonDto> {
  if (MOCK_AUTH) {
    const found = mockReasons.find(r => r.terminationReasonGuid === guid)
    if (!found) throw new Error('not_found')
    found.reasonName = input.reasonName
    return Promise.resolve(found)
  }
  return apiPut<TerminationReasonDto>(`/api/v1/students/termination-reasons/${guid}`, input)
}

export function deleteTerminationReason(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const idx = mockReasons.findIndex(r => r.terminationReasonGuid === guid)
    if (idx >= 0) mockReasons.splice(idx, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/students/termination-reasons/${guid}`)
}
