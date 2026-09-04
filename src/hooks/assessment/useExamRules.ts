import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  SaveExamRuleRequest,
  createExamRule,
  deleteExamRule,
  getExamRuleById,
  getExamRules,
  updateExamRule
} from '@/lib/api/assessment/examRule'

const EXAM_RULES_KEY = ['exam-rules']

export function useExamRules(page: number, pageSize: number, search: string = '', enabled: boolean = true) {
  return useQuery({
    queryKey: [...EXAM_RULES_KEY, page, pageSize, search],
    queryFn: () => getExamRules(page, pageSize, search),
    enabled,
  })
}

export function useExamRule(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...EXAM_RULES_KEY, guid],
    queryFn: () => getExamRuleById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateExamRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveExamRuleRequest) => createExamRule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAM_RULES_KEY })
    },
  })
}

export function useUpdateExamRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: SaveExamRuleRequest }) => updateExamRule(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: EXAM_RULES_KEY })
      queryClient.invalidateQueries({ queryKey: [...EXAM_RULES_KEY, guid] })
    },
  })
}

export function useDeleteExamRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteExamRule(guid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXAM_RULES_KEY })
    },
  })
}
