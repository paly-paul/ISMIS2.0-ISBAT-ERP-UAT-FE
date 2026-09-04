import { apiGet, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// ──────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────

export interface TestScheduleDto {
  testGuid: string
  internalAssessmentGuid: string
  testNumber: number | null
  programGuid: string | null
  semesterGuid: string | null
  courseUnitGuid: string | null
  scheduledStartDateTime: string | null
  scheduledEndDateTime: string | null
  durationMinutes: number | null
  maxMark: number | null
  testType: number | null // 0 = Online, 1 = Offline
  publishStatus: number // 0 = Unpublished, 1 = Published
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface UpdateTestScheduleRequest {
  scheduledStartDateTime: string
  scheduledEndDateTime: string
  durationMinutes: number
  maxMark: number
  testType: number
  publishStatus: number
  examRuleGuid: string | null
}

// ──────────────────────────────────────────
// MOCK DATA
// ──────────────────────────────────────────

const mockTestSchedule: Record<string, TestScheduleDto> = {
  // We'll mock a default un-scheduled state for any testGuid since we don't know them in advance
}

function getMockSchedule(testGuid: string): TestScheduleDto {
  if (!mockTestSchedule[testGuid]) {
    mockTestSchedule[testGuid] = {
      testGuid,
      internalAssessmentGuid: '9c85484c-3818-414f-b78c-4e7606632823',
      testNumber: 1,
      programGuid: null,
      semesterGuid: null,
      courseUnitGuid: null,
      scheduledStartDateTime: null,
      scheduledEndDateTime: null,
      durationMinutes: 60,
      maxMark: 15, // matches IA Creation defaults
      testType: 0, // Online
      publishStatus: 0,
      examRuleGuid: null,
      examRuleCode: null,
      examRuleName: null,
    }
  }
  return mockTestSchedule[testGuid]
}

// ──────────────────────────────────────────
// API METHODS
// ──────────────────────────────────────────

/** Loads a single Class Test (T_IA_TEST) row for editing */
export function getIaTestSchedule(testGuid: string): Promise<TestScheduleDto> {
  if (MOCK_AUTH) return Promise.resolve(getMockSchedule(testGuid))
  return apiGet<TestScheduleDto>(`/api/v1/assessment/ia-test-schedule/${testGuid}`)
}

/** Updates the schedule for an existing Class Test */
export function updateIaTestSchedule(
  testGuid: string,
  input: UpdateTestScheduleRequest
): Promise<TestScheduleDto> {
  if (MOCK_AUTH) {
    const existing = getMockSchedule(testGuid)
    mockTestSchedule[testGuid] = {
      ...existing,
      ...input,
      // In a real mock, we'd also update examRuleName if a rule was picked, but we can't easily do that here
      examRuleCode: input.examRuleGuid ? 'MOCK_CODE' : null,
      examRuleName: input.examRuleGuid ? 'Mock Rule' : null,
    }
    return Promise.resolve(mockTestSchedule[testGuid])
  }

  return apiPut<TestScheduleDto>(`/api/v1/assessment/ia-test-schedule/${testGuid}`, input)
}
