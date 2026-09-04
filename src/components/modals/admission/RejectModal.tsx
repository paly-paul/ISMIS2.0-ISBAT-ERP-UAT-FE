'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { VetApplicationInput } from '@/lib/api/admission/vetting'

interface Props extends ModalProps {
  applicationGuid: string | null
  vetApplication: {
    mutate: (variables: { applicationGuid: string; input: VetApplicationInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

// Brought in line with the rest of the app's real-hook-layer modal
// convention (SuccessPopup/FailurePopup) — this used to just toast on both
// success and failure, unlike VettingReviewModal's own Approve action right
// next to it in the same workflow.
export function RejectModal({ isOpen, onClose, showToast, applicationGuid, vetApplication }: Props) {
  const [reason, setReason]   = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!isOpen) return null

  function handleClose() { setReason(''); setRemarks(''); setErrors({}); setSaved(false); setFailure(null); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!reason)          e.reason  = 'Please select a Rejection Reason'
    if (!remarks.trim())  e.remarks = 'Detailed Remarks are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleConfirm() {
    if (!applicationGuid || !validate()) return
    // The API only has one free-text justificationReg field (required on
    // reject) — no separate structured "reason" column, so the canned
    // reason and the free-text remarks are combined into it.
    vetApplication.mutate(
      // action: 3 = Rejected — RegistrarDecision now matches the persisted
      // status enum's own numbering (2=Approved, 3=Rejected).
      { applicationGuid, input: { action: 3, justificationReg: `${reason} — ${remarks.trim()}` } },
      {
        onSuccess: () => { setSaved(true); showToast('Application rejected successfully.', 'warning') },
        onError: (err: Error) => setFailure(err.message || 'Failed to reject application.'),
      },
    )
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Application Rejected" subtitle="The applicant has been notified of the outcome." onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Reject Application" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-ban"></i> Reject Application</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="danger-box mb-3">
          <i className="lni lni-warning"></i>
          <span>This action will permanently reject the application and notify the applicant. This cannot be undone.</span>
        </div>

        <div className="fg mb-3">
          <label className="lbl">Rejection Reason <span className="req">*</span></label>
          <SearchSelect
            placeholder="Select reason"
            options={['Does not meet A-Level entry standards', 'Incomplete documentation', 'Fee payment discrepancy', 'Programme quota full', 'Fraudulent documents detected', 'Other']}
            value={reason}
            onChange={v => { setReason(v); if (errors.reason) setErrors(p => ({ ...p, reason: '' })) }}
          />
          {errors.reason && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.reason}</p>}
        </div>

        <div className="fg mb-3">
          <label className="lbl">Detailed Remarks <span className="req">*</span></label>
          <textarea className="ctrl" rows={3} placeholder="Provide detailed remarks for the rejection..." value={remarks}
            onChange={e => { setRemarks(e.target.value); if (errors.remarks) setErrors(p => ({ ...p, remarks: '' })) }}
            style={errors.remarks ? { borderColor: 'var(--red)' } : undefined} />
          {errors.remarks && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.remarks}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={handleClose}>Cancel</button>
          <button className="btn btn-danger" disabled={vetApplication.isPending} onClick={handleConfirm}>
            <i className="lni lni-trash-can"></i> {vetApplication.isPending ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  )
}
