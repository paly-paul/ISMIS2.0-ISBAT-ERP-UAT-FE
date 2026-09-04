import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Student module's Specialization page (see
// student/specialization/page.tsx). Confirmed against
// students/student-specialization/*.md (2026-08-20). The real workflow is
// intake -> batch -> stream + a checklist of that batch's students, not a
// standalone "Specializations" master list with a student headcount — there
// is no endpoint anywhere that lists specializations independent of a batch,
// so the old mock table shape doesn't map onto this API at all.

export interface SpecializationBatchOption {
  batchGuid: string
  batchCode: string
}

export interface SpecializationStream {
  streamGuid: string
  streamCode: string
  streamName: string
}

export interface SpecializationBatchContext {
  batchGuid: string
  batchCode: string
  programGuid: string
  programName: string
  semesterGuid: string
  semesterName: string
  streams: SpecializationStream[]
}

export interface SpecializationStudent {
  studentGuid: string
  studentName: string
  studentRegNo: string | null
  currentStreamName: string | null
}

export interface AssignSpecializationInput {
  batchGuid: string
  streamGuid: string
  studentGuids: string[]
}

const mockStreams: SpecializationStream[] = [
  { streamGuid: 'strm-mock-1', streamCode: 'SE', streamName: 'Software Engineering' },
  { streamGuid: 'strm-mock-2', streamCode: 'NS', streamName: 'Network & Security' },
  { streamGuid: 'strm-mock-3', streamCode: 'GN', streamName: 'General' },
]

const mockBatches: Record<string, SpecializationBatchOption[]> = {
  'intake-mock-1': [{ batchGuid: 'batch-mock-1', batchCode: 'BSC.IT-2024A' }, { batchGuid: 'batch-mock-2', batchCode: 'BSC.IT-2025A' }],
}

const mockStudentStreams: Record<string, string> = {}

export function getSpecializationBatchesByIntake(intakeGuid: string, search?: string): Promise<SpecializationBatchOption[]> {
  if (MOCK_AUTH) {
    const items = mockBatches[intakeGuid] ?? []
    const q = search?.trim().toLowerCase()
    return Promise.resolve(q ? items.filter(b => b.batchCode.toLowerCase().includes(q)) : items)
  }
  const params = new URLSearchParams({ intakeGuid })
  if (search?.trim()) params.set('search', search.trim())
  return apiGet<SpecializationBatchOption[] | null>(`/api/v1/students/specialization/batches?${params.toString()}`)
    .then(data => data ?? [])
}

export function getSpecializationBatchContext(batchGuid: string): Promise<SpecializationBatchContext> {
  if (MOCK_AUTH) {
    return Promise.resolve({
      batchGuid, batchCode: 'BSC.IT-2024A', programGuid: 'prog-mock-1', programName: 'BSc. Information Technology',
      semesterGuid: 'sem-mock-1', semesterName: 'Year One - Semester One', streams: mockStreams,
    })
  }
  return apiGet<SpecializationBatchContext>(`/api/v1/students/specialization/batches/${batchGuid}/context`)
}

export function getSpecializationStudentsInBatch(batchGuid: string): Promise<SpecializationStudent[]> {
  if (MOCK_AUTH) {
    const mockRoster: SpecializationStudent[] = [
      { studentGuid: 'stu-mock-1', studentName: 'Aisha Nakamya', studentRegNo: '011240104', currentStreamName: null },
      { studentGuid: 'stu-mock-2', studentName: 'Okello James', studentRegNo: '012221279', currentStreamName: null },
    ]
    return Promise.resolve(mockRoster.map(s => ({ ...s, currentStreamName: mockStudentStreams[s.studentGuid] ?? s.currentStreamName })))
  }
  return apiGet<SpecializationStudent[] | null>(`/api/v1/students/specialization/batches/${batchGuid}/students`)
    .then(data => data ?? [])
}

export function assignSpecialization(input: AssignSpecializationInput): Promise<boolean> {
  if (MOCK_AUTH) {
    const stream = mockStreams.find(s => s.streamGuid === input.streamGuid)
    input.studentGuids.forEach(g => { mockStudentStreams[g] = stream?.streamName ?? '' })
    return Promise.resolve(true)
  }
  return apiPost<boolean>('/api/v1/students/specialization/assign', input)
}
