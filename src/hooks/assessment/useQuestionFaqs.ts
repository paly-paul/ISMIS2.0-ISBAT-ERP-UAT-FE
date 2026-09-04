import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  SaveQuestionFaqRequest,
  UpdateQuestionFaqRequest,
  createQuestionFaq,
  deleteQuestionFaq,
  getQuestionFaqById,
  getQuestionFaqs,
  updateQuestionFaq
} from '@/lib/api/assessment/questionFaq'

const QUESTION_FAQS_KEY = ['question-faqs']

export function useQuestionFaqs(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...QUESTION_FAQS_KEY, page, pageSize],
    queryFn: () => getQuestionFaqs(page, pageSize),
  })
}

export function useQuestionFaq(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...QUESTION_FAQS_KEY, guid],
    queryFn: () => getQuestionFaqById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateQuestionFaq() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveQuestionFaqRequest) => createQuestionFaq(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTION_FAQS_KEY })
    },
  })
}

export function useUpdateQuestionFaq() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: UpdateQuestionFaqRequest }) => updateQuestionFaq(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: QUESTION_FAQS_KEY })
      queryClient.invalidateQueries({ queryKey: [...QUESTION_FAQS_KEY, guid] })
    },
  })
}

export function useDeleteQuestionFaq() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteQuestionFaq(guid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUESTION_FAQS_KEY })
    },
  })
}
