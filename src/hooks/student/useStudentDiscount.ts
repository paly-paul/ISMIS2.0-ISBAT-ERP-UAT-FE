import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AssignStudentDiscountRequest,
  UpdateStudentDiscountRequest,
  assignStudentDiscount,
  cancelStudentDiscount,
  getActiveAssignmentCount,
  getStudentDiscount,
  updateStudentDiscount,
} from '@/lib/api/student/studentDiscount'

const STUDENT_DISCOUNT_KEY = ['student-discount']
const ACTIVE_ASSIGNMENT_COUNT_KEY = ['discount-active-assignment-count']

// Only enabled once a student is loaded, same convention as
// useSponsorDetails/useIdCard. Resolves to null for "no assignment" — not an
// error (see getStudentDiscount).
export function useStudentDiscount(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...STUDENT_DISCOUNT_KEY, studentGuid],
    queryFn: () => getStudentDiscount(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

export function useAssignStudentDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, payload }: { studentGuid: string; payload: AssignStudentDiscountRequest }) =>
      assignStudentDiscount(studentGuid, payload),
    onSuccess: (_data, { studentGuid }) => queryClient.invalidateQueries({ queryKey: [...STUDENT_DISCOUNT_KEY, studentGuid] }),
  })
}

export function useUpdateStudentDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, payload }: { studentGuid: string; payload: UpdateStudentDiscountRequest }) =>
      updateStudentDiscount(studentGuid, payload),
    onSuccess: (_data, { studentGuid }) => queryClient.invalidateQueries({ queryKey: [...STUDENT_DISCOUNT_KEY, studentGuid] }),
  })
}

export function useCancelStudentDiscount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, includeCurrentSemester }: { studentGuid: string; includeCurrentSemester: boolean }) =>
      cancelStudentDiscount(studentGuid, includeCurrentSemester),
    onSuccess: (_data, { studentGuid }) => queryClient.invalidateQueries({ queryKey: [...STUDENT_DISCOUNT_KEY, studentGuid] }),
  })
}

// Backs Finance's discount-delete confirmation — keyed by discountGuid, not
// a loaded student, so it's only enabled while that specific check is
// needed (e.g. a delete confirmation modal open on a given discount).
export function useActiveAssignmentCount(discountGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ACTIVE_ASSIGNMENT_COUNT_KEY, discountGuid],
    queryFn: () => getActiveAssignmentCount(discountGuid as string),
    enabled: enabled && !!discountGuid,
  })
}

export type { StudentDiscountDto, AssignStudentDiscountRequest, UpdateStudentDiscountRequest } from '@/lib/api/student/studentDiscount'
export { DISCOUNT_STATUS_VALUES, DISCOUNT_STATUS_LABELS } from '@/lib/api/student/studentDiscount'
