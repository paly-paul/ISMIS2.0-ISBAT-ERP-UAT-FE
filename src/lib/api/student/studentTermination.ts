import { apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// POST /api/v1/students/{studentGuid}/terminate — student-termination/
// post-terminate-student.md. Sets StudActive = 0 and records
// TerminationReasonId + Remarks on the student's active registration
// history row — a terminal state RecalculateRegistrationStatusCommandHandler
// short-circuits around rather than ever overwriting (see that doc's own
// description for why TerminationReasonId is a dedicated field, not folded
// into RegStatus).

export interface TerminateStudentInput {
  terminationReasonGuid: string
  remarks: string | null
}

export function terminateStudent(studentGuid: string, input: TerminateStudentInput): Promise<boolean> {
  if (MOCK_AUTH) return Promise.resolve(true)
  return apiPost<boolean>(`/api/v1/students/${studentGuid}/terminate`, input)
}
