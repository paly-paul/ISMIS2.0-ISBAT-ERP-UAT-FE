import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Represents a weekday record returned by the API.
export interface Weekday {
  weekDayGuid: string
  dayName: string
  dayCode: string
}

// Payload used when creating or updating a weekday.
export type WeekdayInput = Omit<Weekday, 'weekDayGuid'>

// In-memory list used only when mock auth is enabled.
const mockWeekdays: Weekday[] = [
  { weekDayGuid: '116acddc-9b1a-417e-8bf0-72a309b07aad', dayName: 'monday',    dayCode: 'MON' },
  { weekDayGuid: '2', dayName: 'tuesday',   dayCode: 'TUE' },
  { weekDayGuid: '3', dayName: 'wednesday', dayCode: 'WED' },
  { weekDayGuid: '4', dayName: 'thursday',  dayCode: 'THU' },
  { weekDayGuid: '5', dayName: 'friday',    dayCode: 'FRI' },
  { weekDayGuid: '6', dayName: 'saturday',  dayCode: 'SAT' },
  { weekDayGuid: '7', dayName: 'sunday',    dayCode: 'SUN' },
]

// Fetch all weekdays.
export function getWeekdays(): Promise<Weekday[]> {
  if (MOCK_AUTH) return Promise.resolve(mockWeekdays)
  return apiGet<Weekday[] | null>('/api/v1/academic/weekdays').then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// Create a new weekday and return the saved record.
export function createWeekday(input: WeekdayInput): Promise<Weekday> {
  if (MOCK_AUTH) {
    const weekday: Weekday = { weekDayGuid: crypto.randomUUID(), ...input }
    mockWeekdays.push(weekday)
    return Promise.resolve(weekday)
  }
  return apiPost<Weekday>('/api/v1/academic/weekdays', input)
}

// Fetch one weekday by its GUID.
export function getWeekdayById(guid: string): Promise<Weekday> {
  if (MOCK_AUTH) {
    const existing = mockWeekdays.find(w => w.weekDayGuid === guid)
    if (!existing) return Promise.reject(new Error('Weekday not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Weekday>(`/api/v1/academic/weekdays/${guid}`)
}

// Update a weekday by GUID and return the updated record.
export function updateWeekday(guid: string, input: WeekdayInput): Promise<Weekday> {
  if (MOCK_AUTH) {
    const existing = mockWeekdays.find(w => w.weekDayGuid === guid)
    if (!existing) return Promise.reject(new Error('Weekday not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Weekday>(`/api/v1/academic/weekdays/${guid}`, input)
}

// Delete a weekday and return true when the API confirms success.
export function deleteWeekday(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockWeekdays.findIndex(w => w.weekDayGuid === guid)
    if (index === -1) return Promise.reject(new Error('Weekday not found'))
    mockWeekdays.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/weekdays/${guid}`)
}
