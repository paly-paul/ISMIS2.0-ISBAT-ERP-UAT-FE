import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Previous mock-only shape (pre GET /api/v1/academic/campus integration) —
// kept for reference. Field set is otherwise identical to the real API,
// just id -> campusGuid.
// export interface Campus {
//   id: string
//   campusCode: string
//   campusName: string
//   location: string
//   address: string
//   contact: string
// }
//
// export type CampusInput = Omit<Campus, 'id'>
//
// const mockCampuses: Campus[] = [
//   { id: '1', campusCode: 'MKL', campusName: 'Makerere Campus',     location: 'Kampala', address: 'Plot 5, Makerere Hill Road',  contact: '+256 414 530 000' },
//   { id: '2', campusCode: 'KAM', campusName: 'Kampala City Campus', location: 'Kampala', address: '14 Kampala Road, City Centre', contact: '+256 414 230 100' },
//   { id: '3', campusCode: 'MBR', campusName: 'Mbarara Campus',      location: 'Mbarara', address: 'Kakoba Road, Mbarara',         contact: '+256 485 660 200' },
//   { id: '4', campusCode: 'GUL', campusName: 'Gulu Campus',         location: 'Gulu',    address: 'Acholi Quarters, Gulu',        contact: '+256 471 432 100' },
// ]
//
// export function getCampuses(): Promise<Campus[]> {
//   return Promise.resolve(mockCampuses)
// }
//
// export function createCampus(input: CampusInput): Promise<Campus> {
//   const campus: Campus = { id: String(mockCampuses.length + 1), ...input }
//   mockCampuses.push(campus)
//   return Promise.resolve(campus)
// }
//
// export function updateCampus(id: string, input: CampusInput): Promise<Campus> {
//   const existing = mockCampuses.find(c => c.id === id)
//   if (!existing) return Promise.reject(new Error('Campus not found'))
//   Object.assign(existing, input)
//   return Promise.resolve(existing)
// }

// Represents a campus record returned by the API.
export interface Campus {
  campusGuid: string
  campusCode: string
  campusName: string
  location: string
  address: string
  contact: string
}

// Payload used when creating or updating a campus.
export type CampusInput = Omit<Campus, 'campusGuid'>

// Response wrapper for the paginated campus list endpoint.
interface CampusListResponse {
  items: Campus[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockCampuses: Campus[] = [
  { campusGuid: '1', campusCode: 'MKL', campusName: 'Makerere Campus',     location: 'Kampala', address: 'Plot 5, Makerere Hill Road',  contact: '+256 414 530 000' },
  { campusGuid: '2', campusCode: 'KAM', campusName: 'Kampala City Campus', location: 'Kampala', address: '14 Kampala Road, City Centre', contact: '+256 414 230 100' },
  { campusGuid: '3', campusCode: 'MBR', campusName: 'Mbarara Campus',      location: 'Mbarara', address: 'Kakoba Road, Mbarara',         contact: '+256 485 660 200' },
  { campusGuid: '4', campusCode: 'GUL', campusName: 'Gulu Campus',         location: 'Gulu',    address: 'Acholi Quarters, Gulu',        contact: '+256 471 432 100' },
]
let mockCampusSeq = mockCampuses.length + 1

export function getCampuses(page = 1, pageSize = 10): Promise<Campus[]> {
  if (MOCK_AUTH) return Promise.resolve(mockCampuses)
  return apiGet<CampusListResponse | null>(`/api/v1/academic/campus?page=${page}&pageSize=${pageSize}`).then(data => data?.items ?? [])
}

// Lightweight data used for campus dropdowns.
export interface CampusDropdownItem {
  campusGuid: string
  campusName: string
}

export function getCampusDropdown(): Promise<CampusDropdownItem[]> {
  if (MOCK_AUTH) return Promise.resolve(mockCampuses.map(({ campusGuid, campusName }) => ({ campusGuid, campusName })))
  return apiGet<CampusDropdownItem[] | null>('/api/v1/academic/campus/dropdown').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a campus and return the saved record.
export function createCampus(input: CampusInput): Promise<Campus> {
  if (MOCK_AUTH) {
    const campus: Campus = { campusGuid: String(mockCampusSeq++), ...input }
    mockCampuses.push(campus)
    return Promise.resolve(campus)
  }
  return apiPost<Campus>('/api/v1/academic/campus', input)
}

// Update an existing campus by ID and return the updated record.
export function updateCampus(id: string, input: CampusInput): Promise<Campus> {
  if (MOCK_AUTH) {
    const existing = mockCampuses.find(c => c.campusGuid === id)
    if (!existing) return Promise.reject(new Error('Campus not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Campus>(`/api/v1/academic/campus/${id}`, input)
}

// Delete a campus and return true when the API confirms success.
export function deleteCampus(id: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockCampuses.findIndex(c => c.campusGuid === id)
    if (index === -1) return Promise.reject(new Error('Campus not found'))
    mockCampuses.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/campus/${id}`)
}
