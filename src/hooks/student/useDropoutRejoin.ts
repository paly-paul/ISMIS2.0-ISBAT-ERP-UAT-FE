import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDropoutStudents,
  getRejoinCandidate,
  getRejoinBatches,
  rejoinStudent,
  RejoinStudentRequest,
} from '@/lib/api/student/dropoutRejoin'

const DROPOUT_LIST_KEY = ['dropout-students']
const REJOIN_CANDIDATE_KEY = ['rejoin-candidate']
const REJOIN_BATCHES_KEY = ['rejoin-batches']

export function useDropoutStudents(enabled: boolean) {
  return useQuery({
    queryKey: DROPOUT_LIST_KEY,
    queryFn: getDropoutStudents,
    enabled,
  })
}

// Only enabled once a dropout student is picked from the list, same
// convention as useResumeCandidate/useIdCard.
export function useRejoinCandidate(studentGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REJOIN_CANDIDATE_KEY, studentGuid],
    queryFn: () => getRejoinCandidate(studentGuid as string),
    enabled: enabled && !!studentGuid,
  })
}

// Only enabled once both the semester and batch time are picked — matches
// the doc's own "call this after the user picks a semester and batch time"
// instruction, same cascading-dropdown convention as
// useSemestersForProgram/useProgramTransferBatches on Programme Transfer.
export function useRejoinBatches(studentGuid: string | null, semesterGuid: string | null, batchTimeGuid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...REJOIN_BATCHES_KEY, studentGuid, semesterGuid, batchTimeGuid],
    queryFn: () => getRejoinBatches(studentGuid as string, semesterGuid as string, batchTimeGuid as string),
    enabled: enabled && !!studentGuid && !!semesterGuid && !!batchTimeGuid,
  })
}

export function useRejoinStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentGuid, payload }: { studentGuid: string; payload: RejoinStudentRequest }) => rejoinStudent(studentGuid, payload),
    // The rejoined student drops off the dropout list (REGSTATUS moves away
    // from 3) — refetch it rather than trying to patch the cached array.
    onSuccess: (_data, { studentGuid }) => {
      queryClient.invalidateQueries({ queryKey: DROPOUT_LIST_KEY })
      queryClient.removeQueries({ queryKey: [...REJOIN_CANDIDATE_KEY, studentGuid] })
    },
  })
}

export type { DropoutStudentDto, RejoinCandidateDto, RejoinSemesterOption, RejoinFeeHeadOption, RejoinBatchOption, RejoinStudentRequest, RejoinResultDto } from '@/lib/api/student/dropoutRejoin'
