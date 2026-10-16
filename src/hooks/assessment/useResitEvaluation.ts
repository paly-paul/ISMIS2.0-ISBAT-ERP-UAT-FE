import { useMutation, useQuery } from '@tanstack/react-query'
import {
  getResitEvaluationQuestions,
  getResitEvaluationStudents,
  getResitEvaluationUnits,
  saveResitEvaluationMark,
  submitResitEvaluation,
} from '@/lib/api/assessment/resitEvaluation'

export const RESIT_EVALUATION_KEYS = {
  all: ['assessment-attendance-service', 'assessment', 'resit-evaluations'] as const,
  units: (intakeGuid: string, resitConfigGuid: string) => [...RESIT_EVALUATION_KEYS.all, 'units', intakeGuid, resitConfigGuid] as const,
  students: (courseUnitGuid: string, intakeGuid: string, resitConfigGuid: string) => [...RESIT_EVALUATION_KEYS.all, 'students', courseUnitGuid, intakeGuid, resitConfigGuid] as const,
  questions: (resitApplicationGuid: string) => [...RESIT_EVALUATION_KEYS.all, 'questions', resitApplicationGuid] as const,
}

export function useResitEvaluationUnits(intakeGuid: string, resitConfigGuid: string) {
  return useQuery({
    queryKey: RESIT_EVALUATION_KEYS.units(intakeGuid, resitConfigGuid),
    queryFn: () => getResitEvaluationUnits(intakeGuid, resitConfigGuid),
    enabled: !!intakeGuid && !!resitConfigGuid,
  })
}

export function useResitEvaluationStudents(courseUnitGuid: string | null, intakeGuid: string, resitConfigGuid: string) {
  return useQuery({
    queryKey: RESIT_EVALUATION_KEYS.students(courseUnitGuid ?? '', intakeGuid, resitConfigGuid),
    queryFn: () => getResitEvaluationStudents(courseUnitGuid as string, intakeGuid, resitConfigGuid),
    enabled: !!courseUnitGuid && !!intakeGuid && !!resitConfigGuid,
  })
}

// answerFileUrl expires after a short time (get-resit-evaluation-questions.md),
// so this is refetched whenever a student is reopened rather than cached
// indefinitely.
export function useResitEvaluationQuestions(resitApplicationGuid: string | null) {
  return useQuery({
    queryKey: RESIT_EVALUATION_KEYS.questions(resitApplicationGuid ?? ''),
    queryFn: () => getResitEvaluationQuestions(resitApplicationGuid as string),
    enabled: !!resitApplicationGuid,
    staleTime: 0,
  })
}

// Cache updates after save/submit are done by the page itself (it patches
// the questions and students caches in place — the spec asks for no reload).
export function useSaveResitEvaluationMark() {
  return useMutation({
    mutationFn: ({ resitApplicationGuid, answerGuid, mark }: { resitApplicationGuid: string; answerGuid: string; mark: number | null }) =>
      saveResitEvaluationMark(resitApplicationGuid, answerGuid, mark),
  })
}

export function useSubmitResitEvaluation() {
  return useMutation({
    mutationFn: (resitApplicationGuid: string) => submitResitEvaluation(resitApplicationGuid),
  })
}
