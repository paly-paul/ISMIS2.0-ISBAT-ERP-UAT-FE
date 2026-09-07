import { apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Lightweight employee record used by the list view.
export interface EmployeeListItem {
  employeeGuid: string
  shortCode: string
  empName: string
  title: string
  surname: string
  firstName: string
  sex: number
  isApproved: boolean
}

export interface EmployeeListResponse {
  items: EmployeeListItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Full employee record returned by the API.
export interface Employee {
  employeeGuid: string
  shortCode: string
  empName: string
  category: number
  title: string
  surname: string
  firstName: string
  otherName: string | null
  sex: number
  birthDate: string
  placeOfBirth: string
  intCountryCode: number
  natId: string
  nationalId: string | null
  emailId: string
  intReligion?: number | null
  maritalStatus: number
  countryName: string | null
  isApproved?: boolean
  intDept?: number | null
  intDesignation?: number | null
}

// Payload used when creating a new employee.
export interface CreateEmployeeInput {
  category: number
  categoryPrefix: string
  title: string
  surname: string
  firstName: string
  otherName: string | null
  sex: number
  birthDate: string
  placeOfBirth: string
  intCountryCode: number
  natId: string
  nationalId: string | null
  emailId: string
  intReligion: number | null
  maritalStatus: number
  intDept: number
  intDesignation: number
}

// In-memory employee list used while mock auth is enabled.
const mockEmployees: EmployeeListItem[] = [
  { employeeGuid: '487c8f38-9db6-45ee-897b-32e2942e8e21', shortCode: 'AD/00111', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: 'b48bd2c6-6db1-4860-9e2e-0572cf92c079', shortCode: 'AD/00103', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: 'e07dc913-e0c4-45c8-839e-64f93250b35e', shortCode: 'AD/00102', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: 'ada0ced2-f3ca-4fd6-af9e-35cfc3f88415', shortCode: 'AD/00101', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: 'e9c923f8-6abe-49e3-a3f9-2dcc6e1578ca', shortCode: 'AD/00091', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: 'b2664414-50d6-4c5e-9bc6-6aed0737513b', shortCode: 'AD/00081', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: '0f8cbe96-579d-42d2-b94d-9aee22edcdbf', shortCode: 'AD/00071', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: '33703b3c-7e87-42e1-8726-8a9caf354bdd', shortCode: 'AD/00062', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: 'e2945c12-b66f-4acc-84db-3dbf90ab1fa1', shortCode: 'AD/00061', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
  { employeeGuid: '4c9649c7-b0b2-4637-b7e8-ffd1cffa6b29', shortCode: 'AD/00051', empName: 'DOE JOHN', title: 'Mr', surname: 'DOE', firstName: 'JOHN', sex: 1, isApproved: true },
]
let mockEmployeeSeq = 121

// Build the display name in the same format returned by the API.
function composeEmpName(surname: string, firstName: string, otherName: string | null): string {
  return [surname, firstName, otherName].filter(Boolean).join(' ').toUpperCase()
}

// Fetch the employee list for the UI. The backend paginates this endpoint
// (defaults to pageSize: 10 when unspecified — confirmed via a real
// response), so page/pageSize must be sent explicitly or the table only ever
// sees the first page no matter what the client-side Pagination component
// does on top of it. Same convention as getFaculties/getEmployees siblings.
// search is forwarded to the endpoint's own ?search= param — confirmed live
// against the real backend (search=<name substring> narrows totalCount from
// 229 down to an exact match; a nonsense query returns totalCount: 0), same
// convention as getSkills/getBatches/getIntakes.
export function getEmployees(page = 1, pageSize = 10, search = ''): Promise<EmployeeListItem[]> {
  if (MOCK_AUTH) {
    const q = search.trim().toLowerCase()
    return Promise.resolve(q ? mockEmployees.filter(e => e.empName.toLowerCase().includes(q) || e.shortCode.toLowerCase().includes(q)) : mockEmployees)
  }
  const q = search.trim()
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) params.set('search', q)
  return apiGet<EmployeeListResponse | null>(`/api/v1/users/employees?${params}`).then(data => data?.items ?? [])
}

export interface EmployeeDropdownItemDto {
  employeeGuid: string
  displayName: string
}

export function getEmployeeDropdown(): Promise<EmployeeDropdownItemDto[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockEmployees.filter(e => e.isApproved).map(e => ({
      employeeGuid: e.employeeGuid,
      displayName: `${e.empName} (${e.shortCode})`
    })))
  }
  return apiGet<EmployeeDropdownItemDto[]>('/api/v1/users/employees/dropdown')
}

