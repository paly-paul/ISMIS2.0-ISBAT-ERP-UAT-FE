'use client'
import { useEffect } from 'react'
import { ModalProps } from '../types'
import type { PaymentHistoryListEntry } from '@/hooks/finance/usePaymentConsole'
import { formatDate } from '@/lib/date'

interface ViewPaymentReceiptModalProps extends ModalProps {
  entry: PaymentHistoryListEntry | null
  // Row's quick "Print" action opens straight into a print dialog instead
  // of making the user View then click Print again — set once per open,
  // consumed by the effect below.
  autoPrint?: boolean
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function ViewPaymentReceiptModal({ isOpen, onClose, entry, autoPrint }: ViewPaymentReceiptModalProps) {
  // Fires window.print() once the modal (and its .receipt-print-area, see
  // globals.css) has actually painted — a same-tick call right after
  // setState risks printing the pre-open DOM on some browsers.
  useEffect(() => {
    if (!isOpen || !autoPrint) return
    const t = setTimeout(() => window.print(), 120)
    return () => clearTimeout(t)
  }, [isOpen, autoPrint])

  if (!isOpen || !entry) return null

  // rate is null whenever currencyCode is already the base currency (no
  // conversion applied) — same shape confirmed on getPaymentHistoryList's
  // PaymentHistoryListEntry.rate. Only show the conversion rows when there
  // actually was one.
  const showConversion = entry.rate != null

  return (
    <div className="modal-overlay open" onClick={onClose}>
      {/* Sticky header + sticky footer, scrollable middle — same pattern
          .modal-flex uses elsewhere, but sized to content (up to 90vh)
          rather than a fixed 85vh, since a receipt is short. Without this,
          .modal's own max-height:90vh/overflow-y:auto (globals.css) scrolls
          the WHOLE modal as one block — on a short viewport the header and
          Close/Print buttons scroll out of view along with the receipt
          instead of staying reachable. overflow:hidden inline overrides
          the class's overflow-y:auto so only the middle section scrolls.

          width: min(94vw, 520px) instead of .modal-sm's flat
          max-width:420px — that class shrinks fine on small screens but
          never grows past 420px, so on a large monitor the modal reads as
          a tiny box lost in the middle of the window (confirmed live,
          full-HD screenshot). This scales continuously with the viewport
          up to a comfortable cap for a receipt-width document, instead of
          jumping between fixed size steps.

          minWidth: 0 — without it, a flex child (this div, inside
          .modal-overlay's display:flex) can't shrink below its content's
          natural min-content width, even though width: min(94vw, …) asks
          it to. The long unbroken payment-ref GUID below was exactly that
          content, forcing the modal wider than a narrow viewport and
          pushing it off the right edge instead of shrinking to fit
          (confirmed live at 448px). Same fix this codebase already uses
          for flex children elsewhere in globals.css. */}
      <div className="modal" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: 'min(94vw, 520px)', minWidth: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue no-print" style={{ flexShrink: 0 }}>
          <div className="modal-title"><i className="lni lni-eye"></i> Receipt {entry.receiptNo}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {/* wordBreak so the 36-char payment-ref GUID (and anything else
              long) wraps instead of setting the container's min-content
              width — belt-and-braces alongside the modal's own minWidth:0
              above, not a substitute for it. */}
          <div className="receipt-print-area border border-g200 rounded-xl p-5 bg-g50" style={{ wordBreak: 'break-word' }}>
            <div className="text-center mb-4 pb-3 border-b border-g200">
              <h3 className="font-bold text-g900" style={{ fontSize: 'var(--fs-lg)' }}>ISBAT University</h3>
              <p className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>Institute of Skill Development And Training</p>
              <p className="text-g400" style={{ fontSize: 11 }}><i className="lni lni-map-marker"></i> Kampala, Uganda · erp.isbatuniversity.ac.ug</p>
              <div className="font-mono font-bold text-blue mt-2" style={{ fontSize: 14 }}>{entry.receiptNo}</div>
              <div className="text-g400 uppercase font-bold mt-1" style={{ fontSize: 10, letterSpacing: '.06em' }}>Official Fee Payment Receipt</div>
            </div>
            <div className="receipt-row"><span className="text-muted">Student Name</span><span className="font-bold">{entry.studentName ?? '—'}</span></div>
            <div className="receipt-row"><span className="text-muted">Student No.</span><span className="font-mono text-blue">{entry.studentNo ?? '—'}</span></div>
            <div className="receipt-row"><span className="text-muted">Programme</span><span>{entry.programName ?? '—'}</span></div>
            <div className="receipt-row"><span className="text-muted">Fee Type</span><span>{entry.feeType}</span></div>
            <div className="receipt-row"><span className="text-muted">Payment Method</span><span>{entry.payType?.name ?? '—'}</span></div>
            <div className="receipt-row"><span className="text-muted">Date</span><span>{formatDate(entry.payDate)}</span></div>
            <div className="receipt-row"><span className="text-muted">Amount Paid</span><span className="font-bold">{fmtAmount(entry.amount)} {entry.currencyCode}</span></div>
            {showConversion && (
              <>
                <div className="receipt-row"><span className="text-muted">Exchange Rate</span><span>{fmtAmount(entry.rate as number)}</span></div>
                <div className="receipt-row"><span className="text-muted">UGX Value</span><span className="font-bold">{fmtAmount(entry.ugxValue)}</span></div>
              </>
            )}
            <div className="text-center text-g400 mt-3 pt-3 border-t border-dashed border-g300" style={{ fontSize: 10 }}>
              Received by: Finance Office · ISBAT University<br />
              Reprinted receipt · Payment ref: <span className="font-mono">{entry.paymentGuid}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ flexShrink: 0 }}>
          <button className="btn btn-neu flex-1 justify-center" onClick={onClose}>Close</button>
          <button className="btn btn-primary flex-1 justify-center" onClick={() => window.print()}>
            <i className="lni lni-printer"></i> Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}
