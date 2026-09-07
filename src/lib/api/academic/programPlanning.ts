import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via allocation/get-program-plannings.md — backs the Course
// Allocation page (which lecturer teaches which course unit, for which
// school and intake, in which term). Every reference (Unit, School/Faculty,
// Intake, Lecturer) comes back as a GUID plus its human-readable detail —
// the row never exposes a bare internal integer id, so the page never
// needs a separate lookup just to label one of these rows. employeeName is
// resolved server-side via a single batched Identity-service call, not one
// call per row — and can genuinely be null if that service has no matching
// record (a stale/orphaned lecturerGuid) or is unreachable, not a mapping
// gap here.
export interface ProgramPlanningDto {
  programPlanGuid: string
  lecturerGuid: string
  employeeName: string | null
  unitGuid: string
  courseUnitCode: string | null
  courseUnitName: string | null
  load: number | null
  schoolGuid: string
  facultyCode: string | null
  facultyName: string | null
  intakeGuid: string
  intakeCode: number | null
  description: string | null
  term: number | null
}

export interface ProgramPlanningListParams {
  unitGuid?: string | null
  schoolGuid?: string | null
  intakeGuid?: string | null
}

// Same request shape for both Create and Update (confirmed via
// put-program-planning.md: "Identical shape to POST /program-plannings").
export interface ProgramPlanningInput {
  lecturerGuid: string
  unitGuid: string
  load: number | null
  schoolGuid: string
  intakeGuid: string
  term: number | null
}

const mockProgramPlannings: ProgramPlanningDto[] = []

export function getProgramPlannings(params: ProgramPlanningListParams = {}): Promise<ProgramPlanningDto[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(
      mockProgramPlannings.filter(p =>
        (!params.unitGuid || p.unitGuid === params.unitGuid)
        && (!params.schoolGuid || p.schoolGuid === params.schoolGuid)
        && (!params.intakeGuid || p.intakeGuid === params.intakeGuid),
      ),
    )
  }
  const qs = new URLSearchParams()
  if (params.unitGuid) qs.set('unitGuid', params.unitGuid)
  if (params.schoolGuid) qs.set('schoolGuid', params.schoolGuid)
  if (params.intakeGuid) qs.set('intakeGuid', params.intakeGuid)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiGet<ProgramPlanningDto[] | null>(`/api/v1/academic/program-plannings${suffix}`).then(data => data ?? [])
}

export function getProgramPlanningById(guid: string): Promise<ProgramPlanningDto> {
  if (MOCK_AUTH) {
    const existing = mockProgramPlannings.find(p => p.programPlanGuid === guid)
    if (!existing) return Promise.reject(new Error('Program planning not found'))
    return Promise.resolve(existing)
  }
  return apiGet<ProgramPlanningDto>(`/api/v1/academic/program-plannings/${guid}`)
}

export function createProgramPlanning(input: ProgramPlanningInput): Promise<ProgramPlanningDto> {
  if (MOCK_AUTH) {
    const dup = mockProgramPlannings.find(p => p.lecturerGuid === input.lecturerGuid && p.unitGuid === input.unitGuid && p.intakeGuid === input.intakeGuid)
    if (dup) return Promise.reject(new Error('Program planning already exists for this lecturer, unit and intake.'))
    const row: ProgramPlanningDto = {
      programPlanGuid: crypto.randomUUID(),
      lecturerGuid: input.lecturerGuid,
      employeeName: null,
      unitGuid: input.unitGuid,
      courseUnitCode: null,
      courseUnitName: null,
      load: input.load,
      schoolGuid: input.schoolGuid,
      facultyCode: null,
      facultyName: null,
      intakeGuid: input.intakeGuid,
      intakeCode: null,
      description: null,
      term: input.term,
    }
    // Prepended, not appended — mirrors the real endpoint's own documented
    // default order (newest intake first, see getProgramPlannings' own
    // comment) closely enough for mock testing to show a freshly-created
    // row where a "newest to oldest" table expects to find it.
    mockProgramPlannings.unshift(row)
    return Promise.resolve(row)
  }
  return apiPost<ProgramPlanningDto>('/api/v1/academic/program-plannings', input)
}

// Returns `true` on success, not the updated row — confirmed via
// put-program-planning.md ("it does not return the updated
// ProgramPlanningDto"). Callers needing fresh state re-fetch via
// getProgramPlanningById/getProgramPlannings.
export function updateProgramPlanning(guid: string, input: ProgramPlanningInput): Promise<boolean> {
  if (MOCK_AUTH) {
    const existing = mockProgramPlannings.find(p => p.programPlanGuid === guid)
    if (!existing) return Promise.reject(new Error('Program planning not found'))
    Object.assign(existing, {
      lecturerGuid: input.lecturerGuid,
      unitGuid: input.unitGuid,
      load: input.load,
      schoolGuid: input.schoolGuid,
      intakeGuid: input.intakeGuid,
      term: input.term,
    })
    return Promise.resolve(true)
  }
  return apiPut<boolean>(`/api/v1/academic/program-plannings/${guid}`, input)
}

// Soft-delete — confirmed via delete-program-planning.md: no "in use" check
// on the backend, and re-deleting an already-deleted row 404s (the lookup
// excludes soft-deleted rows), so a double-click here surfaces as a real
// error rather than a silent no-op.
export function deleteProgramPlanning(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockProgramPlannings.findIndex(p => p.programPlanGuid === guid)
    if (index === -1) return Promise.reject(new Error('Program planning not found'))
    mockProgramPlannings.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/academic/program-plannings/${guid}`)
}
