import { useMutation, useQueryClient } from '@tanstack/react-query'
import { terminateStudent, TerminateStudentInput } from '@/lib/api/student/studentTermination'

// Invalidates the terminated student's own detail cache (studActive/
// regStatusName just changed) and every refund-search query — Category 3
// (Fake-Certificate Termination) surfaces newly-terminated students, and a
// live search there should pick this up rather than showing stale results
// until an unrelated refetch happens to occur.
export function useTerminateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, input }: { studentGuid: string; input: TerminateStudentInput }) => terminateStudent(studentGuid, input),
    onSuccess: (_data, { studentGuid }) => {
      queryClient.invalidateQueries({ queryKey: ['student-detail', studentGuid] })
      queryClient.invalidateQueries({ queryKey: ['refund-search'] })
      // Terminate Student searches and loads profiles through the Payment
      // Console queries, which are otherwise cached forever — refresh them so
      // the next search reflects the termination.
      queryClient.invalidateQueries({ queryKey: ['payment-console'] })
    },
  })
}

export type { TerminateStudentInput } from '@/lib/api/student/studentTermination'
