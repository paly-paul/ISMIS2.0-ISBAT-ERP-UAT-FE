import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a follow-up status record returned by the API.
export interface FollowUpStatus {
  followUpStatusGuid: string
  followUpStatusName: string
  followUpStatusCode: string
  // 0/1 flag (not a bool) — mirrors the country.ts defaultCountry convention.
  isClose: number
}

// Payload used when creating or updating a follow-up status.
export type FollowUpStatusInput = Omit<FollowUpStatus, 'followUpStatusGuid'>

// In-memory list used only when mock auth is enabled.
const mockFollowUpStatuses: FollowUpStatus[] = [
  { followUpStatusGuid: 'dcc20a08-3d99-4cff-8b15-510a1e743bae', followUpStatusName: 'Test', followUpStatusCode: 'T1', isClose: 1 },
]

// Fetch all follow-up statuses.
export function getFollowUpStatuses(): Promise<FollowUpStatus[]> {
  if (MOCK_AUTH) return Promise.resolve(mockFollowUpStatuses)
  return apiGet<FollowUpStatus[] | null>('/api/v1/admissions/follow-up-statuses').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new follow-up status and return the saved record.
export function createFollowUpStatus(input: FollowUpStatusInput): Promise<FollowUpStatus> {
  if (MOCK_AUTH) {
    const followUpStatus: FollowUpStatus = { followUpStatusGuid: crypto.randomUUID(), ...input }
    mockFollowUpStatuses.push(followUpStatus)
    return Promise.resolve(followUpStatus)
  }
  return apiPost<FollowUpStatus>('/api/v1/admissions/follow-up-statuses', input)
}

// Fetch one follow-up status by its GUID.
export function getFollowUpStatusById(guid: string): Promise<FollowUpStatus> {
  if (MOCK_AUTH) {
    const existing = mockFollowUpStatuses.find(s => s.followUpStatusGuid === guid)
    if (!existing) return Promise.reject(new Error('Followup status not found'))
    return Promise.resolve(existing)
  }
  return apiGet<FollowUpStatus>(`/api/v1/admissions/follow-up-statuses/${guid}`)
}

// Update a follow-up status by GUID and return the updated record.
export function updateFollowUpStatus(guid: string, input: FollowUpStatusInput): Promise<FollowUpStatus> {
  if (MOCK_AUTH) {
    const existing = mockFollowUpStatuses.find(s => s.followUpStatusGuid === guid)
    if (!existing) return Promise.reject(new Error('Followup status not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<FollowUpStatus>(`/api/v1/admissions/follow-up-statuses/${guid}`, input)
}

// Delete a follow-up status and return true when the API confirms success.
export function deleteFollowUpStatus(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockFollowUpStatuses.findIndex(s => s.followUpStatusGuid === guid)
    if (index === -1) return Promise.reject(new Error('Followup status not found'))
    mockFollowUpStatuses.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/admissions/follow-up-statuses/${guid}`)
}
