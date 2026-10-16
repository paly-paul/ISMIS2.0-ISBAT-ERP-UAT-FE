import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionByGuid,
  QuestionDto,
  CreateQuestionRequest,
  UpdateQuestionRequest,
  getSingleQuestionCategories,
  getSingleQuestionCourseUnits,
  uploadQuestionImage,
  deleteQuestionImage
} from '@/lib/api/assessment/questions'

export function useSingleQuestionCategories() {
  return useQuery({
    queryKey: ['single-question-categories'],
    queryFn: getSingleQuestionCategories,
    staleTime: 10 * 60 * 1000,
  })
}

export function useSingleQuestionCourseUnits(intakeGuid: string, lecturerGuid?: string, enabled = true) {
  return useQuery({
    queryKey: ['single-question-course-units', intakeGuid, lecturerGuid],
    queryFn: () => getSingleQuestionCourseUnits(intakeGuid, lecturerGuid),
    enabled: Boolean(intakeGuid) && enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useQuestions(courseUnitGuid: string, category: number, intakeGuid: string, enabled = true) {
  return useQuery({
    queryKey: ['questions', courseUnitGuid, category, intakeGuid],
    queryFn: () => getQuestions(courseUnitGuid, category, intakeGuid),
    enabled: Boolean(courseUnitGuid && category && intakeGuid) && enabled,
  })
}

export function useQuestion(guid: string, enabled = true) {
  return useQuery({
    queryKey: ['question', guid],
    queryFn: () => getQuestionByGuid(guid),
    enabled: Boolean(guid) && enabled,
  })
}

export function useCreateQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateQuestionRequest) => createQuestion(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['questions', variables.courseUnitGuid, variables.category, variables.intakeGuid],
      })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, payload }: { guid: string; payload: UpdateQuestionRequest }) => updateQuestion(guid, payload),
    onSuccess: (data, variables) => {
      // We don't have the full context of unit/category/intake directly in UpdateQuestionRequest,
      // so we invalidate all questions queries just to be safe, or we could rely on caller.
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['question', variables.guid] })
    },
  })
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteQuestion(guid),
    onSuccess: () => {
      // Same as above, invalidate list. 
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })
}

export function useUploadQuestionImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ questionGuid, file }: { questionGuid: string; file: File }) =>
      uploadQuestionImage(questionGuid, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['question', variables.questionGuid] })
    },
  })
}

export function useDeleteQuestionImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (questionGuid: string) => deleteQuestionImage(questionGuid),
    onSuccess: (_, questionGuid) => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['question', questionGuid] })
    },
  })
}
