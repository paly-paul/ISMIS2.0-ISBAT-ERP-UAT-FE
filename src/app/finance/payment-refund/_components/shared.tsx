'use client'
import { useEffect, useState } from 'react'
import { stripLeadingZeros } from '@/lib/errorMessages'
import { ScrollTable } from '@/components/ScrollTable'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import {
  useCreateRefund,
  useLedgerDetailsBatch,
  useRefundsByApplication,
  useTotalPaid,
} from '@/hooks/finance/usePaymentRefund'
import { useFinanceCurrencies, getDefaultFinanceCurrencyGuid } from '@/hooks/finance/useFinanceCurrencies'
import { formatDate } from '@/lib/date'
import { AuthError } from '@/lib/api/client'
import { mockCreateRefund, mockGetLedgerDetailsBatch, mockGetRefundsByApplication, mockGetTotalPaid } from './mockData'

// Shared by the Rejected-by-Registrar and Fake-Certificate-Termination tabs
// — both refund a single application against one line of its own main
// ledger (get-ledger-details-batch.md), one candidate at a time. The
// Passout/Library-Deposit tab does NOT use this — it refunds Other-Payments
// ledger lines in bulk, across possibly several students at once, which
// doesn't fit a "pick one line, fill one form" shape.

export function fmtAmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

export function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

interface RefundLedgerPickerProps {
  applicationGuid: string
  studentGuid: string | null
  showToast: (msg: string, type?: string) => void
  onRefunded: (rows: [string, string][]) => void
  permissionsCreate: boolean
  // Dev-only "Mock Data" toggle (page.tsx) — see mockData.ts's own header
  // comment. Real hooks below stay mounted with `enabled: !useMock` (rules
  // of hooks — can't call them conditionally) so toggling mid-session just
  // swaps which result feeds the UI, no remount needed.
  useMock?: boolean
}

