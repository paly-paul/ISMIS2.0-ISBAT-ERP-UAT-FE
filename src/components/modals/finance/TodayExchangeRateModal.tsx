'use client'
import { useEffect, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { useCreateExchangeRate, useExchangeRateExists } from '@/hooks/finance/useExchangeRates'

// Enter today's rate for a currency that has none on file — POST
// /exchange-rates (exRate = base units per 1 unit of the currency, e.g.
// 1 USD = 3774.90 UGX). The currency is picked here; the picked one is
// checked with GET /exchange-rates/exists first, since POST rejects a
// duplicate (currency, date). Like every modal here, only Cancel / ✕ close it.
interface Props {
  isOpen: boolean
  onClose: () => void
  currencies: { currencyGuid: string; currencyCode: string }[] // non-base currencies
  initialCurrencyGuid?: string
  baseCode: string
  date: string // yyyy-mm-dd
  onSaved: (currencyCode: string, exRate: number) => void
}

const fmtRate = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function TodayExchangeRateModal({ isOpen, onClose, currencies, initialCurrencyGuid, baseCode, date, onSaved }: Props) {
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const create = useCreateExchangeRate()
  const existing = useExchangeRateExists(currencyGuid || null, date, isOpen)

  useEffect(() => {
    if (!isOpen) return
    setCurrencyGuid(initialCurrencyGuid ?? currencies[0]?.currencyGuid ?? '')
    setValue(''); setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  const currencyCode = currencies.find(c => c.currencyGuid === currencyGuid)?.currencyCode ?? ''
  const alreadySet = !!existing.data?.exists
  const checking = !!currencyGuid && existing.isLoading
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  function handleSave() {
    if (!currencyGuid) { setError('Select a currency.'); return }
    if (alreadySet) return
    const rate = Number(value)
    if (!value.trim() || !(rate > 0)) { setError(`Enter how many ${baseCode} make 1 ${currencyCode}.`); return }
    setError('')
    create.mutate(
      { currencyGuid, exRate: rate, exDate: date },
      {
        onSuccess: () => onSaved(currencyCode, rate),
        onError: (e: Error) => setError(e.message || 'Could not save the exchange rate.'),
      },
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-protection"></i> Enter Today&apos;s Exchange Rate</div>
          <button className="modal-close" onClick={onClose} disabled={create.isPending} aria-label="Close"><i className="lni lni-close"></i></button>
        </div>

        {/* One body wrapper: .modal pads each direct child div, so the
            callout and fields live inside it and share one rhythm. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="info-box" style={{ borderRadius: 'var(--rxs)', alignItems: 'center' }}>
            <i className="lni lni-calendar" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
            <div style={{ fontSize: 12.5, color: 'var(--g700)' }}>
              Rates are entered once per day — this one is for <strong className="text-g900">{dateLabel}</strong> and is shared with everyone.
            </div>
          </div>

          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="lbl">Currency <span className="req">*</span></label>
            <SearchSelect
              placeholder="— Select Currency —"
              options={currencies.map(c => ({ value: c.currencyGuid, label: c.currencyCode }))}
              value={currencyGuid}
              onChange={v => { setCurrencyGuid(v); setValue(''); setError('') }}
              disabled={create.isPending}
            />
          </div>

          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="lbl" htmlFor="today-rate-input">Today&apos;s rate <span className="req">*</span></label>
            {checking ? (
              <div className="ctrl-group" aria-busy="true">
                <span className="ctrl-addon">1 {currencyCode} =</span>
                <span className="ctrl text-g400" style={{ display: 'flex', alignItems: 'center' }}>Checking…</span>
                <span className="ctrl-addon">{baseCode}</span>
              </div>
            ) : alreadySet ? (
              // POST would reject a duplicate — show what's on file instead of an input.
              <div className="success-box" style={{ alignItems: 'center' }}>
                <i className="lni lni-checkmark-circle" style={{ color: 'var(--green)', fontSize: 16, flexShrink: 0 }}></i>
                <div style={{ fontSize: 12.5, color: 'var(--g700)', lineHeight: 1.5 }}>
                  <div className="text-g900" style={{ fontWeight: 700, fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
                    1 {currencyCode} = {fmtRate(existing.data?.exRate ?? 0)} {baseCode}
                  </div>
                  Already set for today. To change it, use Finance → Exchange Rates.
                </div>
              </div>
            ) : (
              <>
                <div className={`ctrl-group${error ? ' has-error' : ''}`}>
                  <span className="ctrl-addon">1 {currencyCode || '—'} =</span>
                  <input
                    id="today-rate-input"
                    className="ctrl text-right font-semibold"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={value}
                    autoFocus
                    disabled={!currencyGuid || create.isPending}
                    onChange={e => { setValue(e.target.value); setError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                  />
                  <span className="ctrl-addon">{baseCode}</span>
                </div>
                {!error && <p className="text-g500" style={{ fontSize: 11.5, marginTop: 6 }}>How many {baseCode} make 1 {currencyCode || 'unit'}.</p>}
              </>
            )}
            {existing.isError && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>Couldn&apos;t check today&apos;s {currencyCode} rate. Close and try again.</p>}
            {error && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={onClose} disabled={create.isPending}>{alreadySet ? 'Close' : 'Cancel'}</button>
          {!alreadySet && (
            <button className="btn btn-primary" onClick={handleSave} disabled={create.isPending || !currencyGuid || checking || existing.isError}>
              <i className="lni lni-checkmark"></i> {create.isPending ? 'Saving…' : 'Save Rate'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
