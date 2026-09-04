import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Currency, CurrencyInput, createCurrency, deleteCurrency, getCurrencies, getCurrencyById, updateCurrency } from '@/lib/api/finance/currencyMaster'

const CURRENCIES_KEY = ['currencies']

// Load enough rows to cover the full currency list in one request.
const CURRENCIES_PAGE_SIZE = 1000

export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: () => getCurrencies(1, CURRENCIES_PAGE_SIZE),
    // Keep the list cached until a mutation invalidates it.
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// Fetch-by-guid convention, same as every other real master's Edit modal —
// only enabled while the Edit modal is actually open with a guid.
export function useCurrency(guid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...CURRENCIES_KEY, guid],
    queryFn: () => getCurrencyById(guid as string),
    enabled: enabled && !!guid,
  })
}

export function useCreateCurrency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CurrencyInput) => createCurrency(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  })
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: CurrencyInput }) => updateCurrency(guid, input),
    onSuccess: (_data, { guid }) => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY })
      queryClient.invalidateQueries({ queryKey: [...CURRENCIES_KEY, guid] })
    },
  })
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guid: string) => deleteCurrency(guid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  })
}

export type { Currency, CurrencyInput }
