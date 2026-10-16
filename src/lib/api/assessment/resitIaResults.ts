import { apiGet } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// GET /assessment/resit-ia-results (resit-ia-results/get-resit-ia-results.md)
// — read-only list of submitted resit IA marks for one academic session.
// One row per evaluated resit application.

// 1 Class Test · 2 Course Work
export type ResitIaCategory = 1 | 2

export interface ResitIaResultRow {
  studentNum: string | null
  studentName: string | null
  programCode: string | null
  unitName: string | null
  mark: number
  maxMark: number
}

export interface ResitIaResultsParams {
  intakeGuid: string
  category: ResitIaCategory
  resitConfigGuid?: string
  campusGuid?: string
  search?: string
  page?: number
  pageSize?: number // 1–100
}

export interface PagedResitIaResults {
  items: ResitIaResultRow[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Sample rows from the legacy "Resit IA Result" screen.
const mockRows: (ResitIaResultRow & { category: ResitIaCategory })[] = [
  { category: 2, studentNum: '012230213', studentName: 'NAKIBUUKA HAJARAH', programCode: 'BBAIBS22', unitName: 'Global Strategic Management', mark: 41, maxMark: 50 },
  { category: 2, studentNum: '012230649', studentName: 'RUHINDA DAUDI KIRENZI', programCode: 'BMITF22', unitName: 'Clinical Obstetrics Ultrasound', mark: 48, maxMark: 50 },
  { category: 2, studentNum: '012230649', studentName: 'RUHINDA DAUDI KIRENZI', programCode: 'BMITF22', unitName: 'Medical Sociology, Anthropology and Psychology', mark: 41, maxMark: 50 },
  { category: 2, studentNum: '011250204', studentName: 'NDAHIRO LAWRENCE NDUNGUSE', programCode: 'BSc.CSS22', unitName: 'Artificial Intelligence', mark: 39, maxMark: 50 },
  { category: 2, studentNum: '011230465', studentName: 'CHAN ABRAHAM KUOL CHAN', programCode: 'BSc.CSS22', unitName: 'Data Science Algorithms and Tools', mark: 46, maxMark: 50 },
  { category: 2, studentNum: '011250204', studentName: 'NDAHIRO LAWRENCE NDUNGUSE', programCode: 'BSc.CSS22', unitName: 'Database Management System', mark: 50, maxMark: 50 },
  { category: 2, studentNum: '011230465', studentName: 'CHAN ABRAHAM KUOL CHAN', programCode: 'BSc.CSS22', unitName: 'Graphics and Multimedia Systems', mark: 42, maxMark: 50 },
  { category: 2, studentNum: '011230465', studentName: 'CHAN ABRAHAM KUOL CHAN', programCode: 'BSc.CSS22', unitName: 'Introduction to Cyber Security', mark: 46, maxMark: 50 },
  { category: 2, studentNum: '012240784', studentName: 'MONALISA ADUT MAJOK WIIL', programCode: 'BSc.CSS22', unitName: 'Introduction to Cyber Security', mark: 47, maxMark: 50 },
  { category: 2, studentNum: '011250204', studentName: 'NDAHIRO LAWRENCE NDUNGUSE', programCode: 'BSc.CSS22', unitName: 'Introduction to Cyber Security', mark: 46, maxMark: 50 },
  { category: 2, studentNum: '011240168', studentName: 'BAGUMA STEPHEN', programCode: 'BSc.NCSF22', unitName: 'Intellectual Property Rights', mark: 25, maxMark: 25 },
  { category: 1, studentNum: '012221590', studentName: 'ALFRED EKANYA', programCode: 'BSc.ITS22', unitName: 'Web Technology - Theory', mark: 17.5, maxMark: 20 },
  { category: 1, studentNum: '011240005', studentName: 'LUKKA YOGIN JIGNESHBHAI', programCode: 'BSc.ITS22', unitName: 'Operating Systems', mark: 14, maxMark: 20 },
]

export function getResitIaResults(params: ResitIaResultsParams): Promise<PagedResitIaResults> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) {
    const q = params.search?.trim().toLowerCase() ?? ''
    const items = mockRows
      .filter(r => r.category === params.category)
      .filter(r => !q || [r.studentNum, r.studentName, r.programCode, r.unitName].some(v => v?.toLowerCase().includes(q)))
      .map(({ category: _c, ...r }) => r)
    return new Promise(resolve => setTimeout(() => resolve({ items: items.slice((page - 1) * pageSize, page * pageSize), totalCount: items.length, pageNumber: page, pageSize }), 250))
  }
  const qs = new URLSearchParams({ intakeGuid: params.intakeGuid, category: String(params.category), page: String(page), pageSize: String(pageSize) })
  if (params.resitConfigGuid) qs.set('resitConfigGuid', params.resitConfigGuid)
  if (params.campusGuid) qs.set('campusGuid', params.campusGuid)
  if (params.search?.trim()) qs.set('search', params.search.trim().slice(0, 100))
  return apiGet<PagedResitIaResults | null>(`/api/v1/assessment/resit-ia-results?${qs}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Every row for the current filters, for Export to Excel — pages through at
// the API's max page size (100).
export async function getAllResitIaResults(params: Omit<ResitIaResultsParams, 'page' | 'pageSize'>): Promise<ResitIaResultRow[]> {
  const rows: ResitIaResultRow[] = []
  for (let page = 1; ; page++) {
    const res = await getResitIaResults({ ...params, page, pageSize: 100 })
    rows.push(...res.items)
    if (rows.length >= res.totalCount || res.items.length === 0) return rows
  }
}
