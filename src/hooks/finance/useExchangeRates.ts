import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createExchangeRate,
  CreateExchangeRateInput,
  deleteExchangeRate,
  getExchangeRateExists,
  getExchangeRateHistory,
  ExchangeRateHistoryParams,
  getExchangeRatesByDate,
  updateExchangeRate,
  UpdateExchangeRateInput,
} from '@/lib/api/finance/exchangeRate'

const EXCHANGE_RATES_KEY = ['exchange-rates']

// Keyed by date — the "today's board" query is genuinely scoped per date,
// unlike most master-data lists in this app that load everything once.
export function useExchangeRatesByDate(date: string, enabled = true) {
  return useQuery({
    queryKey: [...EXCHANGE_RATES_KEY, 'by-date', date],
    queryFn: () => getExchangeRatesByDate(date),
    enabled: enabled && !!date,
  })
}

export function useExchangeRateHistory(params: ExchangeRateHistoryParams) {
  return useQuery({
    queryKey: [...EXCHANGE_RATES_KEY, 'history', params],
    queryFn: () => getExchangeRateHistory(params),
  })
}

export function useExchangeRateExists(currencyGuid: string | null, date: string, enabled = true) {
  return useQuery({
    queryKey: [...EXCHANGE_RATES_KEY, 'exists', currencyGuid, date],
    queryFn: () => getExchangeRateExists(currencyGuid as string, date),
    enabled: enabled && !!currencyGuid && !!date,
  })
}

// Invalidates the whole exchange-rates cache (by-date board + history grid)
// on every mutation, same "invalidate broadly, refetch is cheap" approach
// receiptBook.ts's hooks use — a single rate change can affect both the
// selected day's board and any history page that includes it.
function useInvalidateExchangeRates() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: EXCHANGE_RATES_KEY })
}

export function useCreateExchangeRate() {
  const invalidate = useInvalidateExchangeRates()
  return useMutation({
    mutationFn: (input: CreateExchangeRateInput) => createExchangeRate(input),
    onSuccess: invalidate,
  })
}

export function useUpdateExchangeRate() {
  const invalidate = useInvalidateExchangeRates()
  return useMutation({
    mutationFn: ({ guid, input }: { guid: string; input: UpdateExchangeRateInput }) => updateExchangeRate(guid, input),
    onSuccess: invalidate,
  })
}

export function useDeleteExchangeRate() {
  const invalidate = useInvalidateExchangeRates()
  return useMutation({
    mutationFn: (guid: string) => deleteExchangeRate(guid),
    onSuccess: invalidate,
  })
}

export type { ExchangeRate, ExchangeRateHistoryParams, ExchangeRateExists, CreateExchangeRateInput, UpdateExchangeRateInput } from '@/lib/api/finance/exchangeRate'
