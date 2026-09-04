import { apiGet, apiPut } from '../client'

export interface UeScheduleDto {
  universityExamGuid: string
  internalAssessmentGuid: string
  programGuid: string | null
  semesterGuid: string | null
  courseUnitGuid: string | null
  examDate: string | null
  startTime: string | null
  endTime: string | null
  maxMark: number | null
  examType: number | null
  universityExamType: number | null
  publishStatus: number
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
  isVerified: boolean | null
}

export interface UpdateUeScheduleRequest {
  examDate: string
  startTime: string
  endTime: string
  maxMark: number
  examType: number
  universityExamType: number
  publishStatus: number
  examRuleGuid?: string | null
}

export function getIaUeSchedule(universityExamGuid: string): Promise<UeScheduleDto> {
  return apiGet<UeScheduleDto>(`/api/v1/assessment/ia-ue-schedule/${universityExamGuid}`)
}

export function updateIaUeSchedule(universityExamGuid: string, payload: UpdateUeScheduleRequest): Promise<UeScheduleDto> {
  return apiPut<UeScheduleDto>(`/api/v1/assessment/ia-ue-schedule/${universityExamGuid}`, payload)
}
