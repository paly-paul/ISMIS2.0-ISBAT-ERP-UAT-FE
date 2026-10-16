'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCwIntakes,
  getCwCourseUnits,
  getCwCourseworks,
  getCwStudents,
  getCwSubmissionSummary,
  deleteCwSubmission,
  reopenCwSubmission,
  reevaluateCwSubmission,
  getCwRecheck,
  CwIntakeOption,
  CwCourseUnitOption,
  CwCourseworkOption,
  CwStudentOption,
  CwSubmissionSummary,
  CwRecheckDetail,
} from '@/lib/api/assessment/cwRectification'

/**
 * 1. Hook to fetch intakes
 * Spec: get-intakes.md
 */
export function useCwIntakes(enabled = true) {
  return useQuery<CwIntakeOption[]>({
    queryKey: ['cw-rectification', 'intakes'],
    queryFn: () => getCwIntakes(),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 2. Hook to fetch course units for an intake
 * Spec: get-course-units.md
 */
export function useCwCourseUnits(intakeGuid: string | undefined, enabled = true) {
  return useQuery<CwCourseUnitOption[]>({
    queryKey: ['cw-rectification', 'course-units', intakeGuid],
    queryFn: () => getCwCourseUnits(intakeGuid!),
    enabled: Boolean(intakeGuid) && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 3. Hook to fetch courseworks (CW 1 / CW 2) for an intake and course unit
 * Spec: get-courseworks.md
 */
export function useCwCourseworks(
  intakeGuid: string | undefined,
  courseUnitGuid: string | undefined,
  enabled = true
) {
  return useQuery<CwCourseworkOption[]>({
    queryKey: ['cw-rectification', 'courseworks', intakeGuid, courseUnitGuid],
    queryFn: () => getCwCourseworks(intakeGuid!, courseUnitGuid!),
    enabled: Boolean(intakeGuid && courseUnitGuid) && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 4. Hook to fetch students who attempted this coursework
 * Spec: get-students.md
 */
export function useCwStudents(
  intakeGuid: string | undefined,
  courseUnitGuid: string | undefined,
  courseworkNumber: number | undefined,
  enabled = true
) {
  return useQuery<CwStudentOption[]>({
    queryKey: ['cw-rectification', 'students', intakeGuid, courseUnitGuid, courseworkNumber],
    queryFn: () => getCwStudents(intakeGuid!, courseUnitGuid!, courseworkNumber!),
    enabled: Boolean(intakeGuid && courseUnitGuid && courseworkNumber) && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 5. Hook to fetch student submission summary (live status & action legality booleans)
 * Spec: get-submission-summary.md
 */
export function useCwSubmissionSummary(
  courseworkGuid: string | undefined,
  studentGuid: string | undefined,
  enabled = true
) {
  return useQuery<CwSubmissionSummary | null>({
    queryKey: ['cw-rectification', 'summary', courseworkGuid, studentGuid],
    queryFn: () => getCwSubmissionSummary(courseworkGuid!, studentGuid!),
    enabled: Boolean(courseworkGuid && studentGuid) && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 6. Hook to fetch recheck Q&A details (walkthrough of questions, answers, and marks)
 * Spec: get-recheck.md
 */
export function useCwRecheck(
  courseworkGuid: string | undefined,
  studentGuid: string | undefined,
  enabled = true
) {
  return useQuery<CwRecheckDetail | null>({
    queryKey: ['cw-rectification', 'recheck', courseworkGuid, studentGuid],
    queryFn: () => getCwRecheck(courseworkGuid!, studentGuid!),
    enabled: Boolean(courseworkGuid && studentGuid) && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 7. Hook to soft-delete saved coursework answers
 * Spec: delete-submission.md
 */
export function useDeleteCwSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      courseworkGuid,
      studentGuid,
    }: {
      courseworkGuid: string
      studentGuid: string
    }) => deleteCwSubmission(courseworkGuid, studentGuid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cw-rectification', 'summary', variables.courseworkGuid, variables.studentGuid],
      })
      queryClient.invalidateQueries({
        queryKey: ['cw-rectification', 'students'],
      })
    },
  })
}

/**
 * 8. Hook to reopen submitted coursework answers
 * Spec: reopen-submission.md
 */
export function useReopenCwSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      courseworkGuid,
      studentGuid,
    }: {
      courseworkGuid: string
      studentGuid: string
    }) => reopenCwSubmission(courseworkGuid, studentGuid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cw-rectification', 'summary', variables.courseworkGuid, variables.studentGuid],
      })
    },
  })
}

/**
 * 9. Hook to clear evaluation and send script back to lecturer
 * Spec: reevaluate-submission.md
 */
export function useReevaluateCwSubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      courseworkGuid,
      studentGuid,
    }: {
      courseworkGuid: string
      studentGuid: string
    }) => reevaluateCwSubmission(courseworkGuid, studentGuid),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['cw-rectification', 'summary', variables.courseworkGuid, variables.studentGuid],
      })
      queryClient.invalidateQueries({
        queryKey: ['cw-rectification', 'recheck', variables.courseworkGuid, variables.studentGuid],
      })
    },
  })
}
