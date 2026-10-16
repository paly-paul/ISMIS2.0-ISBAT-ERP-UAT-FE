import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Older mock shape kept for reference.
// export interface Faculty {
//   id: string
//   code: string
//   name: string
//   dean: string
//   programmes: number
// }
//
// export type FacultyInput = Omit<Faculty, 'id' | 'programmes'>
//
// const mockFaculties: Faculty[] = [
//   { id: '1', code: 'FCT', name: 'Faculty of Computing & Technology', dean: 'Dr. Ssekibuule Ronald', programmes: 3 },
//   { id: '2', code: 'FBM', name: 'Faculty of Business & Management', dean: 'Prof. Mukasa Charles', programmes: 4 },
//   { id: '3', code: 'FEN', name: 'Faculty of Engineering', dean: 'Dr. Tendo Patrick', programmes: 2 },
// ]
//
// export function getFaculties(): Promise<Faculty[]> {
//   return Promise.resolve(mockFaculties)
// }
//
// export function createFaculty(input: FacultyInput): Promise<Faculty> {
//   const faculty: Faculty = { id: String(mockFaculties.length + 1), programmes: 0, ...input }
//   mockFaculties.push(faculty)
//   return Promise.resolve(faculty)
// }
//
// export function updateFaculty(id: string, input: FacultyInput): Promise<Faculty> {
//   const existing = mockFaculties.find(f => f.id === id)
//   if (!existing) return Promise.reject(new Error('Faculty not found'))
//   Object.assign(existing, input)
//   return Promise.resolve(existing)
// }

// Current API shape for faculties.
export interface Faculty {
  facultyGuid: string
  facultyCode: string
  facultyName: string
  campusGuid: string
  campusName: string
  deanEmployeeGuid: string | null
  deanName: string | null
}

// The create and update payload use the same fields.
export type FacultyInput = {
  facultyCode: string
  facultyName: string
  campusGuid: string
  deanEmployeeGuid: string | null
}

export interface FacultyListResponse {
  items: Faculty[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockFaculties: Faculty[] = [
  { facultyGuid: '1', facultyCode: 'FCT', facultyName: 'Faculty of Computing & Technology', campusGuid: '1', campusName: 'Makerere Campus', deanEmployeeGuid: null, deanName: 'Dr. Ssekibuule Ronald' },
  { facultyGuid: '2', facultyCode: 'FBM', facultyName: 'Faculty of Business & Management', campusGuid: '2', campusName: 'Kampala City Campus', deanEmployeeGuid: null, deanName: 'Prof. Mukasa Charles' },
  { facultyGuid: '3', facultyCode: 'FEN', facultyName: 'Faculty of Engineering', campusGuid: '3', campusName: 'Mbarara Campus', deanEmployeeGuid: null, deanName: 'Dr. Tendo Patrick' },
]
let mockFacultySeq = mockFaculties.length + 1

// search forwarded to the backend's own ?search= param (confirmed live
// 2026-09-10, same as programs/intakes) rather than filtered client-side —
// omitted from the query string entirely when blank.
export function getFaculties(page = 1, pageSize = 10, search = ''): Promise<Faculty[]> {
  if (MOCK_AUTH) return Promise.resolve(mockFaculties)
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<FacultyListResponse | null>(`/api/v1/academic/faculties?${params.toString()}`).then(data => data?.items ?? [])
}

// Real server-side pagination variant (2026-09-10), for FacultySearchPicker's
// infinite scroll — keeps the totalCount/pageNumber/pageSize envelope
// getFaculties() above discards, same convention as getProgramMastersPage/
// getIntakesPaged.
export function getFacultiesPaged(page = 1, pageSize = 10, search = ''): Promise<FacultyListResponse> {
  if (MOCK_AUTH) {
    const q = search.trim().toLowerCase()
    const filtered = q ? mockFaculties.filter(f => f.facultyName.toLowerCase().includes(q) || f.facultyCode.toLowerCase().includes(q)) : mockFaculties
    const start = (page - 1) * pageSize
    return Promise.resolve({ items: filtered.slice(start, start + pageSize), totalCount: filtered.length, pageNumber: page, pageSize })
  }
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search.trim()) params.set('search', search.trim())
  return apiGet<FacultyListResponse | null>(`/api/v1/academic/faculties?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Confirmed live (2026-09-10) — GET /api/v1/academic/faculties/:facultyGuid.
// Backs FacultySearchPicker's label resolution for an already-picked
// facultyGuid (e.g. prefilled from an Edit-mode record) without holding the
// whole faculty list in memory.
export function getFacultyById(guid: string): Promise<Faculty> {
  if (MOCK_AUTH) {
    const found = mockFaculties.find(f => f.facultyGuid === guid)
    if (!found) return Promise.reject(new Error('Faculty not found'))
    return Promise.resolve(found)
  }
  return apiGet<Faculty>(`/api/v1/academic/faculties/${guid}`)
}

export interface FacultyDropdownItem {
  facultyGuid: string
  facultyName: string
  facultyCode?: string
}

// GET /api/v1/academic/faculties/dropdown?campusGuid= — per the bulk-email
// page doc (get-faculty-dropdown.md isn't available locally, so the item
// shape is assumed to match Faculty's own guid/name fields). Unwrapped
// defensively, same as getCampusDropdown/getProgramDropdown.
export function getFacultyDropdown(campusGuid?: string): Promise<FacultyDropdownItem[]> {
  if (MOCK_AUTH) {
    const rows = campusGuid ? mockFaculties.filter(f => f.campusGuid === campusGuid) : mockFaculties
    return Promise.resolve(rows.map(f => ({ facultyGuid: f.facultyGuid, facultyName: f.facultyName, facultyCode: f.facultyCode })))
  }
  const query = campusGuid ? `?campusGuid=${campusGuid}` : ''
  return apiGet<FacultyDropdownItem[] | null>(`/api/v1/academic/faculties/dropdown${query}`)
    .then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

export function createFaculty(input: FacultyInput): Promise<Faculty> {
  if (MOCK_AUTH) {
    // Mock mode does not know the campus name yet, so it stays empty.
    const faculty: Faculty = {
      facultyGuid: String(mockFacultySeq++),
      facultyCode: input.facultyCode,
      facultyName: input.facultyName,
      campusGuid: input.campusGuid,
      campusName: '',
      deanEmployeeGuid: input.deanEmployeeGuid,
      deanName: null,
    }
    mockFaculties.push(faculty)
    return Promise.resolve(faculty)
  }
  return apiPost<Faculty>('/api/v1/academic/faculties', input)
}

// Updating a faculty uses the same payload as creating one.
export function updateFaculty(id: string, input: FacultyInput): Promise<Faculty> {
  if (MOCK_AUTH) {
    const existing = mockFaculties.find(f => f.facultyGuid === id)
    if (!existing) return Promise.reject(new Error('Faculty not found'))
    existing.facultyCode = input.facultyCode
    existing.facultyName = input.facultyName
    existing.campusGuid = input.campusGuid
    existing.deanEmployeeGuid = input.deanEmployeeGuid
    return Promise.resolve(existing)
  }
  return apiPut<Faculty>(`/api/v1/academic/faculties/${id}`, input)
}

// Confirmed via DELETE /api/v1/academic/faculties/:facultyGuid — data is
// null on success. Fails with 404 not_found for an unknown facultyGuid.
export function deleteFaculty(id: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockFaculties.findIndex(f => f.facultyGuid === id)
    if (index === -1) return Promise.reject(new Error('Faculty not found'))
    mockFaculties.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/faculties/${id}`)
}
