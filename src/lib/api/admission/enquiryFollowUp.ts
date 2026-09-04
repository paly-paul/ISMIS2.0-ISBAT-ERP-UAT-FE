import { apiGet, apiPost } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via a real GET /api/v1/admissions/enquiry-followups response.
// Notably different from Enquiry's own list shape: this one resolves
// enquiryStatus/followUpStatus/enquirySource into name strings server-side
// rather than leaving raw ints — so unlike enquiry.ts, there's nothing to
// resolve client-side here. There is no numeric id on this DTO at all
// (no intEnquiry) — the Create endpoint's five int-typed fields
// (intEnquiry/followUpStatus/followUpMode/enquiryStatus/interestLevel)
// remain unconfirmed and unimplemented; this file only covers the list.
export interface EnquiryFollowUpListItem {
  enquiryGuid: string
  enquiryCode: string
  enquiryDate: string
  studentName: string
  nextFollowDate: string | null
  enquiryStatusName: string | null
  followUpStatusName: string | null
  enquirySourceName: string | null
  programGuid: string | null
  programName: string | null
  programCode: string | null
}

interface EnquiryFollowUpListResult {
  items: EnquiryFollowUpListItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

const mockEnquiryFollowUps: EnquiryFollowUpListItem[] = [
  {
    enquiryGuid: '351de06e-11db-4a01-9634-11d647348b7d', enquiryCode: 'EQ20212/1', enquiryDate: '2026-07-12T00:00:00',
    studentName: 'Mock Student', nextFollowDate: null, enquiryStatusName: 'Required Next Follow Up (RNF)',
    followUpStatusName: 'Call Back', enquirySourceName: 'Facebook', programGuid: null, programName: null, programCode: null,
  },
]

// search is forwarded to the endpoint's own ?search= param — confirmed live
// against the real backend (search=<name substring> narrows totalCount from
// 826 down to an exact match; a nonsense query returns totalCount: 0), same
// convention as getEmployees/getSkills/getBatches.
export function getEnquiryFollowUps(page = 1, pageSize = 10, search = ''): Promise<EnquiryFollowUpListResult> {
  if (MOCK_AUTH) {
    const q = search.trim().toLowerCase()
    const items = q
      ? mockEnquiryFollowUps.filter(r => `${r.enquiryCode} ${r.studentName}`.toLowerCase().includes(q))
      : mockEnquiryFollowUps
    return Promise.resolve({ items, totalCount: items.length, pageNumber: page, pageSize })
  }
  const q = search.trim()
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) params.set('search', q)
  return apiGet<EnquiryFollowUpListResult | null>(`/api/v1/admissions/enquiry-followups?${params}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Confirmed via GetByAdvisor.bru: same PagedResult<EnquiryFollowUpListDto>
// shape as getEnquiryFollowUps, just scoped server-side to the
// currently-authenticated advisor (no advisorGuid param to pass).
export function getEnquiryFollowUpsByAdvisor(page = 1, pageSize = 10): Promise<EnquiryFollowUpListResult> {
  if (MOCK_AUTH) {
    return Promise.resolve({ items: mockEnquiryFollowUps, totalCount: mockEnquiryFollowUps.length, pageNumber: page, pageSize })
  }
  return apiGet<EnquiryFollowUpListResult | null>(`/api/v1/admissions/enquiry-followups/getbyadvisor?page=${page}&pageSize=${pageSize}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Confirmed via Create.bru. intEnquiry/followUpStatus/followUpMode/
// enquiryStatus/interestLevel are all typed as numbers on the wire, but
// none of the corresponding masters (Enquiry, FollowUpStatus, FollowUpMode,
// EnquiryStatus, InterestLevel) expose a numeric id anywhere confirmed —
// every one of their real GET responses was checked and only ever returns
// a guid. Until the backend confirms the real mapping, NewFollowUpLogModal
// sends each field as that option's 1-based position within its fetched
// list — a guess, not a confirmed value. Wrong-but-in-range numbers here
// won't error, they'll just silently point at the wrong status/mode/level,
// so treat anything created through this form as unverified until the
// real mapping is confirmed.
export interface EnquiryFollowUpInput {
  intEnquiry: number
  advisorGuid: string
  followUpDate: string
  followUpStatus: number
  followUpMode: number
  enquiryStatus: number
  interestLevel: number | null
  nextFollowDate: string | null
  remarks: string
}

export function createEnquiryFollowUp(input: EnquiryFollowUpInput): Promise<unknown> {
  if (MOCK_AUTH) {
    return Promise.resolve({ enquiryFollowUpGuid: crypto.randomUUID(), ...input })
  }
  return apiPost<unknown>('/api/v1/admissions/enquiry-followups', input)
}
