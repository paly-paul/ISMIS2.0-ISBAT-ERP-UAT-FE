import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// ──────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────

export interface IaProgramDto {
  programGuid: string
  programCode: string
  programName: string
}

export interface IaIntakeDto {
  intakeGuid: string
  intakeCode: number
  description: string | null
  currentIntake: boolean | null
}

export interface IaInitDto {
  programs: IaProgramDto[]
  intakes: IaIntakeDto[]
}

export interface IaSemesterDto {
  semesterGuid: string
  semName: string
}

export interface IaStructureRowDto {
  internalAssessmentGuid: string
  courseUnitGuid: string
  unitName: string | null
  unitCode: string | null
  semesterGuid: string
  courseworkGuid: string | null
  courseworkMaxMark: number | null
  courseworkStartDateTime: string | null
  courseworkEndDateTime: string | null
  classTestGuid: string | null
  classTestMaxMark: number | null
  classTestStartDateTime: string | null
  classTestEndDateTime: string | null
  universityExamGuid: string | null
  universityExamMaxMark: number | null
  examDate: string | null
  examStartTime: string | null
  examEndTime: string | null
}

export interface CreateIaStructureRequest {
  programGuid: string
  semesterGuid: string
  intakeGuid: string
}

// ──────────────────────────────────────────
// Mock data
// ──────────────────────────────────────────

const mockInit: IaInitDto = {
  programs: [
    { programGuid: 'prog-001', programCode: 'BSc.IT22', programName: 'Bachelor of Science in Information Technology' },
    { programGuid: 'prog-002', programCode: 'BBA-22', programName: 'Bachelor of Business Administration' },
  ],
  intakes: [
    { intakeGuid: 'intake-001', intakeCode: 20261, description: 'Spring 2026 Intake', currentIntake: true },
    { intakeGuid: 'intake-002', intakeCode: 20251, description: 'Spring 2025 Intake', currentIntake: false },
  ],
}

const mockSemesters: Record<string, IaSemesterDto[]> = {
  'prog-001': [
    { semesterGuid: 'sem-001', semName: 'Year One - Semester One' },
    { semesterGuid: 'sem-002', semName: 'Year One - Semester Two' },
    { semesterGuid: 'sem-003', semName: 'Year Two - Semester One' },
  ],
  'prog-002': [
    { semesterGuid: 'sem-004', semName: 'Year One - Semester One' },
    { semesterGuid: 'sem-005', semName: 'Year One - Semester Two' },
  ],
}

const mockStructure: IaStructureRowDto[] = [
  {
    internalAssessmentGuid: 'ia-001',
    courseUnitGuid: 'cu-001',
    unitName: 'Operating Systems',
    unitCode: 'BNCS125',
    semesterGuid: 'sem-001',
    courseworkGuid: 'cw-001',
    courseworkMaxMark: 15,
    courseworkStartDateTime: null,
    courseworkEndDateTime: null,
    classTestGuid: 'ct-001',
    classTestMaxMark: 15,
    classTestStartDateTime: null,
    classTestEndDateTime: null,
    universityExamGuid: 'ue-001',
    universityExamMaxMark: 70,
    examDate: null,
    examStartTime: null,
    examEndTime: null,
  },
  {
    internalAssessmentGuid: 'ia-002',
    courseUnitGuid: 'cu-002',
    unitName: 'Database Systems',
    unitCode: 'BNCS126',
    semesterGuid: 'sem-001',
    courseworkGuid: 'cw-002',
    courseworkMaxMark: 15,
    courseworkStartDateTime: null,
    courseworkEndDateTime: null,
    classTestGuid: 'ct-002',
    classTestMaxMark: 15,
    classTestStartDateTime: null,
    classTestEndDateTime: null,
    universityExamGuid: 'ue-002',
    universityExamMaxMark: 70,
    examDate: null,
    examStartTime: null,
    examEndTime: null,
  },
]

// ──────────────────────────────────────────
// API functions
// ──────────────────────────────────────────

/** Called once on page load — populates Programme + Academic Session dropdowns */
export function getIaCreationInit(): Promise<IaInitDto> {
  if (MOCK_AUTH) return Promise.resolve(mockInit)
  return apiGet<IaInitDto>('/api/v1/assessment/ia-creation/init').then(
    data => data ?? { programs: [], intakes: [] }
  )
}

/** Called when Programme dropdown changes — populates Semester dropdown */
export function getIaCreationSemesters(programGuid: string): Promise<IaSemesterDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockSemesters[programGuid] ?? [])
  const params = new URLSearchParams({ programGuid })
  return apiGet<IaSemesterDto[] | null>(`/api/v1/assessment/ia-creation/semesters?${params}`).then(
    data => data ?? []
  )
}

/** Called on Refresh button — loads the IA structure grid */
export function getIaCreationStructure(
  programGuid: string,
  semesterGuid: string,
  intakeGuid: string
): Promise<IaStructureRowDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockStructure)
  const params = new URLSearchParams({ programGuid, semesterGuid, intakeGuid })
  return apiGet<IaStructureRowDto[] | null>(`/api/v1/assessment/ia-creation/structure?${params}`).then(
    data => data ?? []
  )
}

/** Called on Create button — creates the IA skeleton for a Programme/Semester/Intake */
export function createIaStructure(input: CreateIaStructureRequest): Promise<IaStructureRowDto[]> {
  if (MOCK_AUTH) return Promise.resolve(mockStructure)
  return apiPost<IaStructureRowDto[]>('/api/v1/assessment/ia-creation/structure', input)
}
