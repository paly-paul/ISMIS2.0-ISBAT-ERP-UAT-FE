'use client'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import type { PaymentHistoryEntry } from '@/hooks/finance/usePaymentConsole'
import { PAYMENT_CATEGORY_LABELS } from '@/hooks/finance/usePaymentConsole'

interface PaymentHistoryModalProps extends ModalProps {
  entries: PaymentHistoryEntry[]
  isLoading: boolean
  isError: boolean
}

// Moved out of Step 2's own inline accordion into a modal, opened from a
// button next to the Student Profile Details label — same data/hook
// (usePaymentHistory), just relocated so it's reachable the moment a
// student is picked rather than only after scrolling into Column 2.
export function PaymentHistoryModal({ isOpen, onClose, entries, isLoading, isError }: PaymentHistoryModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-lg" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ flexShrink: 0 }}>
          <div className="modal-title"><i className="lni lni-folder"></i> Payment History</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {isLoading ? (
            <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Loading payment history…</div>
          ) : isError ? (
            <div className="text-clr-red text-center" style={{ padding: 24, fontSize: 12.5 }}>
              <i className="lni lni-warning"></i> Couldn&apos;t load payment history. Please try again.
            </div>
          ) : entries.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>No payment history for this application.</div>
          ) : (
            <ScrollTable className="no-sticky-col">
              <table>
                <thead><tr><th>Date</th><th>Category</th><th>Amount Paid</th><th>Method</th><th>Receipt #</th></tr></thead>
                <tbody>
                  {entries.map(h => (
                    <tr key={h.paymentGuid}>
                      <td>{h.payDate.slice(0, 10)}</td>
                      <td>{PAYMENT_CATEGORY_LABELS[h.category] ?? `Category ${h.category}`}</td>
                      <td className="text-green font-bold">{h.currencyName ?? ''} {h.amount.toLocaleString()}</td>
                      <td><span className="pill pill-blue">{h.payType?.name ?? '—'}</span></td>
                      <td className="font-mono text-blue">{h.receipt ?? h.paymentCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn btn-neu flex-1 justify-center" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
