'use client'
import { ModalProps } from '../types'

interface PaymentSuccessModalProps extends ModalProps {
  title: string
  // Label → value rows, rendered in order — e.g. [["Receipt", "RCP-..."],
  // ["Amount", "UGX 50,000"], ["Remaining Balance", "40,000"]]. Kept as a
  // simple list rather than a category-specific shape so one modal serves
  // Tuition/NCHE/Guild (and later Other) without a switch on category here.
  rows: [string, string][]
  // Secondary notices — advanceMessage/reRegistrationWarning on Tuition,
  // shown same as the receipt card's own info-box treatment. Optional;
  // NCHE/Guild have none of these.
  notices?: string[]
  // Optional second button beside OK — e.g. "View Student Statement" so the
  // user can go straight to the student's updated payment details.
  secondaryAction?: { label: string; icon: string; onClick: () => void }
}

// Success confirmation for every payment category's submit — replaces the
// plain success toast (errors stay as toast; see handleSave/ncheSubmit/
// guildSubmit's own onError). Tuition's printable receipt card in Column 3
// is unchanged by this — this modal is the immediate "it worked" moment,
// the card underneath is the lasting/printable record.
export function PaymentSuccessModal({ isOpen, onClose, title, rows, notices, secondaryAction }: PaymentSuccessModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay open">
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr" style={{ background: 'var(--green-bg)' }}>
          <div className="modal-title"><i className="lni lni-checkmark-circle" style={{ color: 'var(--green)' }}></i> {title}</div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: 20 }}>
          {rows.map(([label, value]) => (
            <div key={label} className="receipt-row"><span className="text-muted">{label}</span><span className="font-bold">{value}</span></div>
          ))}
          {notices?.map(n => (
            <div key={n} className="mt-2"><div className="info-box"><i className="lni lni-information"></i> {n}</div></div>
          ))}
        </div>

        <div className="modal-footer">
          {secondaryAction && (
            <button className="btn btn-neu flex-1 justify-center" onClick={secondaryAction.onClick}>
              <i className={`lni ${secondaryAction.icon}`}></i> {secondaryAction.label}
            </button>
          )}
          <button className="btn btn-primary flex-1 justify-center" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
