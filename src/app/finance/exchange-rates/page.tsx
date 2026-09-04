'use client'
import { useEffect, useState } from 'react'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import DatePicker from '@/components/DatePicker'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import {
  useExchangeRatesByDate,
  useExchangeRateHistory,
  useCreateExchangeRate,
  useUpdateExchangeRate,
  useDeleteExchangeRate,
  ExchangeRate,
} from '@/hooks/finance/useExchangeRates'

// Stable reference for the "no data yet" case — `data = []` as a
// destructuring default creates a NEW array literal every render while
// `data` is undefined (loading, or between an invalidation and its
// refetch resolving). That new reference fed straight into a useEffect's
// dependency array below, so the effect fired every render, called
// setState, triggered a re-render, got a new [] again, and looped forever
// ("Maximum update depth exceeded", confirmed live). A module-level
// constant has one identity for the app's whole lifetime.
const EMPTY_RATES: ExchangeRate[] = []

function pad(n: number) { return String(n).padStart(2, '0') }

function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// yyyy-mm-dd -> yyyy-mm-dd, one day earlier. Used only to source the
// "Yesterday" comparison column — the API has no dedicated "previous rate"
// endpoint, so this fetches GetExchangeRatesByDate a second time for
// rateDate - 1.
function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + delta)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

// dd/mm/yyyy display, matching the app-wide date convention (DatePicker's
// own toDisplay, and the old mock history table's format).
function toDisplayDate(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) return <div className="text-g400" style={{ fontSize: 11 }}>No prior rate</div>
  const diff = current - previous
  const pct = previous ? (diff / previous) * 100 : 0
  if (Math.abs(diff) < 0.005) return <div className="text-muted" style={{ fontSize: 11 }}>No change</div>
  const up = diff > 0
  return (
    <div className={up ? 'text-green' : 'text-red'} style={{ fontSize: 11 }}>
      {up ? '↑' : '↓'} {up ? '+' : ''}{diff.toFixed(2)} ({up ? '+' : ''}{pct.toFixed(1)}%)
    </div>
  )
}

