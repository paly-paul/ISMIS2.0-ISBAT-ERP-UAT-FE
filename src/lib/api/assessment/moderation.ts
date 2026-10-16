import { apiGet, apiPut } from '@/lib/api/client'

export interface ModerationStudentSearchResult {
  studentGuid: string
  studentName: string
  studentNumber: string
  registrationNumber: string
  programName: string
  batchName: string
}

export interface ModerationStudentDetail {
  studentGuid: string
  studentName: string
  studentNumber: string
  registrationNumber: string
  programName: string
  batchName: string
  currentSemester: string
}

export interface ModerationRow {
  examResultGuid: string
  courseUnitGuid: string
  unitCode: string
  unitName: string
  semesterName: string

  iaTotal: number
  iaMod: number
  iaMax: number

  ueTotal: number
  ueMod: number
  ueMax: number

  passStatus: 'Pending' | 'RL' | 'Fail' | 'Pass'
}

export interface UpdateModerationPayload {
  iaMod: number
  ueMod: number
}

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export function searchModerationStudents(q: string) {
  if (!q) return Promise.resolve([])
  if (MOCK_AUTH) {
    return Promise.resolve([
      { studentGuid: 'std-1', studentName: 'John Doe', studentNumber: 'ST1001', registrationNumber: 'REG1001', programName: 'BSc Computer Science', batchName: '2023 Intake' },
      { studentGuid: 'std-2', studentName: 'Jane Smith', studentNumber: 'ST1002', registrationNumber: 'REG1002', programName: 'BSc IT', batchName: '2023 Intake' }
    ].filter(s => s.studentName.toLowerCase().includes(q.toLowerCase()) || s.studentNumber.toLowerCase().includes(q.toLowerCase())))
  }
  return apiGet<ModerationStudentSearchResult[]>(`/api/v1/students/moderation-search?term=${encodeURIComponent(q)}`)
}

export function getModerationStudentDetail(studentGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve({
      studentGuid,
      studentName: 'John Doe',
      studentNumber: 'ST1001',
      registrationNumber: 'REG1001',
      programName: 'BSc Computer Science',
      batchName: '2023 Intake',
      currentSemester: 'Semester 3'
    } as ModerationStudentDetail)
  }
  return apiGet<ModerationStudentDetail>(`/api/v1/students/moderation-search/${studentGuid}/detail`)
}

export function getStudentModerationRows(studentGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve([
      {
        examResultGuid: 'er-1',
        courseUnitGuid: 'cu-1',
        unitCode: 'CS201',
        unitName: 'Data Structures',
        semesterName: 'Semester 3',
        iaTotal: 15,
        iaMod: 0,
        iaMax: 30,
        ueTotal: 30,
        ueMod: 2,
        ueMax: 70,
        passStatus: 'Fail'
      },
      {
        examResultGuid: 'er-2',
        courseUnitGuid: 'cu-2',
        unitCode: 'CS202',
        unitName: 'Algorithms',
        semesterName: 'Semester 3',
        iaTotal: 20,
        iaMod: 0,
        iaMax: 30,
        ueTotal: 40,
        ueMod: 0,
        ueMax: 70,
        passStatus: 'Pass'
      },
      {
        examResultGuid: 'er-3',
        courseUnitGuid: 'cu-3',
        unitCode: 'CS203',
        unitName: 'Database Systems',
        semesterName: 'Semester 3',
        iaTotal: 12,
        iaMod: 0,
        iaMax: 30,
        ueTotal: 0,
        ueMod: 0,
        ueMax: 70,
        passStatus: 'RL'
      }
    ] as ModerationRow[])
  }
  return apiGet<ModerationRow[]>(`/api/v1/assessment/exam-results/students/${studentGuid}/moderation`)
}

export function updateModeration(studentGuid: string, examResultGuid: string, data: UpdateModerationPayload) {
  if (MOCK_AUTH) {
    return Promise.resolve({ success: true })
  }
  return apiPut<{ success: boolean }>(`/api/v1/assessment/exam-results/students/${studentGuid}/${examResultGuid}/moderation`, data)
}
