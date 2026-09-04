import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a unit category record returned by the API.
export interface UnitCategory {
  unitCatGuid: string
  unitCatName: string
}

// Payload used when creating or updating a unit category.
export type UnitCategoryInput = Omit<UnitCategory, 'unitCatGuid'>

// In-memory list used only when mock auth is enabled.
const mockUnitCategories: UnitCategory[] = [
  { unitCatGuid: '1', unitCatName: 'Core' },
  { unitCatGuid: '2', unitCatName: 'Specialization' },
  { unitCatGuid: '3', unitCatName: 'Elective' },
]

// Fetch all unit categories.
export function getUnitCategories(): Promise<UnitCategory[]> {
  if (MOCK_AUTH) return Promise.resolve(mockUnitCategories)
  return apiGet<UnitCategory[] | null>('/api/v1/academic/unit-categories').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new unit category and return the saved record.
export function createUnitCategory(input: UnitCategoryInput): Promise<UnitCategory> {
  if (MOCK_AUTH) {
    const unitCategory: UnitCategory = { unitCatGuid: crypto.randomUUID(), ...input }
    mockUnitCategories.push(unitCategory)
    return Promise.resolve(unitCategory)
  }
  return apiPost<UnitCategory>('/api/v1/academic/unit-categories', input)
}

// Fetch one unit category by its GUID.
export function getUnitCategoryById(guid: string): Promise<UnitCategory> {
  if (MOCK_AUTH) {
    const existing = mockUnitCategories.find(u => u.unitCatGuid === guid)
    if (!existing) return Promise.reject(new Error('Unit Category not found'))
    return Promise.resolve(existing)
  }
  return apiGet<UnitCategory>(`/api/v1/academic/unit-categories/${guid}`)
}

// Update a unit category by GUID and return the updated record.
export function updateUnitCategory(guid: string, input: UnitCategoryInput): Promise<UnitCategory> {
  if (MOCK_AUTH) {
    const existing = mockUnitCategories.find(u => u.unitCatGuid === guid)
    if (!existing) return Promise.reject(new Error('Unit Category not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<UnitCategory>(`/api/v1/academic/unit-categories/${guid}`, input)
}

// Delete a unit category and return true when the API confirms success.
export function deleteUnitCategory(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockUnitCategories.findIndex(u => u.unitCatGuid === guid)
    if (index === -1) return Promise.reject(new Error('Unit Category not found'))
    mockUnitCategories.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/unit-categories/${guid}`)
}
