import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// UI-facing labels for the backend's ProcBankStatus enum — confirmed against
// Finance/Enums/ProcBankStatuses.bru (GET /api/v1/finance/enums/proc-bank-statuses).
export type ProcBankStatus = 'Active' | 'Inactive'

export const STATUS_VALUES: Record<ProcBankStatus, number> = { Inactive: 1, Active: 2 }
export const STATUS_LABELS: Record<number, ProcBankStatus> = { 1: 'Inactive', 2: 'Active' }

export interface ProcBank {
  procBankGuid: string
  shortCode: string
  bankName: string
  compCode: number
  branchCode: number
  status: number
  accountCode: string
  blocked: boolean
  // References FinanceCurrency.currencyGuid (see lib/api/finance/currency.ts)
  // — a distinct lookup from the academic currency master, which has no guid.
  currencyGuid: string | null
}

export type ProcBankInput = Omit<ProcBank, 'procBankGuid'>

interface ProcBankListResponse {
  items: ProcBank[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockProcBanks: ProcBank[] = [
  { procBankGuid: 'abb369d6-1d7b-45a8-aa8b-464db438d647', shortCode: 'BNK001', bankName: 'DTB-USH', compCode: 10, branchCode: 1, status: 2, accountCode: '0107927927', blocked: false, currencyGuid: null },
]

export function getProcBanks(): Promise<ProcBank[]> {
  if (MOCK_AUTH) return Promise.resolve(mockProcBanks)
  return apiGet<ProcBankListResponse | null>('/api/v1/finance/proc-banks').then(data => data?.items ?? [])
}

export function createProcBank(input: ProcBankInput): Promise<ProcBank> {
  if (MOCK_AUTH) {
    const bank: ProcBank = { procBankGuid: crypto.randomUUID(), ...input }
    mockProcBanks.push(bank)
    return Promise.resolve(bank)
  }
  return apiPost<ProcBank>('/api/v1/finance/proc-banks', input)
}

export function getProcBankById(guid: string): Promise<ProcBank> {
  if (MOCK_AUTH) {
    const existing = mockProcBanks.find(b => b.procBankGuid === guid)
    if (!existing) return Promise.reject(new Error('Bank not found'))
    return Promise.resolve(existing)
  }
  return apiGet<ProcBank>(`/api/v1/finance/proc-banks/${guid}`)
}

// Same payload shape as create (see ProcBankInput above).
export function updateProcBank(guid: string, input: ProcBankInput): Promise<ProcBank> {
  if (MOCK_AUTH) {
    const existing = mockProcBanks.find(b => b.procBankGuid === guid)
    if (!existing) return Promise.reject(new Error('Bank not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<ProcBank>(`/api/v1/finance/proc-banks/${guid}`, input)
}

// DELETE /api/v1/finance/proc-banks/{guid} — soft-delete (data: true on success).
export function deleteProcBank(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockProcBanks.findIndex(b => b.procBankGuid === guid)
    if (index === -1) return Promise.reject(new Error('Bank not found'))
    mockProcBanks.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/proc-banks/${guid}`)
}
