import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents an ISBAT enquiry source record returned by the API.
export interface EnquirySource {
  isbatSourceGuid: string
  sourceName: string
}

// Payload used when creating or updating an enquiry source.
export type EnquirySourceInput = Omit<EnquirySource, 'isbatSourceGuid'>

// In-memory list used only when mock auth is enabled.
const mockEnquirySources: EnquirySource[] = [
  { isbatSourceGuid: 'cef5d70c-5ae9-47fd-ac34-34089784e79b', sourceName: 'Open Day' },
]

// Fetch all enquiry sources.
export function getEnquirySources(): Promise<EnquirySource[]> {
  if (MOCK_AUTH) return Promise.resolve(mockEnquirySources)
  return apiGet<EnquirySource[] | null>('/api/v1/admissions/isbat-enquiry-sources').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new enquiry source and return the saved record.
export function createEnquirySource(input: EnquirySourceInput): Promise<EnquirySource> {
  if (MOCK_AUTH) {
    const source: EnquirySource = { isbatSourceGuid: crypto.randomUUID(), ...input }
    mockEnquirySources.push(source)
    return Promise.resolve(source)
  }
  return apiPost<EnquirySource>('/api/v1/admissions/isbat-enquiry-sources', input)
}

// Fetch one enquiry source by its GUID.
export function getEnquirySourceById(guid: string): Promise<EnquirySource> {
  if (MOCK_AUTH) {
    const existing = mockEnquirySources.find(s => s.isbatSourceGuid === guid)
    if (!existing) return Promise.reject(new Error('Enquiry source not found'))
    return Promise.resolve(existing)
  }
  return apiGet<EnquirySource>(`/api/v1/admissions/isbat-enquiry-sources/${guid}`)
}

// Update an enquiry source by GUID and return the updated record.
export function updateEnquirySource(guid: string, input: EnquirySourceInput): Promise<EnquirySource> {
  if (MOCK_AUTH) {
    const existing = mockEnquirySources.find(s => s.isbatSourceGuid === guid)
    if (!existing) return Promise.reject(new Error('Enquiry source not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<EnquirySource>(`/api/v1/admissions/isbat-enquiry-sources/${guid}`, input)
}

// Delete an enquiry source and return true when the API confirms success.
export function deleteEnquirySource(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockEnquirySources.findIndex(s => s.isbatSourceGuid === guid)
    if (index === -1) return Promise.reject(new Error('Enquiry source not found'))
    mockEnquirySources.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/admissions/isbat-enquiry-sources/${guid}`)
}
