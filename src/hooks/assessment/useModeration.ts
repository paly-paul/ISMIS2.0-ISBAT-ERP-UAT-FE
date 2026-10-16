import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  searchModerationStudents,
  getModerationStudentDetail,
  getStudentModerationRows,
  updateModeration,
  UpdateModerationPayload
} from '@/lib/api/assessment/moderation'

export function useSearchModerationStudents(q: string) {
  return useQuery({
    queryKey: ['moderation-students-search', q],
    queryFn: () => searchModerationStudents(q),
    enabled: q.length > 2,
    staleTime: 60000,
  })
}

export function useModerationStudentDetail(studentGuid: string | null) {
  return useQuery({
    queryKey: ['moderation-student-detail', studentGuid],
    queryFn: () => getModerationStudentDetail(studentGuid!),
    enabled: !!studentGuid
  })
}

export function useStudentModerationRows(studentGuid: string | null) {
  return useQuery({
    queryKey: ['moderation-student-rows', studentGuid],
    queryFn: () => getStudentModerationRows(studentGuid!),
    enabled: !!studentGuid
  })
}

export function useUpdateModeration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, examResultGuid, data }: { studentGuid: string, examResultGuid: string, data: UpdateModerationPayload }) => 
      updateModeration(studentGuid, examResultGuid, data),
    onSuccess: (_, { studentGuid }) => {
      // Invalidate the rows query so it refetches immediately
      queryClient.invalidateQueries({ queryKey: ['moderation-student-rows', studentGuid] })
    }
  })
}
