import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface Cooperate {
  cooperateGuid: string
  cooperateCode: string
  cooperateName: string
}

export type CooperateInput = Omit<Cooperate, 'cooperateGuid'>

interface CooperateListResponse {
  items: Cooperate[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockCooperates: Cooperate[] = [
  { cooperateGuid: '73153235-907c-4ec9-a35a-2a167d86bfb5', cooperateCode: 'CO-001', cooperateName: 'SYBYL' },
]

// GET /cooperates is paged (get-cooperates.md: ?page default 1, ?pageSize
// default 10, no upper bound) and has no search param. Callers want the
// whole list — the Cooperates page pages and searches it client-side, and
// Discount Allocation's Corporate dropdown lists every one — so ask for it
// in one page; without an explicit pageSize only the first 10 come back.
const ALL_COOPERATES_PAGE_SIZE = 1000

export function getCooperates(): Promise<Cooperate[]> {
  if (MOCK_AUTH) return Promise.resolve(mockCooperates)
  return apiGet<CooperateListResponse | null>(`/api/v1/finance/cooperates?page=1&pageSize=${ALL_COOPERATES_PAGE_SIZE}`).then(data => data?.items ?? [])
}

export function createCooperate(input: CooperateInput): Promise<Cooperate> {
  if (MOCK_AUTH) {
    const cooperate: Cooperate = { cooperateGuid: crypto.randomUUID(), ...input }
    mockCooperates.push(cooperate)
    return Promise.resolve(cooperate)
  }
  return apiPost<Cooperate>('/api/v1/finance/cooperates', input)
}

export function getCooperateById(guid: string): Promise<Cooperate> {
  if (MOCK_AUTH) {
    const existing = mockCooperates.find(c => c.cooperateGuid === guid)
    if (!existing) return Promise.reject(new Error('Cooperate not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Cooperate>(`/api/v1/finance/cooperates/${guid}`)
}

// Same payload shape as create (see CooperateInput above).
export function updateCooperate(guid: string, input: CooperateInput): Promise<Cooperate> {
  if (MOCK_AUTH) {
    const existing = mockCooperates.find(c => c.cooperateGuid === guid)
    if (!existing) return Promise.reject(new Error('Cooperate not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Cooperate>(`/api/v1/finance/cooperates/${guid}`, input)
}

// DELETE /api/v1/finance/cooperates/{guid} — soft-delete (data: true on success).
export function deleteCooperate(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockCooperates.findIndex(c => c.cooperateGuid === guid)
    if (index === -1) return Promise.reject(new Error('Cooperate not found'))
    mockCooperates.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/cooperates/${guid}`)
}
