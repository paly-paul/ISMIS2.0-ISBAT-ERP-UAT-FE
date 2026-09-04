import { apiDelete, apiGet, apiPost, apiPut } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// UI-facing label for the backend's calcType enum (see CALC_TYPE_VALUES below
// for the wire values — the DTO rejects a string here, it must be an int).
export type DiscountCalcType = 'Amount' | 'Percentage'

export const CALC_TYPE_VALUES: Record<DiscountCalcType, number> = { Amount: 1, Percentage: 2 }
export const CALC_TYPE_LABELS: Record<number, DiscountCalcType> = { 1: 'Amount', 2: 'Percentage' }

export interface Discount {
  discountGuid: string
  discountCode: string
  discountName: string
  calcType: number | null
  amtPer: number | null
  carry: number
  cop: string | null
}

export type DiscountInput = Omit<Discount, 'discountGuid'>

interface DiscountListResponse {
  items: Discount[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET, POST, PUT,
// and DELETE are all wired to the real endpoints otherwise.
const mockDiscounts: Discount[] = [
  { discountGuid: 'd49f90ee-38cc-4291-9279-9404fd9a179b', discountCode: 'DIS-001', discountName: 'Discount code 1', calcType: null, amtPer: null, carry: 1, cop: null },
]

export function getDiscounts(): Promise<Discount[]> {
  if (MOCK_AUTH) return Promise.resolve(mockDiscounts)
  return apiGet<DiscountListResponse | null>('/api/v1/finance/discounts').then(data => data?.items ?? [])
}

export function createDiscount(input: DiscountInput): Promise<Discount> {
  if (MOCK_AUTH) {
    const discount: Discount = { discountGuid: crypto.randomUUID(), ...input }
    mockDiscounts.push(discount)
    return Promise.resolve(discount)
  }
  return apiPost<Discount>('/api/v1/finance/discounts', input)
}

export function getDiscountById(guid: string): Promise<Discount> {
  if (MOCK_AUTH) {
    const existing = mockDiscounts.find(d => d.discountGuid === guid)
    if (!existing) return Promise.reject(new Error('Discount not found'))
    return Promise.resolve(existing)
  }
  return apiGet<Discount>(`/api/v1/finance/discounts/${guid}`)
}

// Same payload shape as create (see DiscountInput above).
export function updateDiscount(guid: string, input: DiscountInput): Promise<Discount> {
  if (MOCK_AUTH) {
    const existing = mockDiscounts.find(d => d.discountGuid === guid)
    if (!existing) return Promise.reject(new Error('Discount not found'))
    Object.assign(existing, input)
    return Promise.resolve(existing)
  }
  return apiPut<Discount>(`/api/v1/finance/discounts/${guid}`, input)
}

// DELETE /api/v1/finance/discounts/{guid} — soft-delete (data: true on success).
export function deleteDiscount(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockDiscounts.findIndex(d => d.discountGuid === guid)
    if (index === -1) return Promise.reject(new Error('Discount not found'))
    mockDiscounts.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/discounts/${guid}`)
}
