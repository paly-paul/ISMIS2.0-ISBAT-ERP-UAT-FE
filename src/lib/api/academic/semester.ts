import { apiGet, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via Scheduling/Semesters/DropdownForProgram.bru — semesters
// scoped to a specific program, used to populate semester selectors when
// creating batches. Only exposes a guid + name, no numeric id (same gap as
// BatchTime/Stream — see the note on Batch in lib/api/academic/batch.ts).
export interface SemesterOption {
  semesterGuid: string
  semName: string
}

const mockSemesters: SemesterOption[] = [
  { semesterGuid: 'a1b2c3d4-0000-0000-0000-000000000001', semName: 'Semester 1' },
  { semesterGuid: 'a1b2c3d4-0000-0000-0000-000000000002', semName: 'Semester 2' },
]

export function getSemestersForProgram(programGuid: string): Promise<SemesterOption[]> {
  if (MOCK_AUTH) return Promise.resolve(mockSemesters)
  return apiGet<SemesterOption[] | null>(`/api/v1/academic/semesters/dropdownforprogram?programGuid=${programGuid}`)
    .then((data: any) => Array.isArray(data) ? data : (data && typeof data === 'object' ? (data.items || Object.values(data).find(Array.isArray) || []) : []))
}

// GET /academic/semesters/filter/by-semcode/{semCode} — every programme's
// semester sharing that semCode (e.g. semCode 1 → each programme's own
// "Year One - Semester One"), one row per programme. Shape confirmed
// against a live response, 2026-09-29.
export interface SemesterBySemCode {
  semesterGuid: string
  programGuid: string
  programName: string
  semCode: number
  semName: string
}

export function getSemestersBySemCode(semCode: string): Promise<SemesterBySemCode[]> {
  if (MOCK_AUTH) {
    const code = Number(semCode)
    const mock = mockSemesters[code - 1]
    return Promise.resolve(mock ? [{ semesterGuid: mock.semesterGuid, programGuid: 'mock-program', programName: 'Mock Programme', semCode: code, semName: mock.semName }] : [])
  }
  // A semCode no programme uses comes back as `not_found` ("No semesters
  // found with SemCode 9.") rather than an empty list — treat it as empty.
  return apiGet<SemesterBySemCode[] | null>(`/api/v1/academic/semesters/filter/by-semcode/${encodeURIComponent(semCode)}`)
    .then(data => data ?? [])
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}
