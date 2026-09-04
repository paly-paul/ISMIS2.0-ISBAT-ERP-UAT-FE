import { useQuery } from '@tanstack/react-query'
import { FinanceCurrency, getFinanceCurrencies } from '@/lib/api/finance/currency'

const FINANCE_CURRENCIES_KEY = ['finance-currencies']

export function useFinanceCurrencies() {
  return useQuery({
    queryKey: FINANCE_CURRENCIES_KEY,
    queryFn: () => getFinanceCurrencies(),
    // Never treat the cached list as stale on its own — only refetch on a
    // manual invalidation, instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export type { FinanceCurrency }
