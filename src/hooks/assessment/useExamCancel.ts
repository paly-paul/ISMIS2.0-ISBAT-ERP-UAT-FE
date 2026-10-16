import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelAttempt,
  getExamCancelCourseUnits,
  getExamCancelStudent,
  getExamStatus,
  grantExtraTime,
  searchExamCancelStudents,
  AttemptCategory,
  SEARCH_MIN_CHARS,
} from '@/lib/api/assessment/examCancel'

export const EXAM_CANCEL_KEYS = {
  all: ['assessment-attendance-service', 'assessment', 'exam-cancel'] as const,
  search: (term: string) => [...EXAM_CANCEL_KEYS.all, 'search', term] as const,
  student: (studentGuid: string) => [...EXAM_CANCEL_KEYS.all, 'student', studentGuid] as const,
  units: (studentGuid: string) => [...EXAM_CANCEL_KEYS.all, 'units', studentGuid] as const,
  status: (studentGuid: string, courseUnitGuid: string) => [...EXAM_CANCEL_KEYS.all, 'status', studentGuid, courseUnitGuid] as const,
}

// Fewer than 3 characters returns nothing server-side, so don't call.
export function useExamCancelStudentSearch(term: string) {
  const t = term.trim()
  return useQuery({
    queryKey: EXAM_CANCEL_KEYS.search(t),
    queryFn: () => searchExamCancelStudents(t),
    enabled: t.length >= SEARCH_MIN_CHARS,
    placeholderData: keepPreviousData,
  })
}

export function useExamCancelStudent(studentGuid: string | null) {
  return useQuery({
    queryKey: EXAM_CANCEL_KEYS.student(studentGuid ?? ''),
    queryFn: () => getExamCancelStudent(studentGuid as string),
    enabled: !!studentGuid,
  })
}

export function useExamCancelCourseUnits(studentGuid: string | null) {
  return useQuery({
    queryKey: EXAM_CANCEL_KEYS.units(studentGuid ?? ''),
    queryFn: () => getExamCancelCourseUnits(studentGuid as string),
    enabled: !!studentGuid,
  })
}

// staleTime 0 — the student may be sitting the test right now.
export function useExamStatus(studentGuid: string | null, courseUnitGuid: string | null) {
  return useQuery({
    queryKey: EXAM_CANCEL_KEYS.status(studentGuid ?? '', courseUnitGuid ?? ''),
    queryFn: () => getExamStatus(studentGuid as string, courseUnitGuid as string),
    enabled: !!studentGuid && !!courseUnitGuid,
    staleTime: 0,
  })
}

// Both writes change the Class Test status — reload it afterwards.
export function useCancelAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, courseUnitGuid, category }: { studentGuid: string; courseUnitGuid: string; category: AttemptCategory }) =>
      cancelAttempt(studentGuid, courseUnitGuid, category),
    onSettled: (_d, _e, v) => queryClient.invalidateQueries({ queryKey: EXAM_CANCEL_KEYS.status(v.studentGuid, v.courseUnitGuid) }),
  })
}

export function useGrantExtraTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, courseUnitGuid, extraMinutes }: { studentGuid: string; courseUnitGuid: string; extraMinutes: number }) =>
      grantExtraTime(studentGuid, courseUnitGuid, extraMinutes),
    onSettled: (_d, _e, v) => queryClient.invalidateQueries({ queryKey: EXAM_CANCEL_KEYS.status(v.studentGuid, v.courseUnitGuid) }),
  })
}

export { SEARCH_MIN_CHARS, SEARCH_MAX_RESULTS } from '@/lib/api/assessment/examCancel'
export type { AttemptCategory, ExamStatus, ExamCancelStudentHit } from '@/lib/api/assessment/examCancel'
