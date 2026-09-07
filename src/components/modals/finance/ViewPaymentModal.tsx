'use client'
import { ModalProps } from '../types'
import { formatDate } from '@/lib/date'
import { usePaidLedgersByPayment, PaymentHistoryEntry } from '@/hooks/finance/usePaymentConsole'

interface ViewPaymentModalProps extends ModalProps {
  entry: PaymentHistoryEntry | null
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Read-only detail view for one row of Payment Console's own Tuition
// history table — deliberately plain (no receipt letterhead/print, unlike
// the standalone Payment History page's ViewPaymentReceiptModal) since the
// student/programme context is already on screen above the table this
// opens from; repeating it here would be redundant. Backs that table's
// View action alongside EditPaymentModal's Edit, both added together per
// get-payments.md/put-payment.md.
//
// The Paid Ledgers section (get-paid-ledgers-by-payment.md) is the receipt
// detail view — what this payment's money was actually applied to, ledger
// by ledger — fetched fresh each time this opens rather than carried on the
// row itself. Every row this modal is ever opened from is already a
// category-1 (Tuition) payment, per the table it backs, so no 404 from a
// non-tuition GUID is expected here.
export function ViewPaymentModal({ isOpen, onClose, entry }: ViewPaymentModalProps) {
  const { data: paidLedgers = [], isLoading, isError } = usePaidLedgersByPayment(entry?.paymentGuid ?? null, isOpen && !!entry)

  if (!isOpen || !entry) return null

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> Payment — {entry.paymentCode}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="receipt-row"><span className="text-muted">Payment Code</span><span className="font-bold font-mono">{entry.paymentCode}</span></div>
          <div className="receipt-row"><span className="text-muted">Receipt</span><span className="font-bold font-mono">{entry.receipt ?? '—'}</span></div>
          <div className="receipt-row"><span className="text-muted">Amount</span><span className="font-bold">{entry.currencyName} {fmtAmount(entry.amount)}</span></div>
          <div className="receipt-row"><span className="text-muted">Payment Date</span><span className="font-bold">{formatDate(entry.payDate)}</span></div>
          <div className="receipt-row"><span className="text-muted">Payment Type</span><span className="font-bold">{entry.payType?.name ?? '—'}</span></div>
          <div className="receipt-row"><span className="text-muted">Receipt Book</span><span className="font-bold">{entry.bookCode ?? '—'}</span></div>

          <div className="sec-divider" style={{ marginTop: 16 }}><i className="lni lni-list"></i> Paid Ledgers</div>
          {isLoading ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading paid ledgers…</div>
          ) : isError ? (
            <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load the paid-ledger breakdown.</div>
          ) : paidLedgers.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No ledger breakdown found for this payment.</div>
          ) : (
            // Same .receipt-row treatment as the payment details above,
            // rather than a table — this is a receipt's line items, not a
            // data grid. Semester rides along under the ledger name (same
            // "sub-label" convention Payment Console's own pc-ledger-sub
            // uses) since there's no separate column to put it in here.
            paidLedgers.map((l, i) => (
              <div className="receipt-row" key={`${l.ledgerGuid}-${i}`}>
                <span className="text-muted">
                  {l.discountGuid ? `${l.ledgerName} (Discount${l.discountName ? `: ${l.discountName}` : ''})` : l.ledgerName}
                  {l.semName && <><br /><span style={{ fontSize: 11 }}>{l.semName}</span></>}
                </span>
                <span className={l.discountGuid ? 'font-bold text-red' : 'font-bold'}>{l.currencyName} {fmtAmount(l.amount)}</span>
              </div>
            ))
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary flex-1 justify-center" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
