import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via Scheduling/Batch-Times/*.bru — a named study session/shift
// (e.g. "Morning", "Evening"). batchTime: required, max 50 chars.
// batchTimeCode: required, max 10 chars.
export interface BatchTime {
  batchTimeGuid: string
  batchTime: string
  batchTimeCode: string
}

// Payload used when creating or updating a batch time — same body for both.
export type BatchTimeInput = Omit<BatchTime, 'batchTimeGuid'>

// In-memory list used only when mock auth is enabled.
const mockBatchTimes: BatchTime[] = [
  { batchTimeGuid: 'b7e2a1b0-1e3a-4c9a-9c2e-3f6a1b2c3d4e', batchTime: 'Morning', batchTimeCode: 'MRN' },
  { batchTimeGuid: 'c8f3b2c1-2f4b-4d0b-0d3f-4a7b2c3d4e5f', batchTime: 'Evening', batchTimeCode: 'EVE' },
]

// Fetch all batch times.
export function getBatchTimes(): Promise<BatchTime[]> {
  if (MOCK_AUTH) return Promise.resolve(mockBatchTimes)
  return apiGet<BatchTime[] | null>('/api/v1/academic/batchtimes').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new batch time and return the saved record.
export function createBatchTime(input: BatchTimeInput): Promise<BatchTime> {
  if (MOCK_AUTH) {
    const batchTime: BatchTime = { batchTimeGuid: crypto.randomUUID(), ...input }
    mockBatchTimes.push(batchTime)
    return Promise.resolve(batchTime)
  }
  return apiPost<BatchTime>('/api/v1/academic/batchtimes', input)
}

// Fetch one batch time by its GUID.
export function getBatchTimeById(guid: string): Promise<BatchTime> {
  if (MOCK_AUTH) {
    const existing = mockBatchTimes.find(b => b.batchTimeGuid === guid)
    if (!existing) return Promise.reject(new Error('Batch time not found'))
    return Promise.resolve(existing)
  }
  return apiGet<BatchTime>(`/api/v1/academic/batchtimes/${guid}`)
}

// Update a batch time by GUID and return the updated record.
export function updateBatchTime(guid: string, input: BatchTimeInput): Promise<BatchTime> {
  if (MOCK_AUTH) {
    const existing = mockBatchTimes.find(b => b.batchTimeGuid === guid)
    if (!existing) return Promise.reject(new Error('Batch time not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<BatchTime>(`/api/v1/academic/batchtimes/${guid}`, input)
}

// Delete a batch time and return true when the API confirms success.
export function deleteBatchTime(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockBatchTimes.findIndex(b => b.batchTimeGuid === guid)
    if (index === -1) return Promise.reject(new Error('Batch time not found'))
    mockBatchTimes.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/batchtimes/${guid}`)
}