// Fetch the employee list scoped to pending approvals, for Employee
// Approvals' own list (see employee-approve/page.tsx) — hits the same list
// endpoint as getEmployees but with the server's own ?isApproved=false
// filter and real pageNumber/pageSize pagination, instead of loading
// getEmployees' full 1000-row cache and filtering/paginating client-side.
// Confirmed query shape: ?pageNumber=1&pageSize=10&isApproved=false.
export function getPendingEmployees(pageNumber = 1, pageSize = 10): Promise<EmployeeListResponse> {
  if (MOCK_AUTH) {
    const pending = mockEmployees.filter(e => !e.isApproved)
    const items = pending.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
    return Promise.resolve({ items, totalCount: pending.length, pageNumber, pageSize })
  }
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize), isApproved: 'false' })
  return apiGet<EmployeeListResponse | null>(`/api/v1/users/employees?${params}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

// Fetch the full employee record for the edit form.
export function getEmployee(id: string): Promise<Employee> {
  if (MOCK_AUTH) {
    const listItem = mockEmployees.find(e => e.employeeGuid === id)
    if (!listItem) return Promise.reject(new Error('Employee not found'))
    const employee: Employee = {
      employeeGuid: listItem.employeeGuid,
      shortCode: listItem.shortCode,
      empName: listItem.empName,
      category: 1,
      title: listItem.title,
      surname: listItem.surname,
      firstName: listItem.firstName,
      otherName: null,
      sex: listItem.sex,
      birthDate: '1990-01-01T00:00:00',
      placeOfBirth: '',
      intCountryCode: 1,
      natId: '',
      nationalId: null,
      emailId: '',
      maritalStatus: 1,
      countryName: null,
      isApproved: listItem.isApproved,
      intDept: 1,
      intDesignation: 1,
    }
    return Promise.resolve(employee)
  }
  return apiGet<Employee>(`/api/v1/users/employees/${id}`)
}

// Create a new employee and return the saved record.
export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  if (MOCK_AUTH) {
    const employee: Employee = {
      employeeGuid: crypto.randomUUID(),
      shortCode: `${input.categoryPrefix}/${String(mockEmployeeSeq++).padStart(5, '0')}`,
      empName: composeEmpName(input.surname, input.firstName, input.otherName),
      category: input.category,
      title: input.title,
      surname: input.surname.toUpperCase(),
      firstName: input.firstName.toUpperCase(),
      otherName: input.otherName,
      sex: input.sex,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      intCountryCode: input.intCountryCode,
      natId: input.natId,
      nationalId: input.nationalId,
      emailId: input.emailId,
      intReligion: input.intReligion,
      maritalStatus: input.maritalStatus,
      countryName: null,
      isApproved: false,
      intDept: input.intDept,
      intDesignation: input.intDesignation,
    }
    mockEmployees.push({
      employeeGuid: employee.employeeGuid,
      shortCode: employee.shortCode,
      empName: employee.empName,
      title: employee.title,
      surname: employee.surname,
      firstName: employee.firstName,
      sex: employee.sex,
      isApproved: employee.isApproved ?? false,
    })
    return Promise.resolve(employee)
  }
  return apiPost<Employee>('/api/v1/users/employees', input)
}

export interface AssignPermissionGroupsInput {
  permissionGroupGuids: string[]
}

// Keyed by employeeGuid — lets mock assign/get round-trip within a session
// (an assign call updates this so a later get reflects it), same idea as
// the other domains' mock in-memory arrays.
const mockEmployeePermissionGroups: Record<string, string[]> = {}

// Real shape: an array of { permissionGroupGuid, groupName, description } —
// groupName/description are already available from Permission Master's own
// list (usePermissionGroups), so only the guid is actually needed here.
interface EmployeePermissionGroupApiItem {
  permissionGroupGuid: string
  groupName: string
  description: string
}

// Fetch the permission group guids currently assigned to an employee.
export function getEmployeePermissionGroups(employeeGuid: string): Promise<string[]> {
  if (MOCK_AUTH) return Promise.resolve(mockEmployeePermissionGroups[employeeGuid] ?? [])
  return apiGet<EmployeePermissionGroupApiItem[] | null>(`/api/v1/users/admin/users/${employeeGuid}/permission-groups`)
    .then(data => (data ?? []).map(g => g.permissionGroupGuid))
}

// Assign one or more permission groups (created in Permission Master) to an
// employee. Replaces whatever permission groups the employee currently has.
export function assignEmployeePermissionGroups(employeeGuid: string, input: AssignPermissionGroupsInput): Promise<void> {
  if (MOCK_AUTH) {
    mockEmployeePermissionGroups[employeeGuid] = input.permissionGroupGuids
    return Promise.resolve()
  }
  return apiPut<void>(`/api/v1/users/admin/users/${employeeGuid}/permission-groups`, input)
}

export function updateEmployee(id: string, input: CreateEmployeeInput): Promise<Employee> {
  if (MOCK_AUTH) {
    const listItem = mockEmployees.find(e => e.employeeGuid === id)
    if (!listItem) return Promise.reject(new Error('Employee not found'))
    const empName = composeEmpName(input.surname, input.firstName, input.otherName)
    listItem.title = input.title
    listItem.surname = input.surname.toUpperCase()
    listItem.firstName = input.firstName.toUpperCase()
    listItem.sex = input.sex
    listItem.empName = empName
    const employee: Employee = {
      employeeGuid: id,
      shortCode: listItem.shortCode,
      empName,
      category: input.category,
      title: input.title,
      surname: input.surname.toUpperCase(),
      firstName: input.firstName.toUpperCase(),
      otherName: input.otherName,
      sex: input.sex,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      intCountryCode: input.intCountryCode,
      natId: input.natId,
      nationalId: input.nationalId,
      emailId: input.emailId,
      intReligion: input.intReligion,
      maritalStatus: input.maritalStatus,
      countryName: null,
      isApproved: listItem.isApproved,
      intDept: input.intDept,
      intDesignation: input.intDesignation,
    }
    return Promise.resolve(employee)
  }
  return apiPut<Employee>(`/api/v1/users/employees/${id}`, input)
}

// Approve a pending employee — Employee Approvals' own Approve action (see
// employee-approve/page.tsx). Separate from updateEmployee since this
// dedicated endpoint doesn't need the full CreateEmployeeInput payload the
// generic update route requires.
export function approveEmployee(employeeGuid: string): Promise<void> {
  if (MOCK_AUTH) {
    const listItem = mockEmployees.find(e => e.employeeGuid === employeeGuid)
    if (!listItem) return Promise.reject(new Error('Employee not found'))
    listItem.isApproved = true
    return Promise.resolve()
  }
  return apiPost<void>(`/api/v1/users/employees/${employeeGuid}/approve`, {})
}
