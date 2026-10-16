import { apiGet } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface ResitAppCourseUnit {
  courseUnitGuid: string
  unitCode: string
  unitName: string
  isCombined: boolean
}

export function getResitApplicationCourseUnits() {
  if (MOCK_AUTH) {
    return Promise.resolve([
      { courseUnitGuid: 'a514298b-0469-4fcf-a195-6c8cc5fa6b9c', unitCode: 'BAE1101', unitName: 'Mathematical Economics', isCombined: false },
      { courseUnitGuid: '56470e91-831a-476e-bf70-b63f0ab91227', unitCode: 'BIT2116', unitName: 'Data Communication & Networking', isCombined: true }
    ] as ResitAppCourseUnit[])
  }
  return apiGet<any>('/api/v1/assessment/resit-application/applications/course-units')
    .then(data => {
      if (Array.isArray(data)) return data as ResitAppCourseUnit[]
      if (data && typeof data === 'object') {
        const arr = data.items || data.data || Object.values(data).find(Array.isArray)
        if (Array.isArray(arr)) return arr as ResitAppCourseUnit[]
      }
      return []
    })
}

export interface ResitApplicationQueryParams {
  courseUnitGuid?: string
  feeStatus?: number
  search?: string
  page?: number
  pageSize?: number
}

export interface ResitAppItem {
  resitApplicationGuid: string
  studentGuid: string
  studentRegNo: string
  studentNum: string
  studentName: string
  programName: string
  campusName: string
  courseUnitGuid: string
  unitCode: string
  unitName: string
  unitTypeName: string
  ueType: number
  cw: boolean
  ue: boolean
  feeStatus: number
  email: string
  phone: string
}

export interface ResitApplicationsResponse {
  resit: {
    resitConfigGuid: string
    refCode: string
    academicIntakeGuid: string
  } | null
  summary: {
    total: number
    paid: number
    unpaid: number
  }
  applications: {
    items: ResitAppItem[]
    totalCount: number
    pageNumber: number
    pageSize: number
  }
}

export function getResitApplications(params: ResitApplicationQueryParams) {
  if (MOCK_AUTH) {
    const mockData: ResitApplicationsResponse = {
      resit: { resitConfigGuid: 'guid', refCode: 'Resit Spring 2026', academicIntakeGuid: 'guid' },
      summary: { total: 1, paid: 0, unpaid: 1 },
      applications: {
        items: [
          {
            resitApplicationGuid: 'b85bd161-297e-49f0-a2ef-e20c3fc52999',
            studentGuid: '36c9835f-5b86-4c2f-afac-4f6a34a16733',
            studentRegNo: '012240336',
            studentNum: '012240336',
            studentName: 'AMIE S LAMIN',
            programName: 'Bachelor of Science in Applied Information Technology - S22',
            campusName: 'ISBAT University - Main Campus',
            courseUnitGuid: '56470e91-831a-476e-bf70-b63f0ab91227',
            unitCode: 'BIT2116',
            unitName: 'Data Communication & Networking',
            unitTypeName: 'Theory',
            ueType: 0,
            cw: false,
            ue: true,
            feeStatus: 0,
            email: 'student@example.com',
            phone: '+256700000001'
          }
        ],
        totalCount: 1,
        pageNumber: params.page || 1,
        pageSize: params.pageSize || 10
      }
    }
    return Promise.resolve(mockData)
  }
  
  const query = new URLSearchParams()
  if (params.courseUnitGuid) query.append('courseUnitGuid', params.courseUnitGuid)
  if (params.feeStatus !== undefined) query.append('feeStatus', String(params.feeStatus))
  if (params.search) query.append('search', params.search)
  if (params.page) query.append('page', String(params.page))
  if (params.pageSize) query.append('pageSize', String(params.pageSize))

  const qs = query.toString()
  return apiGet<ResitApplicationsResponse>(`/api/v1/assessment/resit-application/applications${qs ? `?${qs}` : ''}`)
}
