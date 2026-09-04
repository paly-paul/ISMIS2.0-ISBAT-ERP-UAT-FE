import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignSpecialization,
  AssignSpecializationInput,
  getSpecializationBatchContext,
  getSpecializationBatchesByIntake,
  getSpecializationStudentsInBatch,
} from '@/lib/api/student/specialization'

export function useSpecializationBatchesByIntake(intakeGuid: string | null, search?: string) {
  return useQuery({
    queryKey: ['specialization-batches', intakeGuid, search ?? ''],
    queryFn: () => getSpecializationBatchesByIntake(intakeGuid as string, search),
    enabled: !!intakeGuid,
  })
}

export function useSpecializationBatchContext(batchGuid: string | null) {
  return useQuery({
    queryKey: ['specialization-batch-context', batchGuid],
    queryFn: () => getSpecializationBatchContext(batchGuid as string),
    enabled: !!batchGuid,
  })
}

export function useSpecializationStudentsInBatch(batchGuid: string | null) {
  return useQuery({
    queryKey: ['specialization-students', batchGuid],
    queryFn: () => getSpecializationStudentsInBatch(batchGuid as string),
    enabled: !!batchGuid,
  })
}

export function useAssignSpecialization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AssignSpecializationInput) => assignSpecialization(input),
    onSuccess: (_data, { batchGuid }) => queryClient.invalidateQueries({ queryKey: ['specialization-students', batchGuid] }),
  })
}

export type {
  SpecializationBatchOption,
  SpecializationStream,
  SpecializationBatchContext,
  SpecializationStudent,
  AssignSpecializationInput,
} from '@/lib/api/student/specialization'
