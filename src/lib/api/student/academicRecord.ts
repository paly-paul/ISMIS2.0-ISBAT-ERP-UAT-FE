import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Student academic record — shown on Dropout Rejoin's Academic Record tab,
// modelled on the student portal's own "My Academic Record" page. Two
// admin-facing endpoints (students/dropout-rejoin/*.md, 2026-09-29), each the
// staff equivalent of a student-portal call but keyed by studentGuid instead
// of the logged-in session:
//   GET .../{studentGuid}/credit-accumulation — credits summary ring
//   GET .../{studentGuid}/program-units       — full curriculum by semester
// Both 400 (`failure`) when the student has no program/semester/batch.

export interface CreditAccumulationDto {
  totalCredit: number
  earnedCredit: number
  // Rounded server-side; 0 when totalCredit is 0.
  creditPercentage: number
}

// Pending = no marks at all; RL = UE result late (UE null or 0).
export type UnitPassStatus = 'Pending' | 'Pass' | 'Fail' | 'RL'

export interface ProgramUnitDto {
  courseUnitGuid: string
  unitCode: string
  unitName: string
  credit: number
  iaMarksScored: number | null
  iaMaxMarks: number | null
  ueMarksScored: number | null
  ueMaxMarks: number | null
  passStatus: UnitPassStatus
}

export interface ProgramUnitSemesterDto {
  semesterGuid: string
  semesterName: string
  isCurrentSemester: boolean
  totalSemesterCredit: number
  units: ProgramUnitDto[]
}

export interface ProgramUnitsDto {
  studentName: string
  studentRegNo: string
  programGroupName: string
  totalProgramCredit: number
  // 0-based index into semesters; -1 = collapse all.
  autoExpandSemesterIndex: number
  semesters: ProgramUnitSemesterDto[]
}

const unit = (unitCode: string, unitName: string, credit: number, iaMarksScored: number | null, ueMarksScored: number | null, passStatus: UnitPassStatus): ProgramUnitDto =>
  ({ courseUnitGuid: unitCode, unitCode, unitName, credit, iaMarksScored, iaMaxMarks: 40, ueMarksScored, ueMaxMarks: 100, passStatus })

const mockProgramUnits: ProgramUnitsDto = {
  studentName: 'Aisha Nakamya',
  studentRegNo: '011240104',
  programGroupName: 'Bachelor of Information Technology',
  totalProgramCredit: 35,
  autoExpandSemesterIndex: 2,
  semesters: [
    { semesterGuid: 'sem-1', semesterName: 'Year One - Semester One', isCurrentSemester: false, totalSemesterCredit: 11, units: [
      unit('BIT1101', 'Introduction to Computing', 4, 34, 68, 'Pass'),
      unit('BIT1102', 'Mathematics for Computing', 4, 30, 61, 'Pass'),
      unit('BIT1103', 'Communication Skills', 3, 36, 70, 'Pass'),
    ] },
    { semesterGuid: 'sem-2', semesterName: 'Year One - Semester Two', isCurrentSemester: false, totalSemesterCredit: 8, units: [
      unit('BIT1201', 'Programming Fundamentals', 4, 32, 55, 'Pass'),
      unit('BIT1202', 'Database Systems', 4, 12, 30, 'Fail'),
    ] },
    { semesterGuid: 'sem-3', semesterName: 'Year Two - Semester One', isCurrentSemester: true, totalSemesterCredit: 16, units: [
      unit('BIT2101', 'Data Structures', 4, 31, null, 'RL'),
      unit('BIT2102', 'Computer Networks', 4, null, null, 'Pending'),
      unit('BIT2103', 'Artificial Intelligence', 4, null, null, 'Pending'),
      unit('BIT2104', 'Internet of Things', 4, null, null, 'Pending'),
    ] },
  ],
}

export function getCreditAccumulation(studentGuid: string): Promise<CreditAccumulationDto> {
  if (MOCK_AUTH) return Promise.resolve({ totalCredit: 120, earnedCredit: 63, creditPercentage: 53 })
  return apiGet<CreditAccumulationDto>(`/api/v1/students/dropout-rejoin/${studentGuid}/credit-accumulation`)
}

export function getProgramUnits(studentGuid: string): Promise<ProgramUnitsDto> {
  if (MOCK_AUTH) return Promise.resolve(mockProgramUnits)
  return apiGet<ProgramUnitsDto>(`/api/v1/students/dropout-rejoin/${studentGuid}/program-units`)
    .then(data => ({ ...data, semesters: data?.semesters ?? [] }))
}
