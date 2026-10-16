import { apiGet, apiPost } from '@/lib/api/client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

const BASE_PATH = '/api/v1/assessment/gown-collection'

export interface GownCollectionRow {
  studentGuid: string
  studentNumber: string | null
  studentName: string | null
  programName: string | null
  batchCode: string | null
  isGownCollected: boolean
}

const mockRows: GownCollectionRow[] = [
  { studentGuid: 'sg-1', studentNumber: '012221999', studentName: 'JANE DOE SAMPLE', programName: 'BSc IT', batchCode: 'BATCH-2022', isGownCollected: false },
  { studentGuid: 'sg-2', studentNumber: '012222000', studentName: 'JOHN SMITH', programName: 'BSc CS', batchCode: 'BATCH-2022', isGownCollected: true },
  { studentGuid: 'sg-3', studentNumber: '012222001', studentName: 'ALICE WONDER', programName: 'BBA', batchCode: 'BATCH-2023', isGownCollected: false },
  { studentGuid: 'sg-4', studentNumber: '012222002', studentName: 'BOB MARLEY', programName: 'BSc SE', batchCode: 'BATCH-2021', isGownCollected: true },
]

// GET /api/v1/assessment/gown-collection/search?searchTerm= (gown-collection/get-search.md)
// Confirmed graduates only, matched on student number or name; blank term returns [].
export function searchGownCollection(searchTerm: string): Promise<GownCollectionRow[]> {
  if (MOCK_AUTH) {
    const q = searchTerm.trim().toLowerCase()
    return Promise.resolve(mockRows.filter(r =>
      (r.studentNumber ?? '').toLowerCase().includes(q) || (r.studentName ?? '').toLowerCase().includes(q)
    ))
  }
  return apiGet<GownCollectionRow[] | null>(`${BASE_PATH}/search?searchTerm=${encodeURIComponent(searchTerm)}`)
    .then(data => data ?? [])
}

// POST /api/v1/assessment/gown-collection/{studentGuid}/collect (gown-collection/post-collect.md)
// One-way stamp — a repeat call for the same student is rejected with 400.
export function recordGownCollection(studentGuid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const row = mockRows.find(r => r.studentGuid === studentGuid)
    if (row) row.isGownCollected = true
    return Promise.resolve(true)
  }
  return apiPost<boolean>(`${BASE_PATH}/${encodeURIComponent(studentGuid)}/collect`, {})
}
