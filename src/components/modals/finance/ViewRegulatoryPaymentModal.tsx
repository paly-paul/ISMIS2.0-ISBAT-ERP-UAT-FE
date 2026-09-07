'use client'
import { ModalProps } from '../types'
import { formatDate } from '@/lib/date'
import type { PaymentCategory, RegulatoryPaymentHistoryEntry } from '@/hooks/finance/useNcheGuildPayment'

interface ViewRegulatoryPaymentModalProps extends ModalProps {
  entry: RegulatoryPaymentHistoryEntry | null
  category: PaymentCategory
}

const CATEGORY_LABEL: Record<PaymentCategory, string> = { nche: 'NCHE', guild: 'Guild' }

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Read-only detail view for one row of the NCHE/Guild history table — same
// plain .receipt-row treatment as Payment Console's own ViewPaymentModal,
// no receipt letterhead/print since the student/programme context is
// already on screen above the table this opens from. Category-specific
// fields (PNR Number/Remarks for NCHE, Bank Deposit/Receipt for Guild) come
// straight off RegulatoryPaymentHistoryEntry's own union shape — the ones
// that don't apply to the active category are simply absent on the row.
export function ViewRegulatoryPaymentModal({ isOpen, onClose, entry, category }: ViewRegulatoryPaymentModalProps) {
  if (!isOpen || !entry) return null

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> {CATEGORY_LABEL[category]} Payment</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>
        <div style={{ padding: 20 }}>
          <div className="receipt-row"><span className="text-muted">Amount</span><span className="font-bold">{fmtAmount(entry.amount)}</span></div>
          <div className="receipt-row"><span className="text-muted">Payment Date</span><span className="font-bold">{formatDate(entry.payDate)}</span></div>
          {category === 'nche' ? (
            <>
              <div className="receipt-row"><span className="text-muted">PNR Number</span><span className="font-bold font-mono">{entry.pnrNumber ?? '—'}</span></div>
              <div className="receipt-row"><span className="text-muted">Remarks</span><span className="font-bold">{entry.remarks ?? '—'}</span></div>
            </>
          ) : (
            <>
              <div className="receipt-row"><span className="text-muted">Bank Deposit</span><span className="font-bold">{entry.bankDeposit ?? '—'}</span></div>
              <div className="receipt-row"><span className="text-muted">Receipt</span><span className="font-bold font-mono">{entry.receipt ?? '—'}</span></div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary flex-1 justify-center" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
