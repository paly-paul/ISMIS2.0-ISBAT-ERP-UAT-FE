import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a stream record returned by the API.
export interface Stream {
  streamGuid: string
  streamCode: string
  streamName: string
}

// Payload used when creating or updating a stream.
export type StreamInput = Omit<Stream, 'streamGuid'>

// Response wrapper for the paginated stream list endpoint.
export interface StreamListResponse {
  items: Stream[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockStreams: Stream[] = [
  { streamGuid: '1', streamCode: 'SE',   streamName: 'Software Engineering' },
  { streamGuid: '2', streamCode: 'DS',   streamName: 'Data Science' },
  { streamGuid: '3', streamCode: 'NET',  streamName: 'Networking & Cybersecurity' },
  { streamGuid: '4', streamCode: 'FIN',  streamName: 'Financial Management' },
  { streamGuid: '5', streamCode: 'MKT',  streamName: 'Marketing Management' },
  { streamGuid: '6', streamCode: 'MECH', streamName: 'Mechanical Engineering' },
]

// Fetch the stream list, using mock data when the mock auth flag is enabled.
// search forwarded to the backend's own ?search= param (confirmed live
// 2026-09-10, same as programs/intakes/faculties) rather than filtered
// client-side — omitted from the query string entirely when blank.
export function getStreams(page = 1, pageSize = 10, search = ''): Promise<Stream[]> {
  if (MOCK_AUTH) return Promise.resolve(mockStreams)
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<StreamListResponse | null>(`/api/v1/academic/specializations?${params.toString()}`).then(data => data?.items ?? [])
}

// Real server-side pagination variant (2026-09-10), for
// StreamMultiSearchPicker's infinite scroll — keeps the totalCount/
// pageNumber/pageSize envelope getStreams() above discards, same convention
// as getProgramMastersPage/getIntakesPaged/getFacultiesPaged.
export function getStreamsPaged(page = 1, pageSize = 10, search = ''): Promise<StreamListResponse> {
  if (MOCK_AUTH) {
    const q = search.trim().toLowerCase()
    const filtered = q ? mockStreams.filter(s => s.streamName.toLowerCase().includes(q) || s.streamCode.toLowerCase().includes(q)) : mockStreams
    const start = (page - 1) * pageSize
    return Promise.resolve({ items: filtered.slice(start, start + pageSize), totalCount: filtered.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<StreamListResponse | null>(`/api/v1/academic/specializations?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Create a new stream and return the saved record.
export function createStream(input: StreamInput): Promise<Stream> {
  if (MOCK_AUTH) {
    const stream: Stream = { streamGuid: crypto.randomUUID(), ...input }
    mockStreams.push(stream)
    return Promise.resolve(stream)
  }
  return apiPost<Stream>('/api/v1/academic/specializations', input)
}

// Confirmed via Program_Master_Change_Requests_Final.md /
// Academic/Program-Structure/Specializations/List.bru — same /specializations
// resource as getStreams() above, filtered to one programme's own
// specializations via a programGuid query param. Backs Programme Master's
// Home Page "Specialization" three-dot action. Response envelope assumed to
// match the plain list (same endpoint, same controller action) since no
// distinct sample was given for the filtered variant — flag and re-check if
// it turns out to differ.
export function getSpecializationsForProgram(programGuid: string): Promise<Stream[]> {
  if (MOCK_AUTH) return Promise.resolve(mockStreams)
  return apiGet<StreamListResponse | null>(`/api/v1/academic/specializations?programGuid=${encodeURIComponent(programGuid)}`)
    .then(data => data?.items ?? [])
}

// Fetch one stream by its GUID.
export function getStreamById(guid: string): Promise<Stream> {
  if (MOCK_AUTH) {
    const existing = mockStreams.find(s => s.streamGuid === guid)
    if (!existing) return Promise.reject(new Error('Stream not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Stream>(`/api/v1/academic/specializations/${guid}`)
}

// Update a stream by GUID and return the updated record.
export function updateStream(guid: string, input: StreamInput): Promise<Stream> {
  if (MOCK_AUTH) {
    const existing = mockStreams.find(s => s.streamGuid === guid)
    if (!existing) return Promise.reject(new Error('Stream not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Stream>(`/api/v1/academic/specializations/${guid}`, input)
}

// Delete a stream and return true when the API confirms success.
export function deleteStream(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockStreams.findIndex(s => s.streamGuid === guid)
    if (index === -1) return Promise.reject(new Error('Stream not found'))
    mockStreams.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/specializations/${guid}`)
}
