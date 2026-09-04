import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents an admission interest level record returned by the API.
export interface InterestLevel {
  interestLevelGuid: string
  interestLevelName: string
}

// Payload used when creating or updating an interest level.
export type InterestLevelInput = Omit<InterestLevel, 'interestLevelGuid'>

// In-memory list used only when mock auth is enabled.
const mockInterestLevels: InterestLevel[] = [
  { interestLevelGuid: '85afaee5-b3c8-4dee-acaa-06726c1d129e', interestLevelName: 'High' },
]

// Fetch all interest levels.
export function getInterestLevels(): Promise<InterestLevel[]> {
  if (MOCK_AUTH) return Promise.resolve(mockInterestLevels)
  return apiGet<InterestLevel[] | null>('/api/v1/admissions/interest-levels').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new interest level and return the saved record.
export function createInterestLevel(input: InterestLevelInput): Promise<InterestLevel> {
  if (MOCK_AUTH) {
    const level: InterestLevel = { interestLevelGuid: crypto.randomUUID(), ...input }
    mockInterestLevels.push(level)
    return Promise.resolve(level)
  }
  return apiPost<InterestLevel>('/api/v1/admissions/interest-levels', input)
}

// Fetch one interest level by its GUID.
export function getInterestLevelById(guid: string): Promise<InterestLevel> {
  if (MOCK_AUTH) {
    const existing = mockInterestLevels.find(l => l.interestLevelGuid === guid)
    if (!existing) return Promise.reject(new Error('Interest level not found'))
    return Promise.resolve(existing)
  }
  return apiGet<InterestLevel>(`/api/v1/admissions/interest-levels/${guid}`)
}

// Update an interest level by GUID and return the updated record.
export function updateInterestLevel(guid: string, input: InterestLevelInput): Promise<InterestLevel> {
  if (MOCK_AUTH) {
    const existing = mockInterestLevels.find(l => l.interestLevelGuid === guid)
    if (!existing) return Promise.reject(new Error('Interest level not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<InterestLevel>(`/api/v1/admissions/interest-levels/${guid}`, input)
}

// Delete an interest level and return true when the API confirms success.
export function deleteInterestLevel(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockInterestLevels.findIndex(l => l.interestLevelGuid === guid)
    if (index === -1) return Promise.reject(new Error('Interest level not found'))
    mockInterestLevels.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/admissions/interest-levels/${guid}`)
}
