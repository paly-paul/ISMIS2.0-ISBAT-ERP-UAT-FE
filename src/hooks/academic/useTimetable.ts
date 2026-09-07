import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTimetable,
  deleteTimetable,
  getTimetableByGuid,
  getTimetableCourseUnits,
  getTimetableEligibleBatches,
  getTimetableIntakes,
  getTimetableLecturers,
  getTimetableSlots,
  updateTimetable,
  EligibleBatch,
  TimetableBatchLink,
  TimetableCourseUnit,
  TimetableDetail,
  TimetableInput,
  TimetableIntakes,
  TimetableLecturer,
  TimetableSlot,
} from '@/lib/api/academic/timetable'

const TIMETABLE_KEY = ['timetable']

// Call first — every other timetable query below is keyed by intakeGuid,
// and editableIntakeGuids is what the page uses to gate Add/Edit (past
// intakes are view-only in this UI; see the note on getTimetableIntakes).
export function useTimetableIntakes() {
  return useQuery({
    queryKey: [...TIMETABLE_KEY, 'intakes'],
    queryFn: () => getTimetableIntakes(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useTimetableCourseUnits(intakeGuid: string | null, term: number, enabled: boolean) {
  return useQuery({
    queryKey: [...TIMETABLE_KEY, 'course-units', intakeGuid, term],
    queryFn: () => getTimetableCourseUnits(intakeGuid as string, term),
    enabled: enabled && !!intakeGuid,
  })
}

export function useTimetableEligibleBatches(intakeGuid: string | null, term: number, courseUnitGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...TIMETABLE_KEY, 'eligible-batches', intakeGuid, term, courseUnitGuid],
    queryFn: () => getTimetableEligibleBatches(intakeGuid as string, term, courseUnitGuid as string),
    enabled: enabled && !!intakeGuid && !!courseUnitGuid,
  })
}

// Only lecturers already timetabled for this intake/term (see the note on
// TimetableLecturer) — backs the grid's "filter by lecturer" picker, not a
// general lecturer/employee list.
export function useTimetableLecturers(intakeGuid: string | null, term: number, enabled: boolean) {
  return useQuery({
    queryKey: [...TIMETABLE_KEY, 'lecturers', intakeGuid, term],
    queryFn: () => getTimetableLecturers(intakeGuid as string, term),
    enabled: enabled && !!intakeGuid,
  })
}

export function useTimetableSlots(intakeGuid: string | null, term: number, lecturerGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...TIMETABLE_KEY, 'slots', intakeGuid, term, lecturerGuid ?? null],
    queryFn: () => getTimetableSlots(intakeGuid as string, term, lecturerGuid),
    enabled: enabled && !!intakeGuid,
  })
}

// Fetch-by-guid convention, same as the rest of this app's real Edit
// modals — backs Add/Edit Slot's Edit-mode prefill.
export function useTimetableDetail(timetableGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...TIMETABLE_KEY, 'detail', timetableGuid],
    queryFn: () => getTimetableByGuid(timetableGuid as string),
    enabled: enabled && !!timetableGuid,
  })
}

export function useCreateTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TimetableInput) => createTimetable(input),
    // Also invalidates 'lecturers' — a newly-created slot can introduce a
    // lecturer not previously timetabled for this intake/term, and that
    // list is derived purely from existing timetable rows (see the note on
    // getTimetableLecturers), so it needs to catch up too.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY }),
  })
}

export function useUpdateTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: TimetableInput }) => updateTimetable(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY })
      queryClient.invalidateQueries({ queryKey: [...TIMETABLE_KEY, 'detail', guid] })
    },
  })
}

export function useDeleteTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteTimetable(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY }),
  })
}

export type {
  EligibleBatch,
  TimetableBatchLink,
  TimetableCourseUnit,
  TimetableDetail,
  TimetableInput,
  TimetableIntakes,
  TimetableLecturer,
  TimetableSlot,
}
