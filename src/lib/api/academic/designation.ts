import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Older mock shape kept for reference.
// export interface Designation {
//   id: string
//   designationName: string
//   department: string
// }
//
// export type DesignationInput = Omit<Designation, 'id'>
//
// const mockDesignations: Designation[] = [
//   { id: '1', designationName: 'Professor',           department: 'Computer Science' },
//   { id: '2', designationName: 'Associate Professor', department: 'Computer Science' },
//   { id: '3', designationName: 'Senior Lecturer',     department: 'Information Technology' },
//   { id: '4', designationName: 'Lecturer',            department: 'Business Administration' },
//   { id: '5', designationName: 'Assistant Lecturer',  department: 'Civil Engineering' },
//   { id: '6', designationName: 'Teaching Assistant',  department: 'Nursing Sciences' },
// ]
//
// export function getDesignations(): Promise<Designation[]> {
//   return Promise.resolve(mockDesignations)
// }
//
// export function createDesignation(input: DesignationInput): Promise<Designation> {
//   const designation: Designation = { id: String(mockDesignations.length + 1), ...input }
//   mockDesignations.push(designation)
//   return Promise.resolve(designation)
// }
//
// export function updateDesignation(id: string, input: DesignationInput): Promise<Designation> {
//   const existing = mockDesignations.find(d => d.id === id)
//   if (!existing) return Promise.reject(new Error('Designation not found'))
//   Object.assign(existing, input)
//   return Promise.resolve(existing)
// }

// Represents a designation record returned by the API.
export interface Designation {
  intDesignation: number
  designationName: string
  intDept: number
}

// Payload used when creating or updating a designation.
export type DesignationInput = Omit<Designation, 'intDesignation'>

// Response wrapper used by the paginated designation list endpoint.
export interface DesignationListResponse {
  items: Designation[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockDesignations: Designation[] = [
  { intDesignation: 1, designationName: 'Professor',           intDept: 1 },
  { intDesignation: 2, designationName: 'Associate Professor', intDept: 1 },
  { intDesignation: 3, designationName: 'Senior Lecturer',     intDept: 2 },
  { intDesignation: 4, designationName: 'Lecturer',            intDept: 3 },
  { intDesignation: 5, designationName: 'Assistant Lecturer',  intDept: 5 },
  { intDesignation: 6, designationName: 'Teaching Assistant',  intDept: 6 },
]
let mockDesignationSeq = mockDesignations.length + 1

// Fetch the designation list, using mock data when the mock auth flag is enabled.
export function getDesignations(page = 1, pageSize = 10): Promise<Designation[]> {
  if (MOCK_AUTH) return Promise.resolve(mockDesignations)
  return apiGet<DesignationListResponse | null>(`/api/v1/users/designations?page=${page}&pageSize=${pageSize}`).then(data => data?.items ?? [])
}

// Same list endpoint, envelope kept intact — backs a server-paginated
// infinite-scroll picker (useSearchDesignationsInfinite) in place of loading
// the whole list in one eager fetch. get-designations.md documents no
// `search` param and no department-filter param either, so this can't be
// narrowed server-side by either text or department — only page/pageSize.
export function getDesignationsPaged(page = 1, pageSize = 20): Promise<DesignationListResponse> {
  if (MOCK_AUTH) {
    const start = (page - 1) * pageSize
    return Promise.resolve({ items: mockDesignations.slice(start, start + pageSize), totalCount: mockDesignations.length, pageNumber: page, pageSize })
  }
  return apiGet<DesignationListResponse | null>(`/api/v1/users/designations?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Picker shape from GET /api/v1/users/designations/dropdown
// (get-designations-dropdown.md, 2026-10-15) — carries designationGuid for
// POST/PUT /employees, and filters by the picked department's deptGuid.
export interface DesignationDropdownItem {
  designationGuid: string
  designationName: string
  deptGuid: string
}

// Mock designations' intDept → the mock department dropdown's deptGuid
// (department.ts), so the cascade behaves in mock mode too.
const mockDeptGuidByInt: Record<number, string> = {
  1: '67ec501a-1ed8-4fa5-b84e-c79cef3a1076',
  2: '3b1e2f4a-0c6d-4a8e-9b2f-1d5c7e9a0b11',
  3: '5c2d3e4f-1a7b-4c9d-8e0f-2a6b8c0d1e22',
  4: '7d3e4f5a-2b8c-4dae-9f1a-3b7c9d1e2f33',
  5: '9e4f5a6b-3c9d-4ebf-8a2b-4c8d0e2f3a44',
  6: 'af5a6b7c-4dae-4fca-9b3c-5d9e1f3a4b55',
}

export function getDesignationsDropdown(deptGuid?: string): Promise<DesignationDropdownItem[]> {
  if (MOCK_AUTH) {
    const items = mockDesignations.map(d => ({
      designationGuid: `00000000-0000-4000-8000-${String(d.intDesignation).padStart(12, '0')}`,
      designationName: d.designationName,
      deptGuid: mockDeptGuidByInt[d.intDept] ?? '',
    }))
    return Promise.resolve(deptGuid ? items.filter(d => d.deptGuid === deptGuid) : items)
  }
  const query = deptGuid ? `?deptGuid=${encodeURIComponent(deptGuid)}` : ''
  return apiGet<DesignationDropdownItem[] | null>(`/api/v1/users/designations/dropdown${query}`).then(data => data ?? [])
}

// Create a new designation and return the saved record.
export function createDesignation(input: DesignationInput): Promise<Designation> {
  if (MOCK_AUTH) {
    const designation: Designation = { intDesignation: mockDesignationSeq++, ...input }
    mockDesignations.push(designation)
    return Promise.resolve(designation)
  }
  return apiPost<Designation>('/api/v1/users/designations', input)
}

// Update an existing designation by ID and return the updated record.
export function updateDesignation(id: string, input: DesignationInput): Promise<Designation> {
  if (MOCK_AUTH) {
    const existing = mockDesignations.find(d => String(d.intDesignation) === id)
    if (!existing) return Promise.reject(new Error('Designation not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Designation>(`/api/v1/users/designations/${id}`, input)
}

// Delete a designation and return true when the API confirms success.
export function deleteDesignation(id: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockDesignations.findIndex(d => String(d.intDesignation) === id)
    if (index === -1) return Promise.reject(new Error('Designation not found'))
    mockDesignations.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/users/designations/${id}`)
}