export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const today = todayYmd()
  const [rateDate, setRateDate] = useState(today)
  const isToday = rateDate === today

  const { data: allCurrencies = [] } = useFinanceCurrencies()
  // Base currency needs no rate against itself — GetExchangeRates has no
  // concept of a "base" row at all, this is purely a display convenience
  // mirrored from the old mock UI.
  const baseCurrency = allCurrencies.find(c => c.isDefault === 1)
  const rateCurrencies = allCurrencies.filter(c => c.isDefault !== 1)

  const { data: ratesForDate = EMPTY_RATES, isLoading: isRatesLoading, isError: isRatesError, error: ratesError } = useExchangeRatesByDate(rateDate)
  const { data: ratesForPrevDate = EMPTY_RATES } = useExchangeRatesByDate(addDays(rateDate, -1))
  const prevRateByCurrency = new Map(ratesForPrevDate.map(r => [r.currencyGuid, r.exRate]))
  const existingByCurrency = new Map(ratesForDate.map(r => [r.currencyGuid, r]))

  // Local editable values, keyed by currencyGuid — reseeded from the
  // server's rates for rateDate whenever the selected date changes or that
  // fetch resolves (e.g. right after a save invalidates it), so the field
  // reflects what's actually saved rather than staying stuck on a stale
  // typed value.
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({})
  useEffect(() => {
    const map: Record<string, string> = {}
    ratesForDate.forEach(r => { map[r.currencyGuid] = String(r.exRate) })
    setRateInputs(map)
  }, [ratesForDate, rateDate])

  const createMutation = useCreateExchangeRate()
  const updateMutation = useUpdateExchangeRate()
  const deleteMutation = useDeleteExchangeRate()
  const isSaving = createMutation.isPending || updateMutation.isPending

  async function saveRate(currencyGuid: string, currencyCode: string) {
    const raw = rateInputs[currencyGuid] ?? ''
    const num = parseFloat(raw)
    if (!raw || !(num > 0)) { showToast(`Enter a valid rate for ${currencyCode}.`, 'warn'); return }
    const existing = existingByCurrency.get(currencyGuid)
    try {
      if (existing) {
        // Only today's row can be corrected via PUT (put-exchange-rate.md);
        // the UI already hides the editable input for a historical row that
        // already has a rate (see the per-row render below), so reaching
        // here with existing && !isToday shouldn't normally happen — this
        // is a last-resort guard against a race (date changed mid-save).
        if (!isToday) { showToast('Only today’s exchange rates can be updated. Delete the historical rate below and re-enter it instead.', 'warn'); return }
        await updateMutation.mutateAsync({ guid: existing.exchangeRateGuid, input: { exRate: num, exDate: rateDate } })
      } else {
        await createMutation.mutateAsync({ currencyGuid, exRate: num, exDate: rateDate })
      }
      showToast(`${currencyCode} rate saved.`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to save the ${currencyCode} rate.`, 'error')
    }
  }

  async function handleSaveAll() {
    if (!rateDate) { showToast('Rate date is required.', 'warn'); return }
    const targets = rateCurrencies.filter(c => {
      const existing = existingByCurrency.get(c.currencyGuid)
      // Skip rows the UI has already made read-only (historical + already
      // set) — nothing to save there.
      if (existing && !isToday) return false
      const raw = rateInputs[c.currencyGuid]
      return !!raw && parseFloat(raw) > 0
    })
    if (targets.length === 0) { showToast('Enter at least one currency rate.', 'warn'); return }

    let successCount = 0
    const failures: string[] = []
    for (const c of targets) {
      const num = parseFloat(rateInputs[c.currencyGuid])
      const existing = existingByCurrency.get(c.currencyGuid)
      try {
        if (existing) await updateMutation.mutateAsync({ guid: existing.exchangeRateGuid, input: { exRate: num, exDate: rateDate } })
        else await createMutation.mutateAsync({ currencyGuid: c.currencyGuid, exRate: num, exDate: rateDate })
        successCount++
      } catch (err) {
        failures.push(`${c.currencyCode}: ${err instanceof Error ? err.message : 'failed'}`)
      }
    }
    if (failures.length === 0) showToast(`Saved rates for ${successCount} currenc${successCount === 1 ? 'y' : 'ies'}.`, 'success')
    else showToast(`Saved ${successCount}; failed — ${failures.join('; ')}`, successCount > 0 ? 'warn' : 'error')
  }

  // History panel — separate filter state from the rate-entry date above;
  // this drives GET /exchange-rates/history, a genuinely different,
  // paged/ranged endpoint (get-exchange-rate-history.md), not the
  // single-day board.
  const [historyCurrencyGuid, setHistoryCurrencyGuid] = useState('')
  const [historyFromDate, setHistoryFromDate] = useState('')
  const [historyToDate, setHistoryToDate] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const historyPageSize = 10

  // Reset to page 1 whenever a filter changes, so switching filters can't
  // strand the view on a now out-of-range page.
  useEffect(() => { setHistoryPage(1) }, [historyCurrencyGuid, historyFromDate, historyToDate])

  const { data: history, isLoading: isHistoryLoading } = useExchangeRateHistory({
    currencyGuid: historyCurrencyGuid || null,
    fromDate: historyFromDate || null,
    toDate: historyToDate || null,
    page: historyPage,
    pageSize: historyPageSize,
  })
  const historyItems = history?.items ?? []
  const historyTotal = history?.totalCount ?? 0
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize))

  async function handleDelete(guid: string, label: string) {
    if (!window.confirm(`Delete the exchange rate ${label}? This is the only way to correct a historical rate — it can't be undone.`)) return
    try {
      await deleteMutation.mutateAsync(guid)
      showToast('Exchange rate deleted.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete exchange rate.', 'error')
    }
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Exchange Rate Management</div>
            <div className="pg-sub">Set per-currency daily rates · Required before payments in that currency can be allocated</div>
          </div>
          <button className="btn btn-primary" disabled={isSaving} onClick={handleSaveAll}>
            <i className="lni lni-save"></i> {isSaving ? 'Saving…' : 'Save Rates'}
          </button>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-world"></i></span> Set Exchange Rates</div>
              {isToday && <span className="badge badge-blue"><span className="bdot"></span>Today</span>}
            </div>

            <div className="fg mb-[14px]">
              <div className="lbl">Rate Date <span className="req">*</span></div>
              {/* maxYmd enforces CreateExchangeRateCommandValidator's "exDate
                  cannot be in the future" rule client-side too. */}
              <DatePicker value={rateDate} onChange={setRateDate} maxYmd={today} />
            </div>

            {baseCurrency && (
              <>
                <div className="sec-divider">Currency Rates (Base: {baseCurrency.currencyCode})</div>
                <div className="flex items-center gap-3 flex-wrap p-[14px] border border-[1.5px] border-g200 rounded-[var(--rsm)] bg-surface mb-[14px]">
                  <span className="badge badge-gold" style={{ fontSize: 14, padding: '8px 12px' }}>{baseCurrency.currencyCode}</span>
                  <div className="flex-1" style={{ minWidth: 160 }}>
                    <div className="lbl">Base Currency (Fixed)</div>
                    <div className="font-mono font-extrabold text-blue" style={{ fontSize: 22 }}>1.000000</div>
                  </div>
                  <div className="text-g400" style={{ fontSize: 11 }}>Reference base</div>
                </div>
              </>
            )}

            {isRatesLoading && <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading rates for this date…</div>}
            {!isRatesLoading && isRatesError && (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}>
                <i className="lni lni-warning"></i> {ratesError instanceof Error ? ratesError.message : 'Failed to load rates for this date.'}
              </div>
            )}

            {!isRatesLoading && !isRatesError && (
              <div className="flex flex-col gap-[14px]">
                {rateCurrencies.length === 0 && (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No non-base currencies configured.</div>
                )}
                {rateCurrencies.map(c => {
                  const existing = existingByCurrency.get(c.currencyGuid)
                  const locked = !!existing && !isToday
                  return (
                    <div key={c.currencyGuid} className="flex items-center gap-3 flex-wrap p-[14px] border border-[1.5px] border-b200 rounded-[var(--rsm)] bg-b50">
                      <span className="badge badge-gold" style={{ fontSize: 14, padding: '8px 12px' }}>{c.currencyCode}</span>
                      <div className="flex-1" style={{ minWidth: 160 }}>
                        <div className="lbl">{c.currencyName} per 1 {baseCurrency?.currencyCode ?? 'base'} <span className="req">*</span></div>
                        {locked ? (
                          <>
                            <div className="font-mono font-extrabold text-g700" style={{ fontSize: 22 }}>{existing.exRate.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                            <div className="text-g400" style={{ fontSize: 11 }}>
                              Historical rate already set — only today’s rates can be edited. Delete it below (History panel) to change.
                            </div>
                          </>
                        ) : (
                          <input
                            className="rate-big-input"
                            type="number"
                            step="0.000001"
                            min={0}
                            value={rateInputs[c.currencyGuid] ?? ''}
                            onChange={e => setRateInputs(prev => ({ ...prev, [c.currencyGuid]: e.target.value }))}
                          />
                        )}
                      </div>
                      {!locked && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-right">
                            <div className="text-g400" style={{ fontSize: 10.5 }}>Yesterday</div>
                            <div className="font-bold text-g500">{prevRateByCurrency.has(c.currencyGuid) ? prevRateByCurrency.get(c.currencyGuid)!.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}</div>
                            <Delta current={parseFloat(rateInputs[c.currencyGuid] ?? '') || 0} previous={prevRateByCurrency.get(c.currencyGuid) ?? null} />
                          </div>
                          <button className="btn btn-neu btn-sm" disabled={isSaving} onClick={() => saveRate(c.currencyGuid, c.currencyCode)}>
                            <i className="lni lni-save"></i> {existing ? 'Update' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bar-chart"></i></span> Rate History</div>
            </div>

            <div className="g3 mb-[14px]">
              <div className="fg" style={{ marginBottom: 0 }}>
                <div className="lbl">Currency</div>
                <select className="ctrl" value={historyCurrencyGuid} onChange={e => setHistoryCurrencyGuid(e.target.value)}>
                  <option value="">All currencies</option>
                  {allCurrencies.map(c => <option key={c.currencyGuid} value={c.currencyGuid}>{c.currencyCode}</option>)}
                </select>
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <div className="lbl">From</div>
                <DatePicker value={historyFromDate} onChange={setHistoryFromDate} />
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <div className="lbl">To</div>
                <DatePicker value={historyToDate} onChange={setHistoryToDate} />
              </div>
            </div>

            {isHistoryLoading ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading history…</div>
            ) : historyItems.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No exchange rates recorded for this filter.</div>
            ) : (
              <>
                <ScrollTable>
                  <table>
                    <thead><tr><th>Date</th><th>Currency</th><th>Rate</th><th></th></tr></thead>
                    <tbody>
                      {historyItems.map(r => (
                        <tr key={r.exchangeRateGuid}>
                          <td>{toDisplayDate(r.exDate.slice(0, 10))}</td>
                          <td><span className="badge badge-gold">{r.currencyCode}</span></td>
                          <td className="font-mono font-bold">{r.exRate.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td>
                            <button
                              className="btn btn-neu btn-sm"
                              onClick={() => handleDelete(r.exchangeRateGuid, `${r.currencyCode} · ${toDisplayDate(r.exDate.slice(0, 10))}`)}
                            >
                              <i className="lni lni-trash-can"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
                <div className="flex items-center justify-between mt-[10px]" style={{ fontSize: 12 }}>
                  <span className="text-muted">Page {historyPage} of {historyTotalPages} · {historyTotal} total</span>
                  <div className="flex gap-2">
                    <button className="btn btn-neu btn-sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => Math.max(1, p - 1))}>‹ Prev</button>
                    <button className="btn btn-neu btn-sm" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(p => p + 1)}>Next ›</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
