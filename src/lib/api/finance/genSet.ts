import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface GenSet {
  genSetGuid: string
  type: string
  condition: string
}

// Matches Finance/GenSets/Create.bru + Update.bru: type max 10 chars,
// condition max 100 chars (both required, not empty).
export type GenSetInput = Omit<GenSet, 'genSetGuid'>

interface GenSetListResponse {
  items: GenSet[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockGenSets: GenSet[] = [
  { genSetGuid: '7c386d26-b734-4fb2-ade6-c1df14983c6e', type: 'RD', condition: '2' },
  { genSetGuid: '224ee48b-4a6a-426c-880b-a1b7f316853d', type: 'TF', condition: '1' },
]

export function getGenSets(): Promise<GenSet[]> {
  if (MOCK_AUTH) return Promise.resolve(mockGenSets)
  return apiGet<GenSetListResponse | null>('/api/v1/finance/gen-sets?page=1&pageSize=10').then(data => data?.items ?? [])
}

export function createGenSet(input: GenSetInput): Promise<GenSet> {
  if (MOCK_AUTH) {
    const genSet: GenSet = { genSetGuid: crypto.randomUUID(), ...input }
    mockGenSets.push(genSet)
    return Promise.resolve(genSet)
  }
  return apiPost<GenSet>('/api/v1/finance/gen-sets', input)
}

export function getGenSetById(guid: string): Promise<GenSet> {
  if (MOCK_AUTH) {
    const existing = mockGenSets.find(g => g.genSetGuid === guid)
    if (!existing) return Promise.reject(new Error('General setting not found'))
    return Promise.resolve(existing)
  }
  return apiGet<GenSet>(`/api/v1/finance/gen-sets/${guid}`)
}

// Same payload shape as create (see GenSetInput above).
export function updateGenSet(guid: string, input: GenSetInput): Promise<GenSet> {
  if (MOCK_AUTH) {
    const existing = mockGenSets.find(g => g.genSetGuid === guid)
    if (!existing) return Promise.reject(new Error('General setting not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<GenSet>(`/api/v1/finance/gen-sets/${guid}`, input)
}

export function deleteGenSet(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockGenSets.findIndex(g => g.genSetGuid === guid)
    if (index === -1) return Promise.reject(new Error('General setting not found'))
    mockGenSets.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/gen-sets/${guid}`)
}
