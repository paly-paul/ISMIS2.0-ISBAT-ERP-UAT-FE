import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the "Dropout Rejoin" mode of the Intake Transfer page (see
// student/intake-transfer/page.tsx). This is the dedicated endpoint family
// for REGSTATUS = 3 (DropOut) students only — students/dropout-rejoin/*.md —
// distinct from the generic students/resume/* pair that student-resuming.ts
// wraps for every other transfer reason on that page.
export interface DropoutStudentDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
  programGuid: string
  programName: string
  semesterGuid: string
  semesterName: string
  batchGuid: string
  batchCode: string
  applicationGuid: string
  // true when the student's current semester fees are fully paid
  // (get-dropout-students.md). Informational only — neither the candidate
  // nor the rejoin endpoint enforces it server-side, so it's shown as a
  // badge rather than used to gate the Rejoin action.
  canRejoin: boolean
}

// Same shape as ResumeCandidateDto/ResumeStudentRequest/ResumeResultDto in
// student/studentResuming.ts — the two workflows share a request/response
// contract even though they're separate endpoints.
export interface RejoinSemesterOption { semesterGuid: string; semName: string }
export interface RejoinFeeHeadOption { feeHdGuid: string; feeCode: string; feeDesc: string }
export interface RejoinBatchOption { batchGuid: string; batchCode: string }

export interface RejoinCandidateDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
  currentProgramGuid: string
  currentProgramName: string
  currentSemesterGuid: string
  currentSemesterName: string
  // Restricted to the student's current SemCode and current SemCode + 1
  // (get-rejoin-candidate.md) — unlike student-resuming's full semester list.
  // Confirmed live (2026-09-04): a real candidate response can omit any of
  // these three entirely rather than sending an empty array — crashed the
  // page's own .find()/.map() calls, which assumed the docs' required-array
  // shape held. Treat a missing one the same as "no options" everywhere it's
  // read.
  availableSemesters?: RejoinSemesterOption[] | null
  availableFeeHeads?: RejoinFeeHeadOption[] | null
  availableBatches?: RejoinBatchOption[] | null
}

export interface RejoinStudentRequest {
  newSemesterGuid: string
  newBatchGuid: string
  newFeeGuid: string
}

export interface RejoinResultDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
}

const mockDropouts: DropoutStudentDto[] = [
  { studentGuid: 'stu-mock-3', studentRegNo: '011250093', studentName: 'Grace Nampijja', programGuid: 'mock-prog-1', programName: 'BSc. Information Technology', semesterGuid: 'mock-sem-3', semesterName: 'Semester 3', batchGuid: 'mock-batch-1', batchCode: 'BSIT-2023-SEP-B', applicationGuid: 'mock-app-3', canRejoin: true },
  { studentGuid: 'stu-mock-4', studentRegNo: '012240747', studentName: 'Brian Ssemanda', programGuid: 'mock-prog-2', programName: 'Diploma in Nursing', semesterGuid: 'mock-sem-4', semesterName: 'Semester 4', batchGuid: 'mock-batch-2', batchCode: 'NUR-2025-MAY-A', applicationGuid: 'mock-app-4', canRejoin: false },
]

export function getDropoutStudents(): Promise<DropoutStudentDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockDropouts)
  return apiGet<DropoutStudentDto[] | null>('/api/v1/students/dropout-rejoin').then(data => data ?? [])
}

export function getRejoinCandidate(studentGuid: string): Promise<RejoinCandidateDto> {
  if (MOCK_AUTH) {
    const found = mockDropouts.find(d => d.studentGuid === studentGuid)
    if (!found) throw new Error('bad_request')
    return Promise.resolve({
      studentGuid: found.studentGuid,
      studentRegNo: found.studentRegNo,
      studentName: found.studentName,
      currentProgramGuid: found.programGuid,
      currentProgramName: found.programName,
      currentSemesterGuid: found.semesterGuid,
      currentSemesterName: found.semesterName,
      availableSemesters: [
        { semesterGuid: found.semesterGuid, semName: found.semesterName },
        { semesterGuid: 'mock-sem-next', semName: 'Next Semester' },
      ],
      availableFeeHeads: [
        { feeHdGuid: 'mock-fee-1', feeCode: 'BSC.IT.DA.LCL', feeDesc: 'BSc. IT — Day · Local' },
      ],
      availableBatches: [
        { batchGuid: found.batchGuid, batchCode: found.batchCode },
      ],
    })
  }
  return apiGet<RejoinCandidateDto>(`/api/v1/students/dropout-rejoin/${studentGuid}/candidate`)
}

// Confirmed via get-rejoin-batches.md (2026-09-03) — a separate, narrower
// batch dropdown than candidate.availableBatches above: filtered by the
// student's program, the chosen semester, AND the chosen batch time (Day/
// Evening/etc., picked via a batch-time dropdown the form gains alongside
// this). Called only once both are selected — same "cascading, not
// preloaded" convention as e.g. Programme Transfer's own semester→batch
// chain. Response shape (batchGuid/batchCode) matches RejoinBatchOption
// exactly, so no new type is needed for it.
export function getRejoinBatches(studentGuid: string, semesterGuid: string, batchTimeGuid: string): Promise<RejoinBatchOption[]> {
  if (MOCK_AUTH) {
    const found = mockDropouts.find(d => d.studentGuid === studentGuid)
    return Promise.resolve(found ? [{ batchGuid: found.batchGuid, batchCode: found.batchCode }] : [])
  }
  const params = new URLSearchParams({ semesterGuid, batchTimeGuid })
  return apiGet<RejoinBatchOption[] | null>(`/api/v1/students/dropout-rejoin/${studentGuid}/batches?${params.toString()}`)
    .then(data => data ?? [])
}

export function rejoinStudent(studentGuid: string, payload: RejoinStudentRequest): Promise<RejoinResultDto> {
  if (MOCK_AUTH) {
    const found = mockDropouts.find(d => d.studentGuid === studentGuid)
    return Promise.resolve({ studentGuid, studentRegNo: found?.studentRegNo ?? 'MOCK', studentName: found?.studentName ?? 'Mock Student' })
  }
  return apiPost<RejoinResultDto>(`/api/v1/students/dropout-rejoin/${studentGuid}/rejoin`, payload)
}
