import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via the ledger-others/ doc set (repo root, 2026-09-05) — the
// other-fees catalogue (ID replacement, transcript, lateral-entry fee, …),
// CRUD-manageable through this endpoint set. A separate table from tuition
// ledgers (ledger.ts): the guid here is a ledgerOthersGuid, not
// interchangeable with a ledgerGuid. Also distinct from paymentConsole.ts's
// own getLedgerOthers() — that's the older, unpaged, read-only view over
// this same table kept for the Payment Console "Other Payment" tab's
// dropdown; this file is the full CRUD surface behind a dedicated master
// page, same relationship ledger.ts has to Payment Console's own tuition
// ledger picker.
export interface LedgerOther {
  ledgerOthersGuid: string
  ledgerCode: string
  ledgerName: string
  // Legacy int reference to a GL account — present on every read shape
  // this doc set documents. null means no GL account is mapped.
  intGlAccount: number | null
  // Not confirmed present on any read shape (only intGlAccount is
  // documented) — same unresolved-link situation ledger.ts's own
  // procGlAccountGuid field flags. The form modal prefills its GL Account
  // picker from this when present; when it's undefined/null but
  // intGlAccount isn't, there's no way to know which GL account is
  // actually linked, and the modal warns that saving will detach it (PUT
  // is a full replacement — see LedgerOtherInput below).
  procGlAccountGuid?: string | null
}

// Matches post-ledger-other.md / put-ledger-other.md. PUT is documented as
// a full replacement: "omitting procGlAccountGuid clears the mapping
// rather than leaving it alone" — always send the current guid to keep an
// existing link, never send input built without it just because the link
// couldn't be resolved on read (see LedgerOther.procGlAccountGuid above).
export interface LedgerOtherInput {
  ledgerCode: string
  ledgerName: string
  procGlAccountGuid: string | null
}

interface LedgerOtherListResponse {
  items: LedgerOther[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST,
// PUT, and DELETE are all wired to the real endpoints otherwise.
const mockLedgerOthers: LedgerOther[] = [
  { ledgerOthersGuid: '185ec079-2afe-4dc3-a999-ad35673606cf', ledgerCode: 'LEF', ledgerName: 'Lateral Entry Fee', intGlAccount: null },
  { ledgerOthersGuid: 'a1c3e5f7-9b2d-4a6c-8e0a-1c3e5a7c9b1d', ledgerCode: 'IDRP', ledgerName: 'ID Replacement', intGlAccount: null },
]

// pageSize defaults to 10 server-side, no upper bound enforced (per the
// doc) — same "load it all in one request, filter/paginate client-side"
// convention as receipt-books.ts/genSet.ts, both of which hit the exact
// "stuck at 10" bug that comes from NOT doing this.
const LEDGER_OTHERS_LOAD_SIZE = 1000

export function getLedgerOthersList(): Promise<LedgerOther[]> {
  if (MOCK_AUTH) return Promise.resolve(mockLedgerOthers)
  return apiGet<LedgerOtherListResponse | null>(`/api/v1/finance/ledger-others?page=1&pageSize=${LEDGER_OTHERS_LOAD_SIZE}`)
    .then(data => data?.items ?? [])
}

export function getLedgerOtherByGuid(guid: string): Promise<LedgerOther> {
  if (MOCK_AUTH) {
    const existing = mockLedgerOthers.find(l => l.ledgerOthersGuid === guid)
    if (!existing) return Promise.reject(new Error('Other ledger not found'))
    return Promise.resolve(existing)
  }
  return apiGet<LedgerOther>(`/api/v1/finance/ledger-others/${guid}`)
}

export function createLedgerOther(input: LedgerOtherInput): Promise<LedgerOther> {
  if (MOCK_AUTH) {
    const ledgerOther: LedgerOther = { ledgerOthersGuid: crypto.randomUUID(), ledgerCode: input.ledgerCode, ledgerName: input.ledgerName, intGlAccount: null, procGlAccountGuid: input.procGlAccountGuid }
    mockLedgerOthers.push(ledgerOther)
    return Promise.resolve(ledgerOther)
  }
  return apiPost<LedgerOther>('/api/v1/finance/ledger-others', input)
}

// Full replacement — see LedgerOtherInput's own comment on why
// procGlAccountGuid must always be sent to preserve an existing link.
export function updateLedgerOther(guid: string, input: LedgerOtherInput): Promise<LedgerOther> {
  if (MOCK_AUTH) {
    const existing = mockLedgerOthers.find(l => l.ledgerOthersGuid === guid)
    if (!existing) return Promise.reject(new Error('Other ledger not found'))
    existing.ledgerCode = input.ledgerCode
    existing.ledgerName = input.ledgerName
    existing.procGlAccountGuid = input.procGlAccountGuid
    return Promise.resolve(existing)
  }
  return apiPut<LedgerOther>(`/api/v1/finance/ledger-others/${guid}`, input)
}

// Soft-delete (isDeleted = true) — no referential check server-side (per
// the doc): an entry still referenced by historical other-payments is
// deleted anyway, only future dropdown selection breaks.
export function deleteLedgerOther(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockLedgerOthers.findIndex(l => l.ledgerOthersGuid === guid)
    if (index === -1) return Promise.reject(new Error('Other ledger not found'))
    mockLedgerOthers.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/ledger-others/${guid}`)
}

// Confirmed via get-ledger-other-dropdown.md — a lighter, search-filtered,
// always-unpaged sibling of the list above (ledgerOthersGuid/ledgerCode/
// ledgerName only, no intGlAccount). Not consumed by this master page
// itself (which lists everything via getLedgerOthersList above), but kept
// here for any future picker that wants server-side search instead of
// filtering an already-loaded list — same reasoning payment-console's own
// separate get-ledger-others.md dropdown exists for its Other Payment tab.
export interface LedgerOtherDropdownItem {
  ledgerOthersGuid: string
  ledgerCode: string
  ledgerName: string
}

export function getLedgerOthersDropdown(search?: string): Promise<LedgerOtherDropdownItem[]> {
  if (MOCK_AUTH) return Promise.resolve(mockLedgerOthers.map(({ ledgerOthersGuid, ledgerCode, ledgerName }) => ({ ledgerOthersGuid, ledgerCode, ledgerName })))
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
  return apiGet<LedgerOtherDropdownItem[] | null>(`/api/v1/finance/ledger-others/dropdown${qs}`).then(data => data ?? [])
}
