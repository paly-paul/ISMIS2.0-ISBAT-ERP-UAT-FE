import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

export interface Ledger {
  ledgerGuid: string
  ledgerCode: string
  ledgerName: string
  // Legacy int identifiers, server-assigned — required by ProgramMaster's
  // FeeLineInput (intLedger/ledgerNum) alongside ledgerGuid.
  intLedger: number
  ledgerNum: number
  // Legacy int reference to a GL account — present on the read shape (the
  // documented sample response only shows this field, not a guid).
  intGlAccount: number | null
  // Not confirmed present on GetByGuid/List — the abbreviated backend docs
  // only show intGlAccount above. LedgerFormModal (edit mode) prefills its GL
  // Account picker from this field when present; when it's undefined/null but
  // intGlAccount isn't, there's no way to know which GL account is actually
  // linked, and the modal warns that saving will detach it.
  procGlAccountGuid?: string | null
}

// Matches Finance/Ledgers/Create.bru + Update.bru: ledgerCode, ledgerName,
// procGlAccountGuid (optional FK to ProcGlAccount — must not be an empty
// guid string when supplied, per the backend validation). Deliberately not
// derived from Ledger via Omit since the write shape has no intGlAccount at
// all — it's a genuinely different field, not just an omission.
export interface LedgerInput {
  ledgerCode: string
  ledgerName: string
  procGlAccountGuid: string | null
}

interface LedgerListResponse {
  items: Ledger[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockLedgers: Ledger[] = [
  { ledgerGuid: '2514b3f9-65a0-4083-9bad-195b61cb2c23', ledgerCode: 'TF', ledgerName: 'Tuition Fee', intLedger: 1, ledgerNum: 1, intGlAccount: null },
  { ledgerGuid: 'f6c3e971-d25a-47ad-bc67-c1611a4852c0', ledgerCode: 'RD', ledgerName: 'Rounding', intLedger: 2, ledgerNum: 2, intGlAccount: null },
]

export function getLedgers(): Promise<Ledger[]> {
  if (MOCK_AUTH) return Promise.resolve(mockLedgers)
  return apiGet<LedgerListResponse | null>('/api/v1/finance/ledgers').then(data => data?.items ?? [])
}

export function createLedger(input: LedgerInput): Promise<Ledger> {
  if (MOCK_AUTH) {
    const ledger: Ledger = { ledgerGuid: crypto.randomUUID(), ledgerCode: input.ledgerCode, ledgerName: input.ledgerName, intLedger: mockLedgers.length + 1, ledgerNum: mockLedgers.length + 1, intGlAccount: null }
    mockLedgers.push(ledger)
    return Promise.resolve(ledger)
  }
  return apiPost<Ledger>('/api/v1/finance/ledgers', input)
}

export function getLedgerById(guid: string): Promise<Ledger> {
  if (MOCK_AUTH) {
    const existing = mockLedgers.find(l => l.ledgerGuid === guid)
    if (!existing) return Promise.reject(new Error('Ledger not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Ledger>(`/api/v1/finance/ledgers/${guid}`)
}

// Same payload shape as create (see LedgerInput above). LedgerFormModal
// (edit mode) always sends procGlAccountGuid: null (see the TODO on
// Ledger.intGlAccount) since it has no way to know the ledger's existing GL
// account link.
export function updateLedger(guid: string, input: LedgerInput): Promise<Ledger> {
  if (MOCK_AUTH) {
    const existing = mockLedgers.find(l => l.ledgerGuid === guid)
    if (!existing) return Promise.reject(new Error('Ledger not found'))
    existing.ledgerCode = input.ledgerCode
    existing.ledgerName = input.ledgerName
    return Promise.resolve(existing)
  }
  return apiPut<Ledger>(`/api/v1/finance/ledgers/${guid}`, input)
}

// DELETE /api/v1/finance/ledgers/{guid}
export function deleteLedger(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockLedgers.findIndex(l => l.ledgerGuid === guid)
    if (index === -1) return Promise.reject(new Error('Ledger not found'))
    mockLedgers.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/ledgers/${guid}`)
}
