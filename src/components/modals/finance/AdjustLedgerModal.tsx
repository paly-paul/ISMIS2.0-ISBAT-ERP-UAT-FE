'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'

export interface AdjustLedgerTarget {
  semester: string
  feeType: string
  originalAmount: string
  currency: 'USD' | 'UGX'
}

interface AdjustLedgerModalProps extends ModalProps {
  target: AdjustLedgerTarget | null
}

// Still-mock feature — there's no backing "ledger adjustment" endpoint in the
// API spec yet, so this only ever logs a toast, same as the reference design.
// Every adjustment is meant to be treated as an authorised, audited override,
// which is why Save uses btn-danger rather than the usual btn-primary.
export function AdjustLedgerModal({ isOpen, onClose, showToast, target }: AdjustLedgerModalProps) {
  const [newAmount, setNewAmount] = useState('')
  const [currency, setCurrency] = useState<'USD' | 'UGX'>('USD')
  const [justification, setJustification] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen && target) {
      setNewAmount('')
      setCurrency(target.currency)
      setJustification('')
      setErrors({})
    }
  }, [isOpen, target])

  if (!isOpen || !target) return null

  function handleClose() { setErrors({}); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!newAmount.trim()) e.newAmount = 'New amount is required'
    if (!justification.trim()) e.justification = 'Justification is required for the audit trail'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    showToast('Ledger adjusted. Audit trail updated.', 'warn')
    handleClose()
  }

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-pencil-alt"></i> Adjust Ledger Entry</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div>
          <div className="g2">
            <div className="fg">
              <div className="lbl">Fee Type</div>
              <input className="ctrl" value={`${target.feeType} — ${target.semester}`} readOnly style={{ background: 'var(--g100)' }} />
            </div>
            <div className="fg">
              <div className="lbl">Original Amount</div>
              <input className="ctrl" value={`${target.currency} ${target.originalAmount}`} readOnly style={{ background: 'var(--g100)' }} />
            </div>
            <div className="fg">
              <div className="lbl">Adjust To <span className="req">*</span></div>
              <input
                className="ctrl" type="number" placeholder="New amount"
                value={newAmount}
                onChange={e => { setNewAmount(e.target.value); if (errors.newAmount) setErrors(p => ({ ...p, newAmount: '' })) }}
                style={errors.newAmount ? { borderColor: 'var(--red)' } : undefined}
              />
              {errors.newAmount && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.newAmount}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Currency</div>
              <select className="ctrl" value={currency} onChange={e => setCurrency(e.target.value as 'USD' | 'UGX')}>
                <option value="USD">USD</option>
                <option value="UGX">UGX</option>
              </select>
            </div>
            <div className="fg span2">
              <div className="lbl">Justification <span className="req">*</span></div>
              <textarea
                className="ctrl" rows={3} placeholder="Provide a detailed reason. Mandatory for audit trail."
                value={justification}
                onChange={e => { setJustification(e.target.value); if (errors.justification) setErrors(p => ({ ...p, justification: '' })) }}
                style={errors.justification ? { borderColor: 'var(--red)' } : undefined}
              />
              {errors.justification && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.justification}</p>}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleSave}>
            <i className="lni lni-checkmark"></i> Save Adjustment
          </button>
        </div>
      </div>
    </div>
  )
}
