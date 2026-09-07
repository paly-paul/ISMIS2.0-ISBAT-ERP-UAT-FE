import { apiGet } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Finance's own currency lookup — distinct from src/lib/api/academic/currency.ts
// (the /config/currency-master list), which has no real guid. This one carries
// a genuine currencyGuid, which is what ProcBank.currencyGuid actually expects.
export interface FinanceCurrency {
  intCurrency: number
  currencyGuid: string
  currencyCode: string
  currencyName: string
  isDefault: number
}

interface FinanceCurrencyListResponse {
  items: FinanceCurrency[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// Backing store used only when NEXT_PUBLIC_AUTH_MOCK is on — GET is wired to
// the real endpoint otherwise. Read-only for now (dropdown lookup only, no
// Currency Master page under Finance yet).
const mockFinanceCurrencies: FinanceCurrency[] = [
  { intCurrency: 1, currencyGuid: 'cc6cfbae-d66a-46d3-8f31-95eacd0cdbf6', currencyCode: 'IND', currencyName: 'IND', isDefault: 1 },
]

export function getFinanceCurrencies(): Promise<FinanceCurrency[]> {
  if (MOCK_AUTH) return Promise.resolve(mockFinanceCurrencies)
  return apiGet<FinanceCurrencyListResponse | null>('/api/v1/finance/currencies').then(data => data?.items ?? [])
}

// Shared "what should a blank currency picker start on" default across
// Finance's transactional forms (Payment Console's Other Payment tab,
// Payment Refund, Payment Console Adjustments, New Advance Deposit) —
// ISBAT is a Uganda-based institution, so UGX is the overwhelmingly common
// case; per request, default to it rather than leaving the picker empty.
// Prefers the backend's own `isDefault` flag first (so this stays correct
// if that ever gets configured to something else) and only falls back to
// matching the `UGX` code directly when no row is flagged, then to the
// first currency in the list as a last resort so the picker is never left
// on a value that isn't actually one of the options.
export function getDefaultFinanceCurrencyGuid(currencies: FinanceCurrency[]): string {
  const preferred = currencies.find(c => c.isDefault === 1) ?? currencies.find(c => c.currencyCode === 'UGX')
  return preferred?.currencyGuid ?? currencies[0]?.currencyGuid ?? ''
}
