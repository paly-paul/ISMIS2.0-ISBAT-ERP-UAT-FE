import { apiGet, apiPostForm, apiPutForm, apiDelete } from '../client'

export interface ProjectProposalRow {
  proposalGuid: string
  studentGuid: string
  studentNum: string | null
  studentName: string | null
  unitGuid: string | null
  unitCode: string | null
  unitName: string | null
  projectName: string
  facultyGuid: string | null
  facultyName: string | null
  isGroup: boolean
  studentCount: number | null
  canEdit: boolean
}

export interface ProjectProposalDto {
  proposalGuid: string
  unitGuid: string
  studentGuid: string
  projectName: string
  objective: string | null
  isGroup: boolean
  studentCount: number | null
  members: string | null
  proposalDate: string
  synopsisFileName: string | null
  synopsisUrl: string | null
}

export interface UnitRow {
  unitGuid: string
  unitCode: string
  unitName: string
}

export interface EligibleStudentRow {
  studentGuid: string
  studentNum: string
  studentName: string
}

export function getProjectProposals() {
  return apiGet<ProjectProposalRow[]>('/api/v1/assessment/project-proposals')
}

export function getProjectProposalUnits() {
  return apiGet<UnitRow[]>('/api/v1/assessment/project-proposals/units')
}

export function getProjectProposalEligibleStudents(unitGuid: string) {
  return apiGet<EligibleStudentRow[]>(`/api/v1/assessment/project-proposals/units/${unitGuid}/eligible-students`)
}

export function getProjectProposal(guid: string) {
  return apiGet<ProjectProposalDto>(`/api/v1/assessment/project-proposals/${guid}`)
}

export function getProjectProposalSynopsis(guid: string) {
  return apiGet<any>(`/api/v1/assessment/project-proposals/${guid}/synopsis`)
}

export function createProjectProposal(req: FormData) {
  return apiPostForm<ProjectProposalDto>('/api/v1/assessment/project-proposals', req)
}

export function updateProjectProposal(guid: string, req: FormData) {
  return apiPutForm<ProjectProposalDto>(`/api/v1/assessment/project-proposals/${guid}`, req)
}

export function deleteProjectProposal(guid: string) {
  return apiDelete<boolean>(`/api/v1/assessment/project-proposals/${guid}`)
}

export async function uploadProjectProposalDocument(guid: string, file: File) {
  const existing = await getProjectProposal(guid)
  const formData = new FormData()
  formData.append('unitGuid', existing.unitGuid || '')
  formData.append('studentGuid', existing.studentGuid || '')
  formData.append('projectName', existing.projectName || '')
  formData.append('objective', existing.objective || '')
  formData.append('isGroup', String(existing.isGroup || false))
  formData.append('studentCount', String(existing.studentCount || ''))
  formData.append('members', existing.members || '')
  formData.append('proposalDate', existing.proposalDate ? existing.proposalDate.split('T')[0] : new Date().toISOString().split('T')[0])
  formData.append('removeSynopsis', 'false')
  formData.append('synopsis', file)
  return updateProjectProposal(guid, formData)
}