export function RefundLedgerPicker({ applicationGuid, studentGuid, showToast, onRefunded, permissionsCreate, useMock = false }: RefundLedgerPickerProps) {
  const { data: linesByApplication, isLoading: isLinesLoadingReal, isError: isLinesError } = useLedgerDetailsBatch([applicationGuid], undefined, !useMock)
  const lines = useMock ? (mockGetLedgerDetailsBatch([applicationGuid])[applicationGuid] ?? []) : (linesByApplication?.[applicationGuid] ?? [])
  const isLinesLoading = useMock ? false : isLinesLoadingReal

  const {
    data: refundHistoryReal = [], isLoading: isRefundHistoryLoadingReal, isError: isRefundHistoryError,
  } = useRefundsByApplication(applicationGuid, !useMock)
  const refundHistory = useMock ? mockGetRefundsByApplication(applicationGuid) : refundHistoryReal
  const isRefundHistoryLoading = useMock ? false : isRefundHistoryLoadingReal

  const [ledgerGuid, setLedgerGuid] = useState('')
  const selectedLine = lines.find(l => l.ledgerGuid === ledgerGuid)

  const { data: totalPaidReal } = useTotalPaid(applicationGuid, ledgerGuid || null, !useMock && !!ledgerGuid)
  const totalPaid = useMock ? (ledgerGuid ? mockGetTotalPaid(applicationGuid, ledgerGuid) : null) : totalPaidReal

  const { data: currencies = [] } = useFinanceCurrencies(true)
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDate, setRefundDate] = useState(todayYmd)
  const [remarks, setRemarks] = useState('')

  // Reset the form whenever the candidate changes (new applicationGuid) —
  // this component is remounted per selection by its parent's `key`, but
  // guard here too in case that ever stops being true.
  useEffect(() => {
    setLedgerGuid('')
    setRefundAmount('')
    setRefundDate(todayYmd())
    setRemarks('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationGuid])

  // Prefill amount/currency once a ledger is picked. A refund is scoped to
  // the whole ledger, not the one payment line clicked — `ledgerGuid` here
  // is a shared ledger-definition guid, the same across every semester's
  // payment into it (see post-ledger-details-batch.md), and post-refund.md
  // validates the amount against SUM(AMTDEF) across every payment/semester
  // for that ledger, not just one line. So prefill from `totalPaid` (the
  // server's own authoritative sum for this exact applicationGuid+
  // ledgerGuid pair — get-total-paid.md) once it's loaded, falling back to
  // the clicked line's own amount only as an optimistic placeholder while
  // that fetch is still in flight. Still freely editable either way.
  useEffect(() => {
    if (!ledgerGuid) return
    if (totalPaid) {
      setCurrencyGuid(totalPaid.currencyGuid)
      setRefundAmount(String(totalPaid.amount))
    } else if (selectedLine) {
      setCurrencyGuid(selectedLine.currencyGuid)
      setRefundAmount(String(selectedLine.amount))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerGuid, totalPaid])

  useEffect(() => {
    if (!currencyGuid && currencies.length > 0) setCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencies])

  const createRefund = useCreateRefund()
  const selectedCurrency = currencies.find(c => c.currencyGuid === currencyGuid)

  // mockGetLedgerDetailsBatch/mockGetRefundsByApplication read a plain
  // module-level object, not React state — bump this after a mock submit to
  // force the recompute above to pick up the change (mockCreateRefund's own
  // in-place mutation of that store).
  const [, forceMockRefresh] = useState(0)

  // Refund History as a popup (2026-09-15) — same modal-overlay/modal-lg
  // shell, and the same "moved off a permanent card into a button on the
  // profile/eligible-payments card" move, as Payment Console's own Payment
  // History button (payment-console/page.tsx's showPaymentHistory).
  const [showHistory, setShowHistory] = useState(false)

  function resetForm() {
    setLedgerGuid('')
    setRefundAmount('')
    setRefundDate(todayYmd())
    setRemarks('')
  }

  function handleSubmit() {
    if (!permissionsCreate) { showToast('You do not have permission to create refunds.', 'warn'); return }
    if (!selectedLine) { showToast('Please select a ledger line to refund.', 'warn'); return }
    if (!currencyGuid) { showToast('Please select a currency.', 'warn'); return }
    const amt = parseFloat(refundAmount)
    if (!refundAmount.trim() || isNaN(amt) || amt <= 0) { showToast('Refund amount must be greater than 0.', 'warn'); return }
    if (totalPaid && currencyGuid === totalPaid.currencyGuid && amt > totalPaid.amount) {
      showToast(`Refund amount exceeds the total paid into this ledger (${fmtAmt(totalPaid.amount)}).`, 'warn')
      return
    }
    if (!refundDate) { showToast('Please select a refund date.', 'warn'); return }

    const input = {
      ledgerGuid: selectedLine.ledgerGuid,
      currencyGuid,
      amount: amt,
      refundDate,
      studentGuid,
      remarks: remarks.trim() || null,
    }
    const onSuccess = () => {
      onRefunded([
        ['Ledger', selectedLine.ledgerName],
        ['Amount', `${selectedCurrency?.currencyName ?? ''} ${fmtAmt(amt)}`.trim()],
        ['Refund Date', formatDate(refundDate)],
      ])
      resetForm()
    }

    if (useMock) {
      mockCreateRefund(applicationGuid, input).then(() => {
        forceMockRefresh(n => n + 1)
        onSuccess()
      })
      return
    }

    createRefund.mutate(
      { applicationGuid, input },
      {
        onSuccess,
        onError: (error: Error) => {
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to record refund. Please try again.'), 'error')
        },
      },
    )
  }

  return (
    <>
      {/* .pc-tuition-split — same left-card/right-card two-column body as
          Payment Console's Semester Payment tab (Outstanding Balance +
          Payment Detail), in place of the plain stacked-cards column this
          used before. */}
      <div className="pc-tuition-split">
        <div className="card flex flex-col gap-4 min-w-0">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-wallet"></i></span> Eligible Payments</div>
            {/* Refund History — moved off its own permanent card into a
                popup (2026-09-15), same move as Payment Console's own
                Payment History button. */}
            <button type="button" className="pc-hero-action" onClick={() => setShowHistory(true)}>
              <i className="lni lni-folder"></i>
              <span>Refund History</span>
              {refundHistory.length > 0 && <strong>{refundHistory.length}</strong>}
            </button>
          </div>

          {isLinesLoading ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading unrefunded payments…</div>
          ) : isLinesError ? (
            <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load payment ledger lines.</div>
          ) : lines.length === 0 ? (
            <div className="card text-center" style={{ padding: 24 }}>
              <div className="pc-receipt-check" style={{ fontSize: 22 }}><i className="lni lni-checkmark-circle"></i></div>
              <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Nothing to refund</div>
              <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>No unrefunded ledger payments found for this application.</div>
            </div>
          ) : (
            <div className="recgrid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr 1.2fr' }}>
              <div className="recgrid-row recgrid-hdr">
                <span>Ledger</span>
                <span>Amount</span>
                <span>Pay Date</span>
                <span>Receipt</span>
              </div>
              {lines.map((l, i) => {
                const isSelected = ledgerGuid === l.ledgerGuid
                return (
                  // ledgerGuid is a shared ledger-definition guid, not a
                  // per-payment id — multiple rows (e.g. Tuition Fee across
                  // several semesters) share the same one, so it alone
                  // can't key these rows uniquely.
                  <div
                    key={`${l.ledgerGuid}-${l.receipt}-${i}`}
                    className="recgrid-row recgrid-body cursor-pointer"
                    style={isSelected ? { background: 'var(--b50)' } : undefined}
                    onClick={() => setLedgerGuid(l.ledgerGuid)}
                  >
                    <span style={{ textAlign: 'left' }}>
                      {l.ledgerName}
                      {isSelected && <span className="text-blue" style={{ fontSize: 11, fontWeight: 600, marginLeft: 6 }}>Selected</span>}
                    </span>
                    <span className="font-bold">{l.currencyCode} {fmtAmt(l.amount)}</span>
                    <span>{formatDate(l.payDate)}</span>
                    <span>{l.receipt}{l.receiptBookCode ? ` (${l.receiptBookCode})` : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-reload"></i></span> Payment Detail</div>
          </div>

          {/* A refund is scoped to the whole ledger, not the one payment
              line clicked on the left (see the useEffect above) — this
              spells that out, since multiple highlighted rows there
              otherwise looks like unexplained multi-select. */}
          {selectedLine && (
            <div className="info-box mb-[14px]">
              <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
              <div style={{ fontSize: 12.5 }}>
                Covers every unrefunded &quot;{selectedLine.ledgerName}&quot; payment for this application
                {lines.filter(l => l.ledgerGuid === ledgerGuid).length > 1 ? ` (${lines.filter(l => l.ledgerGuid === ledgerGuid).length} payments, highlighted on the left)` : ''} — a ledger can only be refunded once, ever.
              </div>
            </div>
          )}

          <div className="g2 mb-[14px]">
            <div className="fg">
              <div className="lbl">Refund Amount <span className="req">*</span></div>
              <input
                className="ctrl"
                type="number"
                placeholder="0.00"
                value={refundAmount}
                onChange={e => setRefundAmount(stripLeadingZeros(e.target.value))}
                disabled={!selectedLine}
              />
            </div>
            <div className="fg">
              <div className="lbl">Currency <span className="req">*</span></div>
              <SearchSelect
                placeholder="— Select currency —"
                options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                value={currencyGuid}
                onChange={setCurrencyGuid}
                disabled={!selectedLine}
              />
            </div>
          </div>

          <div className="g2 mb-[14px]">
            <div className="fg">
              <div className="lbl">Refund Date <span className="req">*</span></div>
              <DatePicker value={refundDate} onChange={setRefundDate} />
            </div>
            <div className="fg">
              <div className="lbl">Remarks</div>
              <textarea className="ctrl" rows={1} placeholder="Reason for this refund" value={remarks} onChange={e => setRemarks(e.target.value)} disabled={!selectedLine} />
            </div>
          </div>

          <div className="flex gap-[10px] justify-end flex-wrap">
            <button className="btn btn-neu" onClick={resetForm}><i className="lni lni-close"></i> Cancel</button>
            <button className="btn btn-primary btn-lg" disabled={createRefund.isPending || !permissionsCreate || !selectedLine} onClick={handleSubmit}>
              <i className="lni lni-checkmark"></i> {createRefund.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="modal-overlay open">
          <div className="modal modal-lg" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue" style={{ flexShrink: 0 }}>
              <div className="modal-title"><i className="lni lni-folder"></i> Refund History</div>
              <button className="modal-close" onClick={() => setShowHistory(false)}><i className="lni lni-close"></i></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
              {isRefundHistoryLoading ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading refund history…</div>
              ) : isRefundHistoryError ? (
                <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load refund history.</div>
              ) : refundHistory.length === 0 ? (
                <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No records found.</div>
              ) : (
                <ScrollTable className="no-sticky-col">
                  <table>
                    <thead><tr><th>Ledger</th><th>Amount</th><th>Currency</th><th>Refund Date</th><th>Remarks</th></tr></thead>
                    <tbody>
                      {refundHistory.map(r => (
                        <tr key={r.refundGuid}>
                          <td>{r.ledgerName}</td>
                          <td className="text-green font-bold">{fmtAmt(r.amount)}</td>
                          <td>{r.currencyName}</td>
                          <td>{formatDate(r.refundDate)}</td>
                          <td>{r.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
              )}
            </div>
            <div className="modal-footer" style={{ flexShrink: 0 }}>
              <button className="btn btn-neu flex-1 justify-center" onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
