import { apiGet, apiPut } from '../client'

export interface CwScheduleDto {
  courseworkGuid: string
  internalAssessmentGuid: string
  courseworkNumber: number | null
  programGuid: string | null
  programName: string | null
  semesterGuid: string | null
  semesterName: string | null
  courseUnitGuid: string | null
  courseUnitName: string | null
  courseUnitCode: string | null
  scheduledStartDateTime: string | null
  scheduledEndDateTime: string | null
  maxMark: number | null
  courseworkType: number | null
  publishStatus: number
  examRuleGuid: string | null
  examRuleCode: string | null
  examRuleName: string | null
}

export interface UpdateCwScheduleRequest {
  scheduledStartDateTime: string
  scheduledEndDateTime: string
  maxMark: number
  courseworkType: number
  publishStatus: number
  examRuleGuid: string | null
}

export async function getIaCwSchedule(courseworkGuid: string): Promise<CwScheduleDto> {
  const data = await apiGet<CwScheduleDto>(`/api/v1/assessment/ia-cw-schedule/${courseworkGuid}`)
  if (!data) throw new Error('Schedule not found')
  return data
}

export async function updateIaCwSchedule(courseworkGuid: string, payload: UpdateCwScheduleRequest): Promise<CwScheduleDto> {
  const data = await apiPut<CwScheduleDto>(`/api/v1/assessment/ia-cw-schedule/${courseworkGuid}`, payload)
  if (!data) throw new Error('Failed to update schedule')
  return data
}
