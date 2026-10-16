import { apiGet } from '../client'

export interface HallTicketSearchResultDto {
  studentGuid: string
  studentRegNo: string
  studentName: string
  programName: string
  semCode: string
  batchCode: string
}


export function getHallTicketSearch(searchTerm: string, intakeGuid: string): Promise<HallTicketSearchResultDto[]> {
  const params = new URLSearchParams()
  params.set('searchTerm', searchTerm || '')
  params.set('intakeGuid', intakeGuid)
  
  return apiGet<HallTicketSearchResultDto[]>(`/api/v1/students/hall-ticket-search?${params.toString()}`)
}
