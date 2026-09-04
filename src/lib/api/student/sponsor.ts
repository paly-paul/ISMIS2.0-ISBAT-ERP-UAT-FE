import { apiGet, apiPost, apiPut, apiDelete, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// `category` is a short code (max 10 chars, e.g. "HEC"), confirmed via
// students/sponsor-categories/*.md. `mandatoryFeeCheck` on the other hand
// contradicts the docs (they describe "nullable byte flag") — a real GET
// /students/sponsor-categories response (2026-08-25) returns it as the
// STRING "Yes"/"No", not a 0/1 byte. Typed loosely here and normalized via
// isMandatoryFeeCheck() below rather than assumed boolean/number, since the
// write side (create/update) still takes a 0/1 number per the docs' request
// examples and that continues to work — only the read shape differs.
export interface SponsorCategoryDto {
  sponsorCategoryGuid: string
  category: string
  mandatoryFeeCheck: string | number | boolean | null
}

// `mandatoryFeeCheck` has been observed as the string "Yes"/"No" (real GET
// response) and is documented as a nullable byte (0/1) for create/update —
// normalize both rather than relying on JS truthiness, which would treat the
// non-empty string "No" as true and silently show every row as "Yes".
export function isMandatoryFeeCheck(value: string | number | boolean | null | undefined): boolean {
  if (typeof value === 'string') return value.trim().toLowerCase() === 'yes'
  return !!value
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface SponsorCategoryRequest {
  category: string
  mandatoryFeeCheck?: number | null
}

// GET /studentsponsorassignment/{studentGuid}/sponsor-details response shape
// — same fields as a sponsor-category list item, per the docs.
export type SponsorDetailsDto = SponsorCategoryDto

const mockCategories: SponsorCategoryDto[] = [
  { sponsorCategoryGuid: 'spc-mock-1', category: 'SELF', mandatoryFeeCheck: 1 },
  { sponsorCategoryGuid: 'spc-mock-2', category: 'HEC', mandatoryFeeCheck: 0 },
  { sponsorCategoryGuid: 'spc-mock-3', category: 'REFUGEE', mandatoryFeeCheck: 0 },
  { sponsorCategoryGuid: 'spc-mock-4', category: 'UCAM', mandatoryFeeCheck: 0 },
]

// studentGuid -> sponsorCategoryGuid. Mirrors the real resource: at most one
// assignment per student, re-post to change it (no un-assign endpoint).
const mockAssignments: Record<string, string> = {}

export function getSponsorCategories(page = 1, pageSize = 25): Promise<PagedResult<SponsorCategoryDto>> {
  if (MOCK_AUTH) return Promise.resolve({ items: mockCategories, totalCount: mockCategories.length, pageNumber: page, pageSize })
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiGet<PagedResult<SponsorCategoryDto> | null>(`/api/v1/students/sponsor-categories?${params.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

export function createSponsorCategory(payload: SponsorCategoryRequest): Promise<SponsorCategoryDto> {
  if (MOCK_AUTH) {
    const row: SponsorCategoryDto = { sponsorCategoryGuid: `spc-mock-${Date.now()}`, category: payload.category, mandatoryFeeCheck: payload.mandatoryFeeCheck ?? null }
    mockCategories.push(row)
    return Promise.resolve(row)
  }
  return apiPost<SponsorCategoryDto>('/api/v1/students/sponsor-categories', payload)
}

export function updateSponsorCategory(guid: string, payload: SponsorCategoryRequest): Promise<SponsorCategoryDto> {
  if (MOCK_AUTH) {
    const idx = mockCategories.findIndex(c => c.sponsorCategoryGuid === guid)
    if (idx === -1) throw new AuthError('not_found')
    mockCategories[idx] = { ...mockCategories[idx], category: payload.category, mandatoryFeeCheck: payload.mandatoryFeeCheck ?? null }
    return Promise.resolve(mockCategories[idx])
  }
  return apiPut<SponsorCategoryDto>(`/api/v1/students/sponsor-categories/${guid}`, payload)
}

// No referential check on the backend — deleting a category in use just
// leaves assignments pointing at a GUID that no longer resolves. Nothing to
// guard client-side either; that's a backend gap, not ours to paper over.
export function deleteSponsorCategory(guid: string): Promise<void> {
  if (MOCK_AUTH) {
    const idx = mockCategories.findIndex(c => c.sponsorCategoryGuid === guid)
    if (idx !== -1) mockCategories.splice(idx, 1)
    return Promise.resolve()
  }
  return apiDelete<void>(`/api/v1/students/sponsor-categories/${guid}`)
}

// A student with no sponsor assignment is the common case (404 `not_found`
// per the docs) — resolve to null instead of throwing.
export function getSponsorDetails(studentGuid: string): Promise<SponsorDetailsDto | null> {
  if (MOCK_AUTH) {
    const guid = mockAssignments[studentGuid]
    const cat = mockCategories.find(c => c.sponsorCategoryGuid === guid)
    return Promise.resolve(cat ?? null)
  }
  // Route is /api/v1/studentsponsorassignment/... — its own top-level
  // segment, not nested under /students/sponsor-assignment/ — confirmed
  // against students/student-sponsor-assignment/get-sponsor-details.md
  // (2026-08-2x). The old /students/sponsor-assignment/... path would 404
  // outside mock mode.
  return apiGet<SponsorDetailsDto>(`/api/v1/studentsponsorassignment/${studentGuid}/sponsor-details`).catch(err => {
    if (err instanceof AuthError && err.code === 'not_found') return null
    throw err
  })
}

export function assignSponsorCategory(studentGuid: string, sponsorCategoryGuid: string): Promise<unknown> {
  if (MOCK_AUTH) {
    mockAssignments[studentGuid] = sponsorCategoryGuid
    return Promise.resolve({ studentGuid, sponsorCategoryGuid })
  }
  return apiPost(`/api/v1/studentsponsorassignment/${studentGuid}/sponsor-assignment`, { sponsorCategoryGuid })
}
