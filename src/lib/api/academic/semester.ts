import { apiGet } from '../client'

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
