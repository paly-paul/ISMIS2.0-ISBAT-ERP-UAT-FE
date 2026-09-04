import { apiGet, apiPost, apiPut, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via a real GET /api/v1/students/id-cards/{guid} response
// (2026-08-25) — the docs' prose ("current card + history") didn't match:
// there is no separate "current" object, and each history entry is keyed
// `cardIssueId`, not `cardIssueGuid` as the docs describe. The endpoint also
// returns a pile of student/programme/campus context fields alongside the
// card data (this DTO appears to be shared with a broader student-info
// response) — only the card-relevant fields are typed below; the rest is
// ignored rather than modeled, since nothing here needs it.
export interface IdCardHistoryEntry {
  cardIssueId: string
  issueCode: string | null
  issueDate: string | null
  joiningDate: string | null
  expiryDate: string | null
  status: number | null
  isRenewal: boolean
}

export interface IdCardDetailsDto {
  studentGuid: string
  studentRegNo: string | null
  studentName: string | null
  cardHistory: IdCardHistoryEntry[]
}

// There's no separate "current card" field on the wire — the most recent
// history entry (last in the array, since renewals append) is the current
// one. Centralized here so every caller derives it the same way rather than
// re-deciding the ordering assumption per call site.
export function currentCardIssue(details: IdCardDetailsDto | null | undefined): IdCardHistoryEntry | null {
  if (!details || details.cardHistory.length === 0) return null
  return details.cardHistory[details.cardHistory.length - 1]
}

export interface IssueOrRenewIdCardRequest {
  studentGuid: string
  joiningDate?: string | null
  expiryDate?: string | null
  remarks?: string | null
  isRenewal?: boolean
}

export interface UpdateIdCardDatesRequest {
  joiningDate: string
  expiryDate: string
}

const mockCards: Record<string, IdCardDetailsDto> = {}

// A student with no card yet is the common case (404 `not_found` per the
// docs), not a failure — resolve to null rather than throwing so callers
// don't need a try/catch for what's really just "nothing issued".
export function getIdCardDetails(studentGuid: string): Promise<IdCardDetailsDto | null> {
  if (MOCK_AUTH) return Promise.resolve(mockCards[studentGuid] ?? null)
  return apiGet<IdCardDetailsDto>(`/api/v1/students/id-cards/${studentGuid}`).catch(err => {
    if (err instanceof AuthError && err.code === 'not_found') return null
    throw err
  })
}

// The write endpoints' actual response shape hasn't been captured live yet
// (only the docs' illustrative request body has been confirmed) — callers
// should treat the resolved value as opaque and rely on re-fetching
// getIdCardDetails (e.g. via query invalidation) for anything they display,
// rather than reading fields off this return value directly.
export function issueOrRenewIdCard(payload: IssueOrRenewIdCardRequest): Promise<unknown> {
  if (MOCK_AUTH) {
    const record: IdCardHistoryEntry = {
      cardIssueId: `card-mock-${Date.now()}`,
      issueCode: null,
      issueDate: new Date().toISOString(),
      joiningDate: payload.joiningDate ?? null,
      expiryDate: payload.expiryDate ?? null,
      status: 1,
      isRenewal: payload.isRenewal ?? false,
    }
    const existing = mockCards[payload.studentGuid]
    mockCards[payload.studentGuid] = {
      studentGuid: payload.studentGuid,
      studentRegNo: existing?.studentRegNo ?? null,
      studentName: existing?.studentName ?? null,
      cardHistory: existing ? [...existing.cardHistory, record] : [record],
    }
    return Promise.resolve(record)
  }
  return apiPost('/api/v1/students/id-cards', payload)
}

// Dates are the only editable field on an issued card (docs: "remarks and
// the renewal flag set at issue cannot be changed").
export function updateIdCardDates(cardIssueId: string, payload: UpdateIdCardDatesRequest): Promise<unknown> {
  if (MOCK_AUTH) {
    for (const guid of Object.keys(mockCards)) {
      const rec = mockCards[guid]
      const idx = rec.cardHistory.findIndex(h => h.cardIssueId === cardIssueId)
      if (idx !== -1) {
        rec.cardHistory[idx] = { ...rec.cardHistory[idx], ...payload }
        return Promise.resolve(rec.cardHistory[idx])
      }
    }
    throw new AuthError('not_found')
  }
  return apiPut(`/api/v1/students/id-cards/${cardIssueId}`, payload)
}

// Raw PNG, not the ApiResult<T> envelope — bind straight to an <img src>
// rather than fetching through apiGet. In real mode this is a same-origin
// path (proxied by next.config.mjs) so the browser sends the erp_access
// cookie automatically. No mock equivalent exists; callers should skip
// rendering this while NEXT_PUBLIC_AUTH_MOCK=true.
export function getIdCardQrImageUrl(studentGuid: string): string {
  return `/api/v1/students/id-cards/${studentGuid}/qr-image`
}
