import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Distinct from procBank.ts (ProcBank / /api/v1/finance/proc-banks) — this is
// the simpler Bank master (no accountCode/blocked/currencyGuid). Shares the
// same ProcBankStatus enum on the wire (1 = Inactive, 2 = Active), confirmed
// via Finance/Banks/Create.bru — reuse STATUS_VALUES/STATUS_LABELS from
// procBank.ts rather than duplicating the mapping.
export interface Bank {
  bankGuid: string
  shortCode: string
  bankName: string
  compCode: number | null
  branchCode: number | null
  status: number
}

export type BankInput = Omit<Bank, 'bankGuid'>

interface BankListResponse {
  items: Bank[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockBanks: Bank[] = [
  { bankGuid: '8edd4853-5e62-4f86-8d67-5e5d3c110d47', shortCode: 'DTB', bankName: 'Diomond Trust Bank', compCode: null, branchCode: null, status: 2 },
]

export function getBanks(): Promise<Bank[]> {
  if (MOCK_AUTH) return Promise.resolve(mockBanks)
  return apiGet<BankListResponse | null>('/api/v1/finance/banks').then(data => data?.items ?? [])
}

export function createBank(input: BankInput): Promise<Bank> {
  if (MOCK_AUTH) {
    const bank: Bank = { bankGuid: crypto.randomUUID(), ...input }
    mockBanks.push(bank)
    return Promise.resolve(bank)
  }
  return apiPost<Bank>('/api/v1/finance/banks', input)
}

export function getBankById(guid: string): Promise<Bank> {
  if (MOCK_AUTH) {
    const existing = mockBanks.find(b => b.bankGuid === guid)
    if (!existing) return Promise.reject(new Error('Bank not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Bank>(`/api/v1/finance/banks/${guid}`)
}

// Same payload shape as create (see BankInput above).
export function updateBank(guid: string, input: BankInput): Promise<Bank> {
  if (MOCK_AUTH) {
    const existing = mockBanks.find(b => b.bankGuid === guid)
    if (!existing) return Promise.reject(new Error('Bank not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Bank>(`/api/v1/finance/banks/${guid}`, input)
}

// DELETE /api/v1/finance/banks/{guid}
export function deleteBank(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockBanks.findIndex(b => b.bankGuid === guid)
    if (index === -1) return Promise.reject(new Error('Bank not found'))
    mockBanks.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/banks/${guid}`)
}
