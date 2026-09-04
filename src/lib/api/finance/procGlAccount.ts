import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// UI-facing labels for the backend's ProcGlAccountStatus/ProcGlAccountType
// enums — values confirmed against Finance/Enums/ProcGlAccountStatuses.bru
// and ProcGlAccountTypes.bru (GET /api/v1/finance/enums/proc-gl-account-*).
export type ProcGlAccountStatus = 'Active' | 'Inactive'
export type ProcGlAccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

export const STATUS_VALUES: Record<ProcGlAccountStatus, number> = { Inactive: 1, Active: 2 }
export const STATUS_LABELS: Record<number, ProcGlAccountStatus> = { 1: 'Inactive', 2: 'Active' }

export const TYPE_VALUES: Record<ProcGlAccountType, number> = { Asset: 1, Liability: 2, Equity: 3, Revenue: 4, Expense: 5 }
export const TYPE_LABELS: Record<number, ProcGlAccountType> = { 1: 'Asset', 2: 'Liability', 3: 'Equity', 4: 'Revenue', 5: 'Expense' }

export interface ProcGlAccount {
  procGlAccountGuid: string
  shortCode: string
  accName: string
  status: number
  type: number
  typeName: string | null
  blocked: boolean
}

export type ProcGlAccountInput = Omit<ProcGlAccount, 'procGlAccountGuid'>

interface ProcGlAccountListResponse {
  items: ProcGlAccount[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockProcGlAccounts: ProcGlAccount[] = [
  { procGlAccountGuid: '26fc6e6d-ccdc-4664-82e3-f9ca6ce25d8c', shortCode: '11111', accName: 'Test GL Account', status: 2, type: 1, typeName: null, blocked: false },
]

export function getProcGlAccounts(): Promise<ProcGlAccount[]> {
  if (MOCK_AUTH) return Promise.resolve(mockProcGlAccounts)
  return apiGet<ProcGlAccountListResponse | null>('/api/v1/finance/proc-gl-accounts').then(data => data?.items ?? [])
}

export function createProcGlAccount(input: ProcGlAccountInput): Promise<ProcGlAccount> {
  if (MOCK_AUTH) {
    const account: ProcGlAccount = { procGlAccountGuid: crypto.randomUUID(), ...input }
    mockProcGlAccounts.push(account)
    return Promise.resolve(account)
  }
  return apiPost<ProcGlAccount>('/api/v1/finance/proc-gl-accounts', input)
}

export function getProcGlAccountById(guid: string): Promise<ProcGlAccount> {
  if (MOCK_AUTH) {
    const existing = mockProcGlAccounts.find(a => a.procGlAccountGuid === guid)
    if (!existing) return Promise.reject(new Error('GL Account not found'))
    return Promise.resolve(existing)
  }
  return apiGet<ProcGlAccount>(`/api/v1/finance/proc-gl-accounts/${guid}`)
}

// Same payload shape as create (see ProcGlAccountInput above).
export function updateProcGlAccount(guid: string, input: ProcGlAccountInput): Promise<ProcGlAccount> {
  if (MOCK_AUTH) {
    const existing = mockProcGlAccounts.find(a => a.procGlAccountGuid === guid)
    if (!existing) return Promise.reject(new Error('GL Account not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<ProcGlAccount>(`/api/v1/finance/proc-gl-accounts/${guid}`, input)
}

// DELETE /api/v1/finance/proc-gl-accounts/{guid} — soft-delete (data: true on success).
export function deleteProcGlAccount(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockProcGlAccounts.findIndex(a => a.procGlAccountGuid === guid)
    if (index === -1) return Promise.reject(new Error('GL Account not found'))
    mockProcGlAccounts.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/proc-gl-accounts/${guid}`)
}
