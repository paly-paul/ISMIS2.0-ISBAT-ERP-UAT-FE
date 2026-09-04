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

interface DepartmentListResponse {
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
