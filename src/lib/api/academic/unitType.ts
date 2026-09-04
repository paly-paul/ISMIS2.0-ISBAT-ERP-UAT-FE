import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a unit type record returned by the API.
export interface UnitType {
  unitTypeGuid: string
  unitTypeName: string
}

// Payload used when creating or updating a unit type.
export type UnitTypeInput = Omit<UnitType, 'unitTypeGuid'>

// In-memory list used only when mock auth is enabled.
const mockUnitTypes: UnitType[] = [
  { unitTypeGuid: '1', unitTypeName: 'Theory' },
  { unitTypeGuid: '2', unitTypeName: 'Practical' },
  { unitTypeGuid: '3', unitTypeName: 'Combined' },
  { unitTypeGuid: '4', unitTypeName: 'Project' },
]

// Fetch all unit types.
export function getUnitTypes(): Promise<UnitType[]> {
  if (MOCK_AUTH) return Promise.resolve(mockUnitTypes)
  return apiGet<UnitType[] | null>('/api/v1/academic/unit-types').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new unit type and return the saved record.
export function createUnitType(input: UnitTypeInput): Promise<UnitType> {
  if (MOCK_AUTH) {
    const unitType: UnitType = { unitTypeGuid: crypto.randomUUID(), ...input }
    mockUnitTypes.push(unitType)
    return Promise.resolve(unitType)
  }
  return apiPost<UnitType>('/api/v1/academic/unit-types', input)
}

// Fetch one unit type by its GUID.
export function getUnitTypeById(guid: string): Promise<UnitType> {
  if (MOCK_AUTH) {
    const existing = mockUnitTypes.find(u => u.unitTypeGuid === guid)
    if (!existing) return Promise.reject(new Error('Unit Type not found'))
    return Promise.resolve(existing)
  }
  return apiGet<UnitType>(`/api/v1/academic/unit-types/${guid}`)
}

// Update a unit type by GUID and return the updated record.
export function updateUnitType(guid: string, input: UnitTypeInput): Promise<UnitType> {
  if (MOCK_AUTH) {
    const existing = mockUnitTypes.find(u => u.unitTypeGuid === guid)
    if (!existing) return Promise.reject(new Error('Unit Type not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<UnitType>(`/api/v1/academic/unit-types/${guid}`, input)
}

// Delete a unit type and return true when the API confirms success.
export function deleteUnitType(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockUnitTypes.findIndex(u => u.unitTypeGuid === guid)
    if (index === -1) return Promise.reject(new Error('Unit Type not found'))
    mockUnitTypes.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/unit-types/${guid}`)
}
