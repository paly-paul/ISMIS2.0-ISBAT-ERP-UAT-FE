'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useAdvanceDeposits, AdvanceDepositSummary } from '@/hooks/finance/useAdvancePayment'
import { formatDate } from '@/lib/date'

interface AdvanceDepositPickerModalProps extends ModalProps {
  // Fires once for the row the cashier confirmed — the caller (Other
  // Payment's Advance Payment checkbox) owns what happens with it (filling
  // otherCurrencyGuid/otherAmount, storing paymentAdvanceGuid for submit).
  onConfirm: (advance: AdvanceDepositSummary) => void
  // The application currently loaded in Other Payment — always known once a
  // student is selected, studentGuid or not (see the 2026-09-08 rewrite
  // comment below).
  applicationGuid: string | null
  // Shown above the table in place of a Student column — this picker is
  // always scoped to one application, never a cross-student browse list.
  studentDisplayName?: string
  // get-advance-deposits.md's own originalAmount/balance/currencyCode are
  // confirmed live to be base-currency figures for every row (a deposit
  // made in 3,000,000 UGX comes back with originalAmount 810.81 and
  // currencyCode "USD") — there's no native-currency field on this endpoint
  // at all. This is the caller's own cross-reference, keyed by
  // paymentAdvanceGuid (== getPaymentHistory's paymentGuid for a category-5
  // row), so a deposit that wasn't made in the base currency can still show
  // what the cashier actually deposited instead of just its USD-equivalent.
  nativeAmounts?: Map<string, { amount: number; currencyName: string }>
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Picker for the Other Payment tab's Advance Payment checkbox — this
// application's own drawable deposits (get-advance-deposits.md), the exact
// same endpoint/hook Payment Console Adjustments' own Apply Advance dropdown
// already uses (useAdvanceDeposits). Rewritten 2026-09-08 to scope by
// applicationGuid instead of the earlier studentGuid-scoped
// get-payment-advances.md list (usePaymentAdvances): that endpoint has no
// result at all for an applicant who hasn't been converted into an enrolled
// student yet (no studentGuid), which meant the "has any deposits" check
// gating the checkbox (payment-console/page.tsx's hasAdvanceDeposits) never
// even fired for exactly the applicants who most need to draw down an
// advance before enrolling — the checkbox stayed hidden and this picker,
// had it opened, would have had nothing valid to scope by either.
// applicationGuid has no such gap; it's resolved the moment a student is
// loaded, same as every other tab on this page.
//
// One side effect of the switch: every row this endpoint returns is already
// guaranteed drawable — get-advance-deposits.md excludes fully-drawn
// deposits server-side, and a deposit can never be credited back once
// exhausted — so there's no more selectable/disabled state to compute (or a
// "Fully Drawn" status column to show) per row the way the old
// studentGuid-scoped, unfiltered-across-everyone list needed.
export function AdvanceDepositPickerModal({ isOpen, onClose, onConfirm, applicationGuid, studentDisplayName, nativeAmounts }: AdvanceDepositPickerModalProps) {
  const [selectedGuid, setSelectedGuid] = useState<string | null>(null)
  const { data: rows = [], isLoading, isError } = useAdvanceDeposits(applicationGuid, isOpen)
  const selected = rows.find(r => r.paymentAdvanceGuid === selectedGuid) ?? null

  function handleClose() {
    setSelectedGuid(null)
    onClose()
  }

  function handleConfirm() {
    if (!selected) return
    onConfirm(selected)
    setSelectedGuid(null)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      {/* maxHeight/overflow override .modal's own base 90vh-cap-plus-scroll —
          per request, this modal shouldn't scroll; the list is one
          application's own deposits, short enough to stay unpaged. */}
      <div className="modal modal-lg" style={{ maxHeight: 'none', overflow: 'visible' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-wallet"></i> Select Advance Deposit</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '14px 20px 0' }}>
          <div className="text-g500" style={{ fontSize: 12, marginBottom: 10 }}>
            Showing deposits for <strong className="text-g700">{studentDisplayName ?? 'this application'}</strong> — every deposit below still has an undrawn balance.
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Deposit Code</th><th>Deposit Date</th>
                  <th>Deposited</th><th>Cur.</th><th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <TableLoadingState colSpan={999} />
                ) : isError ? (
                  <tr><td colSpan={999} className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load advance deposits.</td></tr>
                ) : rows.length === 0 ? (
                  <EmptyState colSpan={999} title="No advance deposits" subtitle="This application has no drawable advance deposits on record." />
                ) : null}
                {!isLoading && !isError && rows.map(r => {
                  const isSelected = r.paymentAdvanceGuid === selectedGuid
                  const native = nativeAmounts?.get(r.paymentAdvanceGuid)
                  // Same fraction-of-original applies in either currency —
                  // no exchange rate needed to carry the remaining balance
                  // over to the native figure, just the ratio the
                  // base-currency pair already implies.
                  const nativeRemaining = native && r.originalAmount > 0 ? native.amount * (r.balance / r.originalAmount) : null
                  return (
                    <tr
                      key={r.paymentAdvanceGuid}
                      style={{ cursor: 'pointer', background: isSelected ? 'var(--b50)' : undefined }}
                      onClick={() => setSelectedGuid(r.paymentAdvanceGuid)}
                    >
                      <td>
                        <input
                          type="radio"
                          checked={isSelected}
                          onChange={() => setSelectedGuid(r.paymentAdvanceGuid)}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="font-mono text-blue" style={{ fontSize: 12 }}>{r.advPaymentCode}</td>
                      <td>{formatDate(r.payDate)}</td>
                      <td>
                        <span className="font-bold">{fmtAmount(native ? native.amount : r.originalAmount)}</span>
                        {native && (
                          <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
                            {fmtAmount(r.originalAmount)} {r.currencyCode}
                          </span>
                        )}
                      </td>
                      <td><span className="badge badge-gold">{native ? native.currencyName : r.currencyCode}</span></td>
                      <td>
                        <span className="font-bold text-amber">{fmtAmount(nativeRemaining ?? r.balance)}</span>
                        {native && (
                          <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
                            {fmtAmount(r.balance)} {r.currencyCode}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </ScrollTable>
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!selected} onClick={handleConfirm}>
            <i className="lni lni-checkmark"></i> Use This Deposit
          </button>
        </div>
      </div>
    </div>
  )
}
