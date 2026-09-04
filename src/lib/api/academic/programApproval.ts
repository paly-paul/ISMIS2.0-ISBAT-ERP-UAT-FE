import { apiGet, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface ProgramMasterListDto {
  programGuid: string
  programCode: string
  programName: string
  pgmStatus: boolean
  noIa: boolean
  programGroupGuid: string | null
  programGroupName: string | null
  programLevelGuid: string | null
  programLevelName: string | null
  yearCount: number
  semCount: number
  facultyGuid: string | null
  facultyName: string | null
  dateAcc: string | null
  semesters: { semCode: number; semName: string }[]
}

export interface PaginatedProgramApprovals {
  items: ProgramMasterListDto[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

let mockApprovals: ProgramMasterListDto[] = [
  {
    programGuid: '68e8f374-1e76-4e7c-9b5f-0d36cc56568a',
    programCode: 'DNCSF21',
    programName: 'Diploma in Networking and Cyber Security - F21',
    pgmStatus: false,
    noIa: false,
    programGroupGuid: '4c2380f8-06aa-43e7-ada4-4010050d39eb',
    programGroupName: 'Science & Technology',
    programLevelGuid: '404f2429-c826-4ffe-8e58-cede0310af50',
    programLevelName: 'Diploma',
    yearCount: 2,
    semCount: 4,
    facultyGuid: '71571861-ed9f-4bb0-b29e-281714f7cf6a',
    facultyName: 'Faculty of Computing',
    dateAcc: '2021-06-01T00:00:00',
    semesters: [{ semCode: 1, semName: 'Semester 1' }]
  }
]

export function getProgramApprovals(pageNumber = 1, pageSize = 20, search = ''): Promise<PaginatedProgramApprovals> {
  if (MOCK_AUTH) {
    const filtered = search ? mockApprovals.filter(m => `${m.programCode} ${m.programName}`.toLowerCase().includes(search.toLowerCase())) : mockApprovals
    return Promise.resolve({
      items: filtered,
      totalCount: filtered.length,
      pageNumber,
      pageSize
    })
  }
  
  const query = new URLSearchParams()
  query.append('pageNumber', String(pageNumber))
  query.append('pageSize', String(pageSize))
  if (search) query.append('search', search)

  return apiGet<PaginatedProgramApprovals>(`/api/v1/academic/program-master/not-approved?${query.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber, pageSize })
}

export function updateProgramApproval(programGuid: string, isApproved: boolean): Promise<boolean> {
  if (MOCK_AUTH) {
    mockApprovals = mockApprovals.filter(a => a.programGuid !== programGuid)
    return Promise.resolve(true)
  }
  return apiPut<boolean>('/api/v1/academic/program-approval', { programGuid, isApproved })
}
