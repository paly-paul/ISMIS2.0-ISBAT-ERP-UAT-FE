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
