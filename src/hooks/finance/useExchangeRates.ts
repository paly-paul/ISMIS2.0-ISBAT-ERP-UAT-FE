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
//
// Explicitly overrides the app-wide "cache until invalidated" default
// (staleTime: Infinity in providers.tsx) — same-tab saves already refresh
// this instantly via the mutations' own invalidateQueries below, but rates
// are exactly the kind of data a *different* cashier/admin can change from
// a different tab or session (e.g. saving a correction on the dedicated
// Exchange Rate Management page while Payment Console is sitting idle in
// another tab), and the global default has no way to know that happened —
// confirmed live: Payment Console kept showing a stale rate after it was
// updated elsewhere until the page was hard-reloaded. A short staleTime
// plus refetchOnWindowFocus means switching back to a tab showing this
// re-checks for a newer rate within a minute, without turning into a
// constant background poll.
export function useExchangeRatesByDate(date: string, enabled = true) {
  return useQuery({
    queryKey: [...EXCHANGE_RATES_KEY, 'by-date', date],
    queryFn: () => getExchangeRatesByDate(date),
    enabled: enabled && !!date,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useExchangeRateHistory(params: ExchangeRateHistoryParams) {
  return useQuery({
    queryKey: [...EXCHANGE_RATES_KEY, 'history', params],
    queryFn: () => getExchangeRateHistory(params),
  })
}

// Same cross-tab staleness override as useExchangeRatesByDate above, and
// for the same reason — this is what locks Payment Console's rate-entry
// input once today's rate exists, so it needs to notice a rate saved
// elsewhere just as promptly as the board itself does.
export function useExchangeRateExists(currencyGuid: string | null, date: string, enabled = true) {
  return useQuery({
    queryKey: [...EXCHANGE_RATES_KEY, 'exists', currencyGuid, date],
    queryFn: () => getExchangeRateExists(currencyGuid as string, date),
    enabled: enabled && !!currencyGuid && !!date,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
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
