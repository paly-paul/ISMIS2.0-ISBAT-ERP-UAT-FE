import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Older mock shape kept for reference.
// export interface Department {
//   id: string
//   shortCode: string
//   deptName: string
//   faculty: string
//   status: string
// }
//
// export type DepartmentInput = Omit<Department, 'id'>
//
// const mockDepartments: Department[] = [
//   { id: '1', shortCode: 'CS',  deptName: 'Computer Science',        faculty: 'Faculty of Computing',       status: 'Active'   },
//   { id: '2', shortCode: 'IT',  deptName: 'Information Technology',  faculty: 'Faculty of Computing',       status: 'Active'   },
//   { id: '3', shortCode: 'BUS', deptName: 'Business Administration', faculty: 'Faculty of Business',        status: 'Active'   },
//   { id: '4', shortCode: 'ACC', deptName: 'Accounting & Finance',    faculty: 'Faculty of Business',        status: 'Inactive' },
//   { id: '5', shortCode: 'ENG', deptName: 'Civil Engineering',       faculty: 'Faculty of Engineering',     status: 'Active'   },
//   { id: '6', shortCode: 'NUR', deptName: 'Nursing Sciences',        faculty: 'Faculty of Health Sciences', status: 'Active'   },
// ]
//
// export function getDepartments(): Promise<Department[]> {
//   return Promise.resolve(mockDepartments)
// }
//
// export function createDepartment(input: DepartmentInput): Promise<Department> {
//   const department: Department = { id: String(mockDepartments.length + 1), ...input }
//   mockDepartments.push(department)
//   return Promise.resolve(department)
// }
//
// export function updateDepartment(id: string, input: DepartmentInput): Promise<Department> {
//   const existing = mockDepartments.find(d => d.id === id)
//   if (!existing) return Promise.reject(new Error('Department not found'))
//   Object.assign(existing, input)
//   return Promise.resolve(existing)
// }

// Current API shape for departments.
export interface Department {
  intDept: number
  shortCode: string
  deptName: string
  employeeGuid: string | null
}

export type DepartmentInput = Omit<Department, 'intDept'>

export interface DepartmentListResponse {
  items: Department[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockDepartments: Department[] = [
  { intDept: 1, shortCode: 'CS',  deptName: 'Computer Science',        employeeGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
  { intDept: 2, shortCode: 'IT',  deptName: 'Information Technology',  employeeGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
  { intDept: 3, shortCode: 'BUS', deptName: 'Business Administration', employeeGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
  { intDept: 4, shortCode: 'ACC', deptName: 'Accounting & Finance',    employeeGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
  { intDept: 5, shortCode: 'ENG', deptName: 'Civil Engineering',       employeeGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
  { intDept: 6, shortCode: 'NUR', deptName: 'Nursing Sciences',        employeeGuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
]
let mockDeptSeq = mockDepartments.length + 1

export function getDepartments(page = 1, pageSize = 10): Promise<Department[]> {
  if (MOCK_AUTH) return Promise.resolve(mockDepartments)
  return apiGet<DepartmentListResponse | null>(`/api/v1/users/departments?page=${page}&pageSize=${pageSize}`).then(data => data?.items ?? [])
}

// Same list endpoint, envelope kept intact (not reduced to just .items) —
// backs a server-paginated infinite-scroll picker (useSearchDepartmentsInfinite)
// in place of loading the whole list in one eager fetch. get-departments.md
// documents no `search` query param on this endpoint ("No search param —
// unlike Faculty/Intake, this endpoint has no server-side filtering"), so
// there's no text to forward server-side here — only page/pageSize.
export function getDepartmentsPaged(page = 1, pageSize = 20): Promise<DepartmentListResponse> {
  if (MOCK_AUTH) {
    const start = (page - 1) * pageSize
    return Promise.resolve({ items: mockDepartments.slice(start, start + pageSize), totalCount: mockDepartments.length, pageNumber: page, pageSize })
  }
  return apiGet<DepartmentListResponse | null>(`/api/v1/users/departments?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Picker shape from GET /api/v1/users/departments/dropdown
// (get-departments-dropdown.md, 2026-10-15) — the only department source
// that carries deptGuid, which POST/PUT /employees needs.
export interface DepartmentDropdownItem {
  deptGuid: string
  deptName: string
  shortCode: string | null
}

// Mock guids, index-aligned with mockDepartments — designation.ts's mock
// dropdown maps intDept to these so the cascade works in mock mode too.
const mockDepartmentGuids = [
  '67ec501a-1ed8-4fa5-b84e-c79cef3a1076',
  '3b1e2f4a-0c6d-4a8e-9b2f-1d5c7e9a0b11',
  '5c2d3e4f-1a7b-4c9d-8e0f-2a6b8c0d1e22',
  '7d3e4f5a-2b8c-4dae-9f1a-3b7c9d1e2f33',
  '9e4f5a6b-3c9d-4ebf-8a2b-4c8d0e2f3a44',
  'af5a6b7c-4dae-4fca-9b3c-5d9e1f3a4b55',
]

export function getDepartmentsDropdown(): Promise<DepartmentDropdownItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockDepartments.map((d, i) => ({ deptGuid: mockDepartmentGuids[i] ?? String(d.intDept), deptName: d.deptName, shortCode: d.shortCode })))
  }
  return apiGet<DepartmentDropdownItem[] | null>('/api/v1/users/departments/dropdown').then(data => data ?? [])
}

export function createDepartment(input: DepartmentInput): Promise<Department> {
  if (MOCK_AUTH) {
    const department: Department = { intDept: mockDeptSeq++, ...input }
    mockDepartments.push(department)
    return Promise.resolve(department)
  }
  return apiPost<Department>('/api/v1/users/departments', input)
}

export function updateDepartment(id: string, input: DepartmentInput): Promise<Department> {
  if (MOCK_AUTH) {
    const existing = mockDepartments.find(d => String(d.intDept) === id)
    if (!existing) return Promise.reject(new Error('Department not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Department>(`/api/v1/users/departments/${id}`, input)
}

// Delete a department. The API returns true on success.
export function deleteDepartment(id: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockDepartments.findIndex(d => String(d.intDept) === id)
    if (index === -1) return Promise.reject(new Error('Department not found'))
    mockDepartments.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/users/departments/${id}`)
}
