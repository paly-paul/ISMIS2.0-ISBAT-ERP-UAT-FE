import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Backs the Academic module's Batch Summary page (see
// academic/batch-summary/page.tsx). One row per batch plus a live headcount —
// unlike students/counts-by-batch (headcount only, needs known batch guids)
// or students/search/search (returns students, not batches), this is the
// one endpoint that returns the exact grid shape the page needs. Field names
// confirmed against a real GET /api/v1/academic/batch-summary response
// (2026-08-31): no batchGuid at all (slNo is the only row identifier — kept
// optional here since the page's own row key already falls back to the row
// index when it's absent), programCode alongside programName, and semester
// comes back as a bare int (semCode, 1-based across the whole programme, not
// per-year) rather than a resolved semesterName string — the page derives a
// "Year N - Semester M" label from it client-side (see semesterLabelFromCode
// there) since the endpoint doesn't resolve one. facultyName is a real field
// but has come back null on every row seen so far — genuinely unpopulated
// server-side, not a mapping gap here.
export interface BatchSummaryItem {
  slNo?: number
  batchGuid?: string
  batchCode: string
  programCode?: string
  programName: string
  semCode: number
  facultyName: string | null
  headCount: number
}

const mockBatchSummary: BatchSummaryItem[] = [
  { slNo: 1,  batchCode: 'BSC.IT-2024A', programCode: 'BSC.IT22', programName: 'BSc. Information Technology',           semCode: 5, facultyName: 'Faculty of Computing',       headCount: 52 },
  { slNo: 2,  batchCode: 'BBA-2024A',     programCode: 'BBA22',    programName: 'Bachelor of Business Admin.',           semCode: 5, facultyName: 'Faculty of Business',        headCount: 48 },
  { slNo: 3,  batchCode: 'BSC.IT-2025A', programCode: 'BSC.IT22', programName: 'BSc. Information Technology',           semCode: 1, facultyName: 'Faculty of Computing',       headCount: 37 },
  { slNo: 4,  batchCode: 'DNCS-2024A',    programCode: 'DNCS21',   programName: 'Diploma in Networking & Cyber Security', semCode: 2, facultyName: 'Faculty of Computing',       headCount: 29 },
  { slNo: 5,  batchCode: 'NUR-2025A',     programCode: 'NUR22',    programName: 'Diploma in Nursing',                    semCode: 4, facultyName: null,                        headCount: 33 },
  { slNo: 6,  batchCode: 'BBA-2025A',     programCode: 'BBA22',    programName: 'Bachelor of Business Admin.',           semCode: 1, facultyName: 'Faculty of Business',        headCount: 41 },
  { slNo: 7,  batchCode: 'BSC.CS-2024A', programCode: 'BSC.CS22', programName: 'BSc. Computer Science',                 semCode: 5, facultyName: 'Faculty of Computing',       headCount: 26 },
  { slNo: 8,  batchCode: 'DIP.ED-2024A', programCode: 'DIPED22',  programName: 'Diploma in Education',                  semCode: 2, facultyName: null,                        headCount: 31 },
  { slNo: 9,  batchCode: 'BSC.IT-2023B', programCode: 'BSC.IT22', programName: 'BSc. Information Technology',           semCode: 7, facultyName: 'Faculty of Computing',       headCount: 22 },
  { slNo: 10, batchCode: 'BBA-2023B',     programCode: 'BBA22',    programName: 'Bachelor of Business Admin.',           semCode: 7, facultyName: 'Faculty of Business',        headCount: 19 },
  { slNo: 11, batchCode: 'NUR-2024B',     programCode: 'NUR22',    programName: 'Diploma in Nursing',                    semCode: 2, facultyName: null,                        headCount: 27 },
  { slNo: 12, batchCode: 'DIP.ED-2025A', programCode: 'DIPED22',  programName: 'Diploma in Education',                  semCode: 1, facultyName: null,                        headCount: 24 },
]
// Mock rows are spread round-robin across the mock campus guids ('1'
// Makerere, '2' Kampala City, '3' Mbarara, '4' Gulu — see
// lib/api/academic/campus.ts) purely so the dropdown filter has something to
// demonstrate in NEXT_PUBLIC_AUTH_MOCK mode; the real endpoint does this
// filtering server-side. Keyed by batchCode now, not batchGuid (dropped
// from the real DTO — see the interface comment above).
const mockBatchCampusGuids: Record<string, string> = {
  'BSC.IT-2024A': '1', 'BBA-2024A': '1', 'BSC.IT-2025A': '2', 'DNCS-2024A': '2', 'NUR-2025A': '3', 'BBA-2025A': '3',
  'BSC.CS-2024A': '4', 'DIP.ED-2024A': '4', 'BSC.IT-2023B': '1', 'BBA-2023B': '2', 'NUR-2024B': '3', 'DIP.ED-2025A': '4',
}

export function getBatchSummary(campusGuid?: string | null): Promise<BatchSummaryItem[]> {
  if (MOCK_AUTH) {
    const items = campusGuid ? mockBatchSummary.filter(b => mockBatchCampusGuids[b.batchCode] === campusGuid) : mockBatchSummary
    return Promise.resolve(items)
  }
  const qs = campusGuid ? `?campusGuid=${encodeURIComponent(campusGuid)}` : ''
  return apiGet<BatchSummaryItem[] | { items: BatchSummaryItem[] } | null>(`/api/v1/academic/batch-summary${qs}`)
    .then(data => (Array.isArray(data) ? data : data?.items) ?? [])
}
