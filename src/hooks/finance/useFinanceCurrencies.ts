import { useQuery } from '@tanstack/react-query'
import { FinanceCurrency, getDefaultFinanceCurrencyGuid, getFinanceCurrencies } from '@/lib/api/finance/currency'

const FINANCE_CURRENCIES_KEY = ['finance-currencies']

// enabled defaults to true so every existing call site keeps eagerly
// fetching exactly as before — only a caller that shouldn't hit the network
// until it's actually open (e.g. a modal) needs to pass enabled={isOpen}.
export function useFinanceCurrencies(enabled = true) {
  return useQuery({
    queryKey: FINANCE_CURRENCIES_KEY,
    queryFn: () => getFinanceCurrencies(),
    // Never treat the cached list as stale on its own — only refetch on a
    // manual invalidation, instead of on every remount/window focus.
    staleTime: Infinity,
    gcTime: Infinity,
    enabled,
  })
}

export type { FinanceCurrency }
export { getDefaultFinanceCurrencyGuid }
