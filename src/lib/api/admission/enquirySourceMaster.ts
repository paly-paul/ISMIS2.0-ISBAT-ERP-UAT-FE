import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Distinct from enquirySource.ts (isbat-enquiry-sources, backs
// /config/enquiry-source, "Isbat Enquiry Source" in the UI) — this is a
// separate backend resource (/api/v1/admissions/enquiry-sources) with its
// own guid space and field names. Only GET (list) and POST are confirmed
// against a real spec; GetByGuid/PUT/DELETE below are inferred by the same
// /{guid} REST convention the rest of this app uses (same inference already
// made — and flagged the same way — for enquirySource.ts/followUpMode.ts/
// interestLevel.ts), not confirmed against a spec of their own yet.
export interface EnquirySourceMaster {
  enquirySourceGuid: string
  enquirySourceName: string
}

// Payload used when creating an enquiry source.
export type EnquirySourceMasterInput = Omit<EnquirySourceMaster, 'enquirySourceGuid'>

// In-memory list used only when mock auth is enabled.
const mockEnquirySourceMasters: EnquirySourceMaster[] = [
  { enquirySourceGuid: 'b0af8d2d-75d3-4321-b88b-ea2a751b8e70', enquirySourceName: 'Social Media' },
]

// Fetch all enquiry sources.
export function getEnquirySourceMasters(): Promise<EnquirySourceMaster[]> {
  if (MOCK_AUTH) return Promise.resolve(mockEnquirySourceMasters)
  return apiGet<EnquirySourceMaster[] | null>('/api/v1/admissions/enquiry-sources').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new enquiry source and return the saved record.
export function createEnquirySourceMaster(input: EnquirySourceMasterInput): Promise<EnquirySourceMaster> {
  if (MOCK_AUTH) {
    const source: EnquirySourceMaster = { enquirySourceGuid: crypto.randomUUID(), ...input }
    mockEnquirySourceMasters.push(source)
    return Promise.resolve(source)
  }
  return apiPost<EnquirySourceMaster>('/api/v1/admissions/enquiry-sources', input)
}

// Fetch one enquiry source by its GUID.
export function getEnquirySourceMasterById(guid: string): Promise<EnquirySourceMaster> {
  if (MOCK_AUTH) {
    const existing = mockEnquirySourceMasters.find(s => s.enquirySourceGuid === guid)
    if (!existing) return Promise.reject(new Error('Enquiry source not found'))
    return Promise.resolve(existing)
  }
  return apiGet<EnquirySourceMaster>(`/api/v1/admissions/enquiry-sources/${guid}`)
}

// Update an enquiry source by GUID and return the updated record.
export function updateEnquirySourceMaster(guid: string, input: EnquirySourceMasterInput): Promise<EnquirySourceMaster> {
  if (MOCK_AUTH) {
    const existing = mockEnquirySourceMasters.find(s => s.enquirySourceGuid === guid)
    if (!existing) return Promise.reject(new Error('Enquiry source not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<EnquirySourceMaster>(`/api/v1/admissions/enquiry-sources/${guid}`, input)
}

// Delete an enquiry source and return true when the API confirms success.
export function deleteEnquirySourceMaster(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockEnquirySourceMasters.findIndex(s => s.enquirySourceGuid === guid)
    if (index === -1) return Promise.reject(new Error('Enquiry source not found'))
    mockEnquirySourceMasters.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/admissions/enquiry-sources/${guid}`)
}
