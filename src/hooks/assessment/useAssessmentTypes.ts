import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AssessmentTypeDto,
  CreateAssessmentTypeRequest,
  UpdateFeeClearanceRequest,
  createAssessmentType,
  deleteAssessmentType,
  getAssessmentTypeById,
  getAssessmentTypeDropdown,
  getAssessmentTypes,
  updateAssessmentTypeFeeClearance
} from '@/lib/api/assessment/assessmentType'

const ASSESSMENT_TYPES_KEY = ['assessment-types']
const ASSESSMENT_TYPES_DROPDOWN_KEY = ['assessment-types-dropdown']

export function useAssessmentTypes(page: number, pageSize: number) {
  return useQuery({
    queryKey: [...ASSESSMENT_TYPES_KEY, page, pageSize],
    queryFn: () => getAssessmentTypes(page, pageSize),
  })
}

export function useAssessmentTypeDropdown() {
  return useQuery({
    queryKey: ASSESSMENT_TYPES_DROPDOWN_KEY,
    queryFn: () => getAssessmentTypeDropdown(),
  })
}

export function useAssessmentType(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ASSESSMENT_TYPES_KEY, guid],
    queryFn: () => getAssessmentTypeById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateAssessmentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateAssessmentTypeRequest) => createAssessmentType(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_TYPES_KEY })
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_TYPES_DROPDOWN_KEY })
    },
  })
}

export function useUpdateAssessmentTypeFee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: UpdateFeeClearanceRequest }) => updateAssessmentTypeFeeClearance(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_TYPES_KEY })
      queryClient.invalidateQueries({ queryKey: [...ASSESSMENT_TYPES_KEY, guid] })
    },
  })
}

export function useDeleteAssessmentType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteAssessmentType(guid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_TYPES_KEY })
      queryClient.invalidateQueries({ queryKey: ASSESSMENT_TYPES_DROPDOWN_KEY })
    },
  })
}
