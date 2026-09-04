import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents an admission followup mode record returned by the API.
export interface FollowUpMode {
  followUpModeGuid: string
  followUpModeName: string
}

// Payload used when creating or updating a followup mode.
export type FollowUpModeInput = Omit<FollowUpMode, 'followUpModeGuid'>

// In-memory list used only when mock auth is enabled.
const mockFollowUpModes: FollowUpMode[] = [
  { followUpModeGuid: '951d4f02-578d-45d3-a733-834f4c63f761', followUpModeName: 'Phone Call' },
]

// Fetch all followup modes.
export function getFollowUpModes(): Promise<FollowUpMode[]> {
  if (MOCK_AUTH) return Promise.resolve(mockFollowUpModes)
  return apiGet<FollowUpMode[] | null>('/api/v1/admissions/followup-modes').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new followup mode and return the saved record.
export function createFollowUpMode(input: FollowUpModeInput): Promise<FollowUpMode> {
  if (MOCK_AUTH) {
    const mode: FollowUpMode = { followUpModeGuid: crypto.randomUUID(), ...input }
    mockFollowUpModes.push(mode)
    return Promise.resolve(mode)
  }
  return apiPost<FollowUpMode>('/api/v1/admissions/followup-modes', input)
}

// Fetch one followup mode by its GUID.
export function getFollowUpModeById(guid: string): Promise<FollowUpMode> {
  if (MOCK_AUTH) {
    const existing = mockFollowUpModes.find(m => m.followUpModeGuid === guid)
    if (!existing) return Promise.reject(new Error('Followup mode not found'))
    return Promise.resolve(existing)
  }
  return apiGet<FollowUpMode>(`/api/v1/admissions/followup-modes/${guid}`)
}

// Update a followup mode by GUID and return the updated record.
export function updateFollowUpMode(guid: string, input: FollowUpModeInput): Promise<FollowUpMode> {
  if (MOCK_AUTH) {
    const existing = mockFollowUpModes.find(m => m.followUpModeGuid === guid)
    if (!existing) return Promise.reject(new Error('Followup mode not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<FollowUpMode>(`/api/v1/admissions/followup-modes/${guid}`, input)
}

// Delete a followup mode and return true when the API confirms success.
export function deleteFollowUpMode(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockFollowUpModes.findIndex(m => m.followUpModeGuid === guid)
    if (index === -1) return Promise.reject(new Error('Followup mode not found'))
    mockFollowUpModes.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/admissions/followup-modes/${guid}`)
}
