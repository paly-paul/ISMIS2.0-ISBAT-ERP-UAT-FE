import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// GET /api/v1/academic/program-course-units/{programGuid} — confirmed via a
// real sample response from the backend team. Flat list, one row per
// (courseUnit, semester) pairing already assigned to this specific program —
// this is the real source of truth for how many semesters a program actually
// has and what each is called ("Year One - Semester One", …), since that
// varies per program rather than being a fixed count. Note this DTO carries
// no unitType/unitCat/streamGuid — those still only come from
// ProgramMasterFullDetails's programUnits[] (see useProgramMasterFullDetails)
// and have to be merged in by courseUnitGuid; this endpoint's only job is
// telling you the real semesterGuid/semName grouping.
export interface ProgramCourseUnitDto {
  courseUnitGuid: string
  courseUnitName: string
  courseUnitCode: string
  semesterGuid: string
  semName: string
  flag: number
}

export function getProgramCourseUnits(programGuid: string): Promise<ProgramCourseUnitDto[]> {
  if (MOCK_AUTH) return Promise.resolve([])
  return apiGet<ProgramCourseUnitDto[] | null>(`/api/v1/academic/program-course-units/${programGuid}`)
    .then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// POST /api/v1/academic/program-course-units — see post-program-course-units.md.
// Step 2 of ProgrammeModal's Add-mode wizard (bulk-adds every course unit
// across every semester in one call, keyed by the real semesterGuid values
// Step 1's createProgramMasterStep1 handed back — semCode alone isn't
// accepted here, unlike the old combined save-complete payload).
export interface ProgramCourseUnitBulkItem {
  semesterGuid: string
  courseUnitGuid: string
  streamGuid?: string | null
  unitTypeGuid?: string | null
  unitCatGuid?: string | null
  // 1 = Core, 2 = Elective — same "Specialization has no documented value,
  // defaults to 1" caveat as ProgramUnitInput.flag in programMaster.ts.
  flag: number
}

export interface ProgramCourseUnitBulkInput {
  programGuid: string
  // Audit-log label only — not persisted (see the doc's field table).
  programName?: string
  units: ProgramCourseUnitBulkItem[]
}

export interface ProgramCourseUnitBulkResult {
  courseUnitGuid: string
  courseUnitName: string
  courseUnitCode: string
  semesterGuid: string
  semName: string
  flag: number
  streamGuid: string | null
  streamName: string | null
  unitTypeGuid: string | null
  unitTypeName: string | null
  unitCatGuid: string | null
  unitCatName: string | null
}

export function addProgramCourseUnitsBulk(input: ProgramCourseUnitBulkInput): Promise<ProgramCourseUnitBulkResult[]> {
  if (MOCK_AUTH) {
    return Promise.resolve(input.units.map(u => ({
      courseUnitGuid: u.courseUnitGuid,
      courseUnitName: '',
      courseUnitCode: '',
      semesterGuid: u.semesterGuid,
      semName: '',
      flag: u.flag,
      streamGuid: u.streamGuid ?? null,
      streamName: null,
      unitTypeGuid: u.unitTypeGuid ?? null,
      unitTypeName: null,
      unitCatGuid: u.unitCatGuid ?? null,
      unitCatName: null,
    })))
  }
  return apiPost<ProgramCourseUnitBulkResult[]>('/api/v1/academic/program-course-units', input)
}
