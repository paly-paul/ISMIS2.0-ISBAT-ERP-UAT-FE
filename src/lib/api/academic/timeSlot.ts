import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via time-slots/get-time-slot-dropdown.md — GET
// /api/v1/academic/timeslots/dropdown. No page in this app has ever
// integrated the Time Slot master before (no CRUD, only this one dropdown
// endpoint, wired specifically for the Timetable module's Add/Edit Slot
// form — Time Slot Master itself, if it ever gets its own page, would need
// the rest of that doc set (post/put/delete/get-by-guid) separately).
export interface TimeSlotDropdownItem {
  timeSlotGuid: string
  timeSlotCode: string
  timeSlot: string
  batchTimeGuid: string
  batchTimeName: string
  batchTimeCode: string
  startTime: string
  endTime: string
}

const mockTimeSlots: TimeSlotDropdownItem[] = [
  { timeSlotGuid: 'ts-1', timeSlotCode: 'DI', timeSlot: 'I', batchTimeGuid: 'bt-day', batchTimeName: 'Day', batchTimeCode: 'D', startTime: '08:00:00', endTime: '10:00:00' },
  { timeSlotGuid: 'ts-2', timeSlotCode: 'DII', timeSlot: 'II', batchTimeGuid: 'bt-day', batchTimeName: 'Day', batchTimeCode: 'D', startTime: '10:00:00', endTime: '12:00:00' },
  { timeSlotGuid: 'ts-3', timeSlotCode: 'EI', timeSlot: 'I', batchTimeGuid: 'bt-eve', batchTimeName: 'Evening', batchTimeCode: 'E', startTime: '17:00:00', endTime: '19:00:00' },
]

// batchTimeGuid narrows to that Batch Time's own slots (omit for every time
// slot across all batch times) — an unresolved guid matches nothing rather
// than 404ing, per the doc.
export function getTimeSlotDropdown(batchTimeGuid?: string | null, search?: string): Promise<TimeSlotDropdownItem[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(mockTimeSlots.filter(t => !batchTimeGuid || t.batchTimeGuid === batchTimeGuid))
  }
  const qs = new URLSearchParams()
  if (batchTimeGuid) qs.set('batchTimeGuid', batchTimeGuid)
  if (search) qs.set('search', search)
  const query = qs.toString()
  return apiGet<TimeSlotDropdownItem[] | null>(`/api/v1/academic/timeslots/dropdown${query ? `?${query}` : ''}`)
    .then(data => data ?? [])
}
