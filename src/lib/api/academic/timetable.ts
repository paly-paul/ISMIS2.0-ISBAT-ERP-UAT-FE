import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via timetables/get-timetable-intakes.md. Call this first — every
// other timetable endpoint is keyed by intakeGuid, and editableIntakeGuids
// is what tells the UI which values Add/Edit should actually be offered for
// (current intake + next one, when it exists — past intakes are view-only in
// this UI even though the write endpoints themselves don't enforce that).
export interface TimetableIntakes {
  currentIntakeGuid: string
  nextIntakeGuid: string | null
  editableIntakeGuids: string[]
}

export function getTimetableIntakes(): Promise<TimetableIntakes> {
  if (MOCK_AUTH) return Promise.resolve({ currentIntakeGuid: 'mock-intake-1', nextIntakeGuid: null, editableIntakeGuids: ['mock-intake-1'] })
  return apiGet<TimetableIntakes>('/api/v1/academic/timetables/intakes')
}

// Confirmed via timetables/get-timetable-course-units.md ("same item shape
// as GET /courseunits/dropdown") together with get-courseunit-dropdown.md
// itself (CourseUnitDropdownItemDto) — courseUnitCode/courseUnitName are
// both nullable per that doc's own field table, not the guaranteed strings
// this was assumed to be before either doc was available.
export interface TimetableCourseUnit {
  courseUnitGuid: string
  courseUnitCode: string | null
  courseUnitName: string | null
}

export function getTimetableCourseUnits(intakeGuid: string, term: number): Promise<TimetableCourseUnit[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  const qs = new URLSearchParams({ intakeGuid, term: String(term) })
  return apiGet<TimetableCourseUnit[] | null>(`/api/v1/academic/timetables/course-units?${qs.toString()}`).then(data => data ?? [])
}

// Confirmed via timetables/get-timetable-eligible-batches.md. `term` is
// bound but unused server-side (the doc explicitly says so) — still sent
// since the endpoint requires it in the query string regardless.
export interface EligibleBatch {
  batchGuid: string
  batchCode: string
  semesterGuid: string
  semesterName: string
  studentCount: number
}

export function getTimetableEligibleBatches(intakeGuid: string, term: number, courseUnitGuid: string): Promise<EligibleBatch[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  const qs = new URLSearchParams({ intakeGuid, term: String(term), courseUnitGuid })
  return apiGet<EligibleBatch[] | null>(`/api/v1/academic/timetables/eligible-batches?${qs.toString()}`).then(data => data ?? [])
}

// Confirmed via timetables/get-timetable-lecturers.md — NOT a list of
// lecturers available to assign, only those already timetabled for this
// intake/term (derived from existing timetable rows). Backs the "filter by
// lecturer" picker on the grid; a NEW lecturer assignment in Add/Edit Slot
// sources from the general employee list (useEmployees) instead, same as
// Course Allocation's own Lecturer picker.
export interface TimetableLecturer {
  employeeGuid: string
  empName: string | null
}

export function getTimetableLecturers(intakeGuid: string, term: number): Promise<TimetableLecturer[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  const qs = new URLSearchParams({ intakeGuid, term: String(term) })
  return apiGet<TimetableLecturer[] | null>(`/api/v1/academic/timetables/lecturers?${qs.toString()}`).then(data => data ?? [])
}

// Confirmed via timetables/get-timetable-slots.md — the grid itself, fully
// denormalised (names resolved, no further lookups needed to render it).
// startTime/endTime are real strings per the doc, not parseable times —
// rendered as-is rather than reformatted. Does NOT carry the batches array
// (fetch that via getTimetableByGuid for the edit dialog).
export interface TimetableSlot {
  timetableGuid: string
  batchTimeCode: string
  batchTimeName: string
  timeSlotCode: string
  startTime: string
  endTime: string
  dayCode: string
  dayName: string
  roomCode: string
  roomLocation: string | null
  lecturerGuid: string | null
  lecturerName: string | null
  intakeGuid: string
  term: number | null
  load: number
  url: string | null
}

export function getTimetableSlots(intakeGuid: string, term: number, lecturerGuid?: string | null): Promise<TimetableSlot[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  const qs = new URLSearchParams({ intakeGuid, term: String(term) })
  if (lecturerGuid) qs.set('lecturerGuid', lecturerGuid)
  return apiGet<TimetableSlot[] | null>(`/api/v1/academic/timetables/slots?${qs.toString()}`).then(data => data ?? [])
}

// The unit/batch/semester triple attached to one timetable entry — one
// entry can teach several batches at once. Same shape on the GET (detail),
// POST and PUT bodies (confirmed via all three docs).
export interface TimetableBatchLink {
  courseUnitGuid: string
  batchGuid: string
  semesterGuid: string
}

// Confirmed via timetables/get-timetable-by-guid.md — the edit-form shape,
// all GUIDs (no names resolved) plus the full batches array. Maps
// one-to-one onto the PUT body (minus the path guid), so it can be fed
// straight back after editing.
export interface TimetableDetail {
  timetableGuid: string
  batchTimeGuid: string
  lecturerGuid: string
  timeSlotGuid: string
  weekDayGuid: string
  roomGuid: string
  intakeGuid: string
  term: number | null
  load: number
  url: string | null
  batches: TimetableBatchLink[]
}

export function getTimetableByGuid(guid: string): Promise<TimetableDetail> {
  return apiGet<TimetableDetail>(`/api/v1/academic/timetables/${guid}`)
}

// Confirmed via timetables/post-timetable.md and put-timetable.md — identical
// shape for create and update (PUT is a full replacement, including
// `batches`, which is rewritten wholesale: omitting a batch removes it).
export interface TimetableInput {
  batchTimeGuid: string
  lecturerGuid: string
  timeSlotGuid: string
  weekDayGuid: string
  roomGuid: string
  intakeGuid: string
  term: number
  load: number
  url: string | null
  batches: TimetableBatchLink[]
}

// Returns the bare new timetableGuid per the doc — not the full entry.
// Re-fetch with getTimetableByGuid if the saved state is needed.
export function createTimetable(input: TimetableInput): Promise<string> {
  if (MOCK_AUTH) return Promise.resolve(`mock-timetable-${Date.now()}`)
  return apiPost<string>('/api/v1/academic/timetables', input)
}

// Returns bare `true` per the doc, not the updated entry.
export function updateTimetable(guid: string, input: TimetableInput): Promise<boolean> {
  if (MOCK_AUTH) return Promise.resolve(true)
  return apiPut<boolean>(`/api/v1/academic/timetables/${guid}`, input)
}

// Soft-deletes the entry and its attached batch rows together (cascades
// server-side) — no confirmation step or referential check on the backend,
// so the caller's own UI is what should confirm before calling this.
export function deleteTimetable(guid: string): Promise<boolean> {
  if (MOCK_AUTH) return Promise.resolve(true)
  return apiDelete<boolean>(`/api/v1/academic/timetables/${guid}`)
}
