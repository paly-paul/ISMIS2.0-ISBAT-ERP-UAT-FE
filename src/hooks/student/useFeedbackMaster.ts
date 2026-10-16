import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addFeedbackQuestion,
  createFeedback,
  deleteFeedback,
  deleteFeedbackQuestion,
  getFeedback,
  getFeedbackQuestions,
  getFeedbacksByIntake,
  getFeedbackTypes,
  updateFeedback,
  updateFeedbackQuestion,
  AddQuestionInput,
  CreateFeedbackInput,
  UpdateFeedbackInput,
  UpdateQuestionInput,
} from '@/lib/api/student/feedbackMaster'

const FEEDBACK_KEY = ['feedback-master']

// Static master list — cached for the session, same as other dropdowns.
export function useFeedbackTypes() {
  return useQuery({
    queryKey: [...FEEDBACK_KEY, 'types'],
    queryFn: getFeedbackTypes,
    staleTime: Infinity,
  })
}

export function useFeedbacks(intakeGuid: string | null) {
  return useQuery({
    queryKey: [...FEEDBACK_KEY, 'list', intakeGuid],
    queryFn: () => getFeedbacksByIntake(intakeGuid as string),
    enabled: !!intakeGuid,
  })
}

export function useFeedback(feedbackGuid: string | null) {
  return useQuery({
    queryKey: [...FEEDBACK_KEY, 'detail', feedbackGuid],
    queryFn: () => getFeedback(feedbackGuid as string),
    enabled: !!feedbackGuid,
  })
}

// staleTime 0 — hasAnswers changes as students submit from the portal.
export function useFeedbackQuestions(feedbackGuid: string | null) {
  return useQuery({
    queryKey: [...FEEDBACK_KEY, 'questions', feedbackGuid],
    queryFn: () => getFeedbackQuestions(feedbackGuid as string),
    enabled: !!feedbackGuid,
    staleTime: 0,
  })
}

export function useCreateFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFeedbackInput) => createFeedback(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...FEEDBACK_KEY, 'list'] }),
  })
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ feedbackGuid, input }: { feedbackGuid: string; input: UpdateFeedbackInput }) => updateFeedback(feedbackGuid, input),
    onSuccess: (result, { feedbackGuid }) => {
      queryClient.setQueryData([...FEEDBACK_KEY, 'detail', feedbackGuid], result)
      queryClient.invalidateQueries({ queryKey: [...FEEDBACK_KEY, 'list'] })
    },
  })
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (feedbackGuid: string) => deleteFeedback(feedbackGuid),
    onSuccess: (_r, feedbackGuid) => {
      queryClient.removeQueries({ queryKey: [...FEEDBACK_KEY, 'detail', feedbackGuid] })
      queryClient.invalidateQueries({ queryKey: [...FEEDBACK_KEY, 'list'] })
    },
  })
}

function invalidateQuestions(queryClient: ReturnType<typeof useQueryClient>, feedbackGuid: string) {
  queryClient.invalidateQueries({ queryKey: [...FEEDBACK_KEY, 'questions', feedbackGuid] })
}

export function useAddFeedbackQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ feedbackGuid, input }: { feedbackGuid: string; input: AddQuestionInput }) => addFeedbackQuestion(feedbackGuid, input),
    onSuccess: (_r, { feedbackGuid }) => invalidateQuestions(queryClient, feedbackGuid),
  })
}

export function useUpdateFeedbackQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ questionGuid, input }: { feedbackGuid: string; questionGuid: string; input: UpdateQuestionInput }) => updateFeedbackQuestion(questionGuid, input),
    onSuccess: (_r, { feedbackGuid }) => invalidateQuestions(queryClient, feedbackGuid),
  })
}

export function useDeleteFeedbackQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ questionGuid }: { feedbackGuid: string; questionGuid: string }) => deleteFeedbackQuestion(questionGuid),
    onSuccess: (_r, { feedbackGuid }) => invalidateQuestions(queryClient, feedbackGuid),
  })
}

export { FEEDBACK_QUESTION_TYPES } from '@/lib/api/student/feedbackMaster'
export type { FeedbackListItem, FeedbackDetail, FeedbackQuestion, FeedbackQuestionType, FeedbackTypeOption } from '@/lib/api/student/feedbackMaster'
