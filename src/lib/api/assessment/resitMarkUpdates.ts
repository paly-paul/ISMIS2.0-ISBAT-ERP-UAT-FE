import { apiGet, apiPost } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface ResitMarkUpdateQueryParams {
  intakeGuid: string
  resitConfigGuid: string
  status?: number
  search?: string
  page?: number
  pageSize?: number
}

// currentMark / maxMark are null when the student has no exam result (or it
// lacks the maximum) — those rows come with a `warning` and can't be pushed.
export interface ResitMarkUpdatePart {
  status: number
  currentMark: number | null
  newMark: number | null
  maxMark: number | null
}

export interface ResitMarkUpdateItem {
  resitApplicationGuid: string
  studentGuid: string
  studentNum: string
  studentRegNo: string
  studentName: string
  programmeName: string
  courseUnitGuid: string
  unitCode: string
  unitName: string
  unitTypeName: string
  isCombined: boolean
  status: number
  ia: ResitMarkUpdatePart
  ue: ResitMarkUpdatePart
  warning: string | null
}

export interface ResitMarkUpdateSummary {
  ready: number
  pending: number
  pushed: number
}

export interface ResitMarkUpdatesResponse {
  summary: ResitMarkUpdateSummary
  rows: {
    items: ResitMarkUpdateItem[]
    totalCount: number
    pageNumber: number
    pageSize: number
  }
}

export function getResitMarkUpdates(params: ResitMarkUpdateQueryParams) {
  if (MOCK_AUTH) {
    const mockData: ResitMarkUpdatesResponse = {
      summary: { ready: 2, pending: 1535, pushed: 0 },
      rows: {
        items: [
          {
            resitApplicationGuid: '6fb760e9-bc05-4652-ac3f-d3cc1b15c12f',
            studentGuid: 'fae862f1-b45e-4829-b66d-73348c7de89d',
            studentNum: '011240168',
            studentRegNo: '011240168',
            studentName: 'BAGUMA STEPHEN',
            programmeName: 'BSc Networks and Cyber Security',
            courseUnitGuid: '3749c70b-3187-48fb-9054-d1d0d030f6ea',
            unitCode: 'BNCS3234',
            unitName: 'Intellectual Property Rights',
            unitTypeName: 'Theory',
            isCombined: false,
            status: 0,
            ia: { status: 2, currentMark: 0.00, newMark: 30.00, maxMark: 30.00 },
            ue: { status: 1, currentMark: 0.00, newMark: null, maxMark: 70.00 },
            warning: null
          },
          {
            resitApplicationGuid: 'a4b860e9-bc05-4652-ac3f-d3cc1b15c12a',
            studentGuid: 'fae862f1-b45e-4829-b66d-73348c7de89c',
            studentNum: '012220626',
            studentRegNo: '012220626',
            studentName: 'KATO JOSEPH',
            programmeName: 'BSc Networks and Cyber Security',
            courseUnitGuid: '3749c70b-3187-48fb-9054-d1d0d030f6eb',
            unitCode: 'BIT2116',
            unitName: 'Data Communication',
            unitTypeName: 'Combined',
            isCombined: true,
            status: 0,
            ia: { status: 0, currentMark: 0.00, newMark: null, maxMark: 30.00 },
            ue: { status: 2, currentMark: 35.00, newMark: 13.30, maxMark: 70.00 },
            warning: 'No exam result to update.'
          }
        ],
        totalCount: 2,
        pageNumber: params.page || 1,
        pageSize: params.pageSize || 10
      }
    }
    return Promise.resolve(mockData)
  }
  
  const query = new URLSearchParams()
  query.append('intakeGuid', params.intakeGuid)
  query.append('resitConfigGuid', params.resitConfigGuid)
  if (params.status !== undefined) query.append('status', String(params.status))
  if (params.search) query.append('search', params.search)
  if (params.page) query.append('page', String(params.page))
  if (params.pageSize) query.append('pageSize', String(params.pageSize))

  const qs = query.toString()
  return apiGet<ResitMarkUpdatesResponse>(`/api/v1/assessment/resit-mark-updates?${qs}`)
}

export interface PushResitMarkUpdateResponse {
  resitApplicationGuid: string
  ia: ResitMarkUpdatePart
  ue: ResitMarkUpdatePart
}

export function pushResitMarkUpdate(resitApplicationGuid: string) {
  if (MOCK_AUTH) {
    return Promise.resolve({
      resitApplicationGuid,
      ia: { status: 3, currentMark: 0.00, newMark: 30.00, maxMark: 30.00 },
      ue: { status: 1, currentMark: 0.00, newMark: null, maxMark: 70.00 }
    } as PushResitMarkUpdateResponse)
  }
  return apiPost<PushResitMarkUpdateResponse>(`/api/v1/assessment/resit-mark-updates/${resitApplicationGuid}/push`, {})
}
