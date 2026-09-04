import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AssignRefugeeStatusRequest,
  assignRefugeeStatus,
  getEligibleStudents,
  getRefugeeStudents,
  getStudentRefugeeDetails,
  removeRefugeeStatus,
} from '@/lib/api/student/refugee'

const REFUGEE_DETAILS_KEY = ['refugee-details']
const ELIGIBLE_STUDENTS_KEY = ['refugee-eligible-students']
const REFUGEE_STUDENTS_KEY = ['refugee-students']

// Only enabled once a student is loaded, same convention as
// useSponsorDetails/useIdCard. Resolves to null for "no record" — not an
// error (see getStudentRefugeeDetails).
export function useStudentRefugeeDetails(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REFUGEE_DETAILS_KEY, studentGuid],
    queryFn: () => getStudentRefugeeDetails(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useEligibleRefugeeStudents(enabled: boolean) {
  return useQuery({
    queryKey: ELIGIBLE_STUDENTS_KEY,
    queryFn: getEligibleStudents,
    enabled,
  })
}

export function useRefugeeStudents(enabled: boolean) {
  return useQuery({
    queryKey: REFUGEE_STUDENTS_KEY,
    queryFn: getRefugeeStudents,
    enabled,
  })
}

export function useAssignRefugeeStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AssignRefugeeStatusRequest) => assignRefugeeStatus(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: [...REFUGEE_DETAILS_KEY, payload.studentGuid] })
      queryClient.invalidateQueries({ queryKey: ELIGIBLE_STUDENTS_KEY })
      queryClient.invalidateQueries({ queryKey: REFUGEE_STUDENTS_KEY })
    },
  })
}

export function useRemoveRefugeeStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (studentGuid: string) => removeRefugeeStatus(studentGuid),
    onSuccess: (_data, studentGuid) => {
      queryClient.invalidateQueries({ queryKey: [...REFUGEE_DETAILS_KEY, studentGuid] })
      queryClient.invalidateQueries({ queryKey: ELIGIBLE_STUDENTS_KEY })
      queryClient.invalidateQueries({ queryKey: REFUGEE_STUDENTS_KEY })
    },
  })
}

export type { EligibleRefugeeStudentDto, RefugeeStudentDto, RefugeeStudentDetailsDto, AssignRefugeeStatusRequest } from '@/lib/api/student/refugee'
