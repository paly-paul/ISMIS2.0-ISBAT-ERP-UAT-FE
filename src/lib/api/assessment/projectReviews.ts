import { apiGet, apiPost, apiPut, apiDelete } from '../client'

export interface UnitRow {
  unitGuid: string
  unitCode: string
  unitName: string
}

export interface StudentRow {
  proposalGuid: string
  studentGuid: string
  studentNum: string
  studentName: string
}

export interface ProjectReviewDto {
  reviewGuid: string
  proposalGuid: string
  reviewDate: string
  recommendations: string | null
  currentStatus: string | null
}

export interface ProjectReviewHistoryDto {
  proposalGuid: string
  projectName: string
  members: string | null
  synopsisFileName: string | null
  synopsisUrl: string | null
  reviews: ProjectReviewDto[]
}

export function getProjectReviewUnits() {
  return apiGet<UnitRow[]>('/api/v1/assessment/project-reviews/units')
}

export function getProjectReviewStudents(unitGuid: string) {
  return apiGet<StudentRow[]>(`/api/v1/assessment/project-reviews/units/${unitGuid}/students`)
}

export function getProjectReviews(proposalGuid: string) {
  return apiGet<ProjectReviewHistoryDto>(`/api/v1/assessment/project-reviews/proposals/${proposalGuid}/reviews`)
}

export function getProjectReviewByGuid(reviewGuid: string) {
  return apiGet<ProjectReviewDto>(`/api/v1/assessment/project-reviews/${reviewGuid}`)
}

export function createProjectReview(proposalGuid: string, req: any) {
  return apiPost<ProjectReviewDto>(`/api/v1/assessment/project-reviews/proposals/${proposalGuid}/reviews`, req)
}

export function updateProjectReview(reviewGuid: string, req: any) {
  return apiPut<ProjectReviewDto>(`/api/v1/assessment/project-reviews/${reviewGuid}`, req)
}

export function deleteProjectReview(reviewGuid: string) {
  return apiDelete<boolean>(`/api/v1/assessment/project-reviews/${reviewGuid}`)
}
