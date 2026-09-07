import { apiDelete, apiGet, apiPost, apiPut, AuthError } from '../client'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Confirmed via exchange-rates/get-exchange-rate-by-guid.md — the currency
// is denormalised onto every rate row (currencyCode/currencyName alongside
// currencyGuid), so callers never need a separate currency lookup just to
// label a rate.
export interface ExchangeRate {
  exchangeRateGuid: string
  currencyGuid: string
  currencyCode: string
  currencyName: string
  exRate: number
  exDate: string
}

export interface ExchangeRateHistoryResponse {
  items: ExchangeRate[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export interface ExchangeRateHistoryParams {
  currencyGuid?: string | null
  fromDate?: string | null
  toDate?: string | null
  page?: number
  pageSize?: number
}

// Confirmed via exchange-rates/get-exchange-rate-exists.md — absence is a
// normal 200 (`exists: false`) here, unlike GET /exchange-rates itself,
// which 404s on an empty day.
export interface ExchangeRateExists {
  exists: boolean
  exchangeRateGuid: string | null
  exRate: number | null
}

// Confirmed via exchange-rates/post-exchange-rate.md. exDate follows the
// same "plain yyyy-mm-dd string, let ASP.NET bind it" convention as
// payDate elsewhere in this app (paymentConsole.ts's PaymentInput) — no
// need to append a time component.
export interface CreateExchangeRateInput {
  currencyGuid: string
  exRate: number
  exDate: string
}

// Confirmed via exchange-rates/put-exchange-rate.md — currencyGuid is
// deliberately absent (the currency can't be changed), and exDate is
// accepted but the handler ignores it; only exRate is actually written.
// Still sent because the endpoint requires it on the request shape.
export interface UpdateExchangeRateInput {
  exRate: number
  exDate: string
}

const mockExchangeRates: ExchangeRate[] = []
let mockRateSeq = 1

// Confirmed via exchange-rates/get-exchange-rates-by-date.md — this is the
// "today's rates" board: all currencies' rates for one date, not a paged
// list (despite sitting on the collection root; GET .../history is the
// paged one). A day with nothing entered yet 404s `not_found` — treat that
// as an empty board, not an error, same "genuinely-empty-as-404" pattern
// confirmed elsewhere in this Finance API (paymentConsole.ts's
// getOutstandingLedgers/getPaymentHistory).
export function getExchangeRatesByDate(date: string): Promise<ExchangeRate[]> {
  if (MOCK_AUTH) return Promise.resolve(mockExchangeRates.filter(r => r.exDate.slice(0, 10) === date))
  return apiGet<ExchangeRate[] | null>(`/api/v1/finance/exchange-rates?date=${encodeURIComponent(date)}`)
    .then(data => data ?? [])
    .catch(err => {
      if (err instanceof AuthError && err.code === 'not_found') return []
      throw err
    })
}

// Confirmed via exchange-rates/get-exchange-rate-history.md — paged and
// filterable across dates/currencies, backing the rate-history grid. An
// empty result here is a normal 200 with items: [], NOT a 404 — the
// opposite of getExchangeRatesByDate above, so no not_found fallback
// needed.
export function getExchangeRateHistory(params: ExchangeRateHistoryParams): Promise<ExchangeRateHistoryResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  if (MOCK_AUTH) return Promise.resolve({ items: [], totalCount: 0, pageNumber: page, pageSize })
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (params.currencyGuid) qs.set('currencyGuid', params.currencyGuid)
  if (params.fromDate) qs.set('fromDate', params.fromDate)
  if (params.toDate) qs.set('toDate', params.toDate)
  return apiGet<ExchangeRateHistoryResponse | null>(`/api/v1/finance/exchange-rates/history?${qs.toString()}`)
    .then(data => data ?? { items: [], totalCount: 0, pageNumber: page, pageSize })
}

// Confirmed via exchange-rates/get-exchange-rate-exists.md — the pre-check
// the rate-entry form is meant to run before POST, which otherwise rejects
// a duplicate (currency, date) outright. Used by the payment console's
// Exchange Rates bar (per request, 2026-09-05) to lock a currency's input
// once today's rate already exists, independent of the by-date board
// (GetExchangeRatesByDate) that decides POST vs PUT for the actual save.
export function getExchangeRateExists(currencyGuid: string, date: string): Promise<ExchangeRateExists> {
  if (MOCK_AUTH) {
    const existing = mockExchangeRates.find(r => r.currencyGuid === currencyGuid && r.exDate.slice(0, 10) === date)
    return Promise.resolve(existing
      ? { exists: true, exchangeRateGuid: existing.exchangeRateGuid, exRate: existing.exRate }
      : { exists: false, exchangeRateGuid: null, exRate: null })
  }
  const qs = new URLSearchParams({ currencyGuid, date })
  return apiGet<ExchangeRateExists>(`/api/v1/finance/exchange-rates/exists?${qs.toString()}`)
}

export function getExchangeRateByGuid(guid: string): Promise<ExchangeRate> {
  if (MOCK_AUTH) {
    const existing = mockExchangeRates.find(r => r.exchangeRateGuid === guid)
    if (!existing) return Promise.reject(new Error('Exchange rate not found'))
    return Promise.resolve(existing)
  }
  return apiGet<ExchangeRate>(`/api/v1/finance/exchange-rates/${guid}`)
}

export function createExchangeRate(input: CreateExchangeRateInput): Promise<ExchangeRate> {
  if (MOCK_AUTH) {
    const rate: ExchangeRate = {
      exchangeRateGuid: `mock-rate-${mockRateSeq++}`,
      currencyGuid: input.currencyGuid,
      currencyCode: 'MOCK',
      currencyName: 'Mock Currency',
      exRate: input.exRate,
      exDate: input.exDate,
    }
    mockExchangeRates.push(rate)
    return Promise.resolve(rate)
  }
  return apiPost<ExchangeRate>('/api/v1/finance/exchange-rates', input)
}

// Only today's row is editable server-side — see put-exchange-rate.md.
// Callers should expect a 400 ("Only today's exchange rates can be
// updated.") for anything else and fall back to delete + re-create.
export function updateExchangeRate(guid: string, input: UpdateExchangeRateInput): Promise<ExchangeRate> {
  if (MOCK_AUTH) {
    const existing = mockExchangeRates.find(r => r.exchangeRateGuid === guid)
    if (!existing) return Promise.reject(new Error('Exchange rate not found'))
    existing.exRate = input.exRate
    return Promise.resolve(existing)
  }
  return apiPut<ExchangeRate>(`/api/v1/finance/exchange-rates/${guid}`, input)
}

// Soft-delete, no date restriction — per delete-exchange-rate.md this is
// the only route to correcting a historical (non-today) rate, since PUT
// refuses anything but today's row.
export function deleteExchangeRate(guid: string): Promise<boolean> {
  if (MOCK_AUTH) {
    const index = mockExchangeRates.findIndex(r => r.exchangeRateGuid === guid)
    if (index === -1) return Promise.reject(new Error('Exchange rate not found'))
    mockExchangeRates.splice(index, 1)
    return Promise.resolve(true)
  }
  return apiDelete<boolean>(`/api/v1/finance/exchange-rates/${guid}`)
}
