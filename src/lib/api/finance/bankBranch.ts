import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// status shares the ProcBankStatus enum (1 = Inactive, 2 = Active) — see
// lib/api/finance/procBank.ts for STATUS_VALUES/STATUS_LABELS.
export interface BankBranch {
  bankBranchGuid: string
  shortCode: string
  branchName: string
  bankGuid: string
  compCode: number | null
  branchCode: number | null
  status: number
  sortCode: string
}

export type BankBranchInput = Omit<BankBranch, 'bankBranchGuid'>

interface BankBranchListResponse {
  items: BankBranch[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockBankBranches: BankBranch[] = [
  { bankBranchGuid: 'ae497a87-9dcc-4557-b6cb-41cb5356b82f', shortCode: 'DTB-LG', branchName: 'DTB- Lugogo', bankGuid: '8edd4853-5e62-4f86-8d67-5e5d3c110d47', compCode: null, branchCode: null, status: 2, sortCode: 'LGO' },
]

export function getBankBranches(): Promise<BankBranch[]> {
  if (MOCK_AUTH) return Promise.resolve(mockBankBranches)
  return apiGet<BankBranchListResponse | null>('/api/v1/finance/bank-branches').then(data => data?.items ?? [])
}

export function createBankBranch(input: BankBranchInput): Promise<BankBranch> {
  if (MOCK_AUTH) {
    const branch: BankBranch = { bankBranchGuid: crypto.randomUUID(), ...input }
    mockBankBranches.push(branch)
    return Promise.resolve(branch)
  }
  return apiPost<BankBranch>('/api/v1/finance/bank-branches', input)
}

export function getBankBranchById(guid: string): Promise<BankBranch> {
  if (MOCK_AUTH) {
    const existing = mockBankBranches.find(b => b.bankBranchGuid === guid)
    if (!existing) return Promise.reject(new Error('Bank branch not found'))
    return Promise.resolve(existing)
  }
  return apiGet<BankBranch>(`/api/v1/finance/bank-branches/${guid}`)
}

// Same payload shape as create (see BankBranchInput above).
export function updateBankBranch(guid: string, input: BankBranchInput): Promise<BankBranch> {
  if (MOCK_AUTH) {
    const existing = mockBankBranches.find(b => b.bankBranchGuid === guid)
    if (!existing) return Promise.reject(new Error('Bank branch not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<BankBranch>(`/api/v1/finance/bank-branches/${guid}`, input)
}

// DELETE /api/v1/finance/bank-branches/{guid}
export function deleteBankBranch(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockBankBranches.findIndex(b => b.bankBranchGuid === guid)
    if (index === -1) return Promise.reject(new Error('Bank branch not found'))
    mockBankBranches.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/bank-branches/${guid}`)
}
