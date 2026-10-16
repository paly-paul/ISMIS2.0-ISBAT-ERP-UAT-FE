import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via events/get-events.md, get-event-by-guid.md,
// post-create-event.md, put-update-event.md, delete-event.md — a flat,
// unpaginated list of campus events/announcements (exam dates, term
// milestones, etc.). GET /api/v1/students/events returns every active event
// (soft-deleted rows excluded server-side), newest eventDate first — there is
// no pageNumber/pageSize/search param on this endpoint, unlike most other
// list endpoints in this app.
export interface EventItem {
  eventGuid: string
  subject: string | null
  eventBody: string | null
  eventDate: string | null // UTC datetime, e.g. "2026-09-01T00:00:00Z"
}

// subject/eventBody/eventDate are all required on both create and update —
// the backend does a full replace on PUT, no partial updates.
export interface EventInput {
  subject: string
  eventBody: string
  eventDate: string // UTC datetime
}

// DatePicker works in plain yyyy-mm-dd; the API wants a UTC datetime. Events
// have no time-of-day concept on the legacy screen this was ported from, so
// midnight UTC is used for every save, same as the docs' own examples.
export function eventDateToYmd(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function ymdToEventDate(ymd: string): string {
  return `${ymd}T00:00:00Z`
}

let mockEventSeq = 1

// Seeded from the legacy screen's own sample rows.
const mockEvents: EventItem[] = [
  { eventGuid: 'mock-event-1', subject: 'Commencement of Term II Examinations', eventBody: 'Commencement of Term II Examinations', eventDate: '2026-06-04T00:00:00Z' },
  { eventGuid: 'mock-event-2', subject: 'End of Academic Session Term II', eventBody: 'End of Academic Session Term II', eventDate: '2026-06-02T00:00:00Z' },
  { eventGuid: 'mock-event-3', subject: 'Issue of Hallticket - Term II', eventBody: 'Issue of Hallticket - Term II', eventDate: '2026-05-29T00:00:00Z' },
  { eventGuid: 'mock-event-4', subject: 'Last Date of CBT - Term II', eventBody: 'Last Date of CBT - Term II', eventDate: '2026-05-28T00:00:00Z' },
  { eventGuid: 'mock-event-5', subject: 'Commencement of CBT - Term II', eventBody: 'Commencement of CBT - Term II', eventDate: '2026-05-18T00:00:00Z' },
  { eventGuid: 'mock-event-6', subject: 'Last Date of Course work -Term II', eventBody: 'Last Date of Course work -Term II', eventDate: '2026-05-16T00:00:00Z' },
  { eventGuid: 'mock-event-7', subject: 'Commencement of Course work -Term II', eventBody: 'Commencement of Course work -Term II', eventDate: '2026-05-09T00:00:00Z' },
]

// Lists every active event, newest first — matches the real endpoint's own
// ordering so mock mode and the real backend behave identically.
export function getEvents(): Promise<EventItem[]> {
  if (MOCK_AUTH) {
    const sorted = [...mockEvents].sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''))
    return Promise.resolve(sorted)
  }
  return apiGet<EventItem[] | null>('/api/v1/students/events').then(data => data ?? [])
}

export function getEventById(guid: string): Promise<EventItem> {
  if (MOCK_AUTH) {
    const existing = mockEvents.find(e => e.eventGuid === guid)
    if (!existing) return Promise.reject(new Error('Event not found'))
    return Promise.resolve(existing)
  }
  return apiGet<EventItem>(`/api/v1/students/events/${guid}`)
}

export function createEvent(input: EventInput): Promise<EventItem> {
  if (MOCK_AUTH) {
    const event: EventItem = { eventGuid: `mock-event-new-${mockEventSeq++}`, ...input }
    mockEvents.push(event)
    return Promise.resolve(event)
  }
  return apiPost<EventItem>('/api/v1/students/events', input)
}

export function updateEvent(guid: string, input: EventInput): Promise<EventItem> {
  if (MOCK_AUTH) {
    const existing = mockEvents.find(e => e.eventGuid === guid)
    if (!existing) return Promise.reject(new Error('Event not found'))
    existing.subject = input.subject
    existing.eventBody = input.eventBody
    existing.eventDate = input.eventDate
    return Promise.resolve(existing)
  }
  return apiPut<EventItem>(`/api/v1/students/events/${guid}`, input)
}

// Soft-delete — the response body is just `{}` on success, so there's
// nothing meaningful to return to the caller.
export function deleteEvent(guid: string): Promise<void> {
  if (MOCK_AUTH) {
    const index = mockEvents.findIndex(e => e.eventGuid === guid)
    if (index === -1) return Promise.reject(new Error('Event not found'))
    mockEvents.splice(index, 1)
    return Promise.resolve()
  }
  return apiDelete<Record<string, never>>(`/api/v1/students/events/${guid}`).then(() => undefined)
}
