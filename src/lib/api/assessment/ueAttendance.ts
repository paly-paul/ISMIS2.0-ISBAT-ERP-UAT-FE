import { apiGet, apiPost } from '../client'

export interface UeAttendanceInitDto {
  programs: { programGuid: string; programCode: string; programName: string }[]
  intakes: { intakeGuid: string; intakeCode: number; description: string; currentIntake: boolean }[]
}

export interface UeAttendanceSemesterDto {
  semesterGuid: string
  semName: string
}

export interface UeAttendanceUnitDto {
  courseUnitGuid: string
  courseUnitName: string
  courseUnitCode: string
  semesterGuid: string
  unitCat: number
  unitType: number
}

export interface UeAttendanceScheduleDto {
  universityExamGuid: string
  examDate: string
  startTime: string
  endTime: string
  ueType: number
}

export interface UeAttendanceStudentDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
  isPresent: boolean
}

export interface UeAttendanceSavePayload {
  programGuid: string
  semesterGuid: string
  unitGuid: string
  intakeGuid: string
  ueType: number
  students: { studentGuid: string; isPresent: boolean }[]
}

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export function getUeAttendanceInit() {
  if (MOCK_AUTH) {
    return Promise.resolve({
      programs: [{ programGuid: 'prog-1', programCode: 'BCS', programName: 'Bachelor of Computer Science' }],
      intakes: [{ intakeGuid: 'intk-1', intakeCode: 20261, description: '2026 Intake A', currentIntake: true }]
    })
  }
  return apiGet<UeAttendanceInitDto>('/api/v1/assessment/ue-attendance/init')
}

export function getUeAttendanceSemesters(programGuid: string, intakeGuid?: string) {
  if (!programGuid) return Promise.resolve([])
  if (MOCK_AUTH) {
    return Promise.resolve([{ semesterGuid: 'sem-1', semName: 'Year One - Semester One' }])
  }
  const params = new URLSearchParams()
  params.append('programGuid', programGuid)
  if (intakeGuid) params.append('intakeGuid', intakeGuid)
  return apiGet<UeAttendanceSemesterDto[]>(`/api/v1/assessment/ue-attendance/semesters?${params.toString()}`)
}

export function getUeAttendanceUnits(programGuid: string, semesterGuid: string) {
  if (!programGuid || !semesterGuid) return Promise.resolve([])
  if (MOCK_AUTH) {
    return Promise.resolve([
      { courseUnitGuid: 'unit-1', courseUnitName: 'Computer Org', courseUnitCode: 'BCS1102', semesterGuid: 'sem-1', unitCat: 1, unitType: 3 }
    ])
  }
  return apiGet<UeAttendanceUnitDto[]>(`/api/v1/assessment/ue-attendance/units?programGuid=${programGuid}&semesterGuid=${semesterGuid}`)
}

export function getUeAttendanceSchedule(programGuid: string, semesterGuid: string, unitGuid: string, intakeGuid: string, ueType: number) {
  if (!programGuid || !semesterGuid || !unitGuid || !intakeGuid) return Promise.reject(new Error('Missing params'))
  if (MOCK_AUTH) {
    return Promise.resolve({ universityExamGuid: 'exam-1', examDate: '2026-12-09', startTime: '11:00:00', endTime: '13:00:00', ueType })
  }
  return apiGet<UeAttendanceScheduleDto>(`/api/v1/assessment/ue-attendance/schedule?programGuid=${programGuid}&semesterGuid=${semesterGuid}&unitGuid=${unitGuid}&intakeGuid=${intakeGuid}&ueType=${ueType}`)
}

export function getUeAttendanceStudents(programGuid: string, semesterGuid: string, unitGuid: string, intakeGuid: string, ueType: number, unitCat: number, streamGuid?: string) {
  if (!programGuid || !semesterGuid || !unitGuid || !intakeGuid) return Promise.resolve([])
  if (MOCK_AUTH) {
    return Promise.resolve([
      { studentGuid: 'std-1', studentRegNo: '012230035', studentName: 'ALINDA DAVID WAMUMBI', isPresent: true },
      { studentGuid: 'std-2', studentRegNo: '012230294', studentName: 'NAMANYA T ELIAS', isPresent: false }
    ])
  }
  const params = new URLSearchParams({
    programGuid,
    semesterGuid,
    unitGuid,
    intakeGuid,
    ueType: ueType.toString(),
    unitCat: unitCat.toString()
  })
  if (streamGuid) params.append('streamGuid', streamGuid)
  return apiGet<UeAttendanceStudentDto[]>(`/api/v1/assessment/ue-attendance/students?${params.toString()}`)
}

export function saveUeAttendance(payload: UeAttendanceSavePayload) {
  if (MOCK_AUTH) {
    return Promise.resolve({ savedCount: payload.students.length })
  }
  return apiPost<{ savedCount: number }>('/api/v1/assessment/ue-attendance', payload)
}
