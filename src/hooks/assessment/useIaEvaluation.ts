'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPendingEvaluations,
  getStudentsForEvaluation,
  getStudentQuestions,
  saveQuestionMark,
  finalizeStudent,
  getEvaluatedList,
} from '@/lib/api/assessment/iaEvaluation'

/**
 * 1. Hook to fetch pending units/coursework that still have students to mark
 * Spec: get-pending.md
 */
export function usePendingEvaluations(intakeGuid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['iaEvaluations', 'pending', intakeGuid],
    queryFn: () => getPendingEvaluations(intakeGuid!),
    enabled: Boolean(intakeGuid) && enabled,
    staleTime: 30 * 1000,
  })
}

/**
 * 2. Hook to fetch students for a selected coursework (with optional status filter)
 * Spec: GET .../students?status={Pending|Evaluated}
 */
export function useStudentsForEvaluation(
  category: number | undefined,
  courseworkOrTestGuid: string | undefined,
  status?: 'Pending' | 'Evaluated' | '',
  enabled = true
) {
  return useQuery({
    queryKey: ['iaEvaluations', 'students', category, courseworkOrTestGuid, status || 'all'],
    queryFn: () => getStudentsForEvaluation(category!, courseworkOrTestGuid!, status),
    enabled: Boolean(category && courseworkOrTestGuid) && enabled,
    staleTime: 20 * 1000,
  })
}

/**
 * 3. Hook to fetch all questions & submitted answers for one student
 * Spec: get-questions.md
 */
export function useStudentQuestions(
  category: number | undefined,
  courseworkOrTestGuid: string | undefined,
  studentGuid: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ['iaEvaluations', 'questions', category, courseworkOrTestGuid, studentGuid],
    queryFn: () => getStudentQuestions(category!, courseworkOrTestGuid!, studentGuid!),
    enabled: Boolean(category && courseworkOrTestGuid && studentGuid) && enabled,
    staleTime: 20 * 1000,
  })
}

/**
 * 4. Mutation to save a question mark ("Save & Next")
 * Spec: put-mark.md
 */
export function useSaveQuestionMark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      category,
      courseworkOrTestGuid,
      studentGuid,
      questionGuid,
      mark,
    }: {
      category: number
      courseworkOrTestGuid: string
      studentGuid: string
      questionGuid: string
      mark: number | null
    }) => saveQuestionMark(category, courseworkOrTestGuid, studentGuid, questionGuid, mark),
    onSuccess: (_, variables) => {
      // Refresh questions for this student so UI is kept strictly in sync
      queryClient.invalidateQueries({
        queryKey: [
          'iaEvaluations',
          'questions',
          variables.category,
          variables.courseworkOrTestGuid,
          variables.studentGuid,
        ],
      })
    },
  })
}

/**
 * 5. Mutation to finalize a student
 * Spec: post-finalize.md
 */
export function useFinalizeStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      category,
      courseworkOrTestGuid,
      studentGuid,
      comment,
    }: {
      category: number
      courseworkOrTestGuid: string
      studentGuid: string
      comment?: string
    }) => finalizeStudent(category, courseworkOrTestGuid, studentGuid, comment),
    onSuccess: (_, variables) => {
      // Invalidate students list for this coursework so finalized student drops off
      queryClient.invalidateQueries({
        queryKey: ['iaEvaluations', 'students', variables.category, variables.courseworkOrTestGuid],
      })
      // Invalidate pending & evaluated dashboards so counts update
      queryClient.invalidateQueries({
        queryKey: ['iaEvaluations', 'pending'],
      })
      queryClient.invalidateQueries({
        queryKey: ['iaEvaluations', 'evaluated'],
      })
    },
  })
}

/**
 * 6. Hook to fetch evaluated coursework history (read-only)
 * Spec: get-evaluated.md
 */
export function useEvaluatedList(intakeGuid: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['iaEvaluations', 'evaluated', intakeGuid],
    queryFn: () => getEvaluatedList(intakeGuid!),
    enabled: Boolean(intakeGuid) && enabled,
    staleTime: 60 * 1000,
  })
}
