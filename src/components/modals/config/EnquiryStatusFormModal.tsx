'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { EnquiryStatusInput } from '@/lib/api/academic/enquiryStatus'
import { useEnquiryStatus } from '@/hooks/config/useEnquiryStatuses'
import { AuthError } from '@/lib/api/client'

interface EnquiryStatusFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  enquiryStatusGuid: string | null
  createEnquiryStatus: {
    mutate: (input: EnquiryStatusInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateEnquiryStatus: {
    mutate: (variables: { guid: string; input: EnquiryStatusInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function EnquiryStatusFormModal({ isOpen, onClose, showToast, mode, enquiryStatusGuid, createEnquiryStatus, updateEnquiryStatus }: EnquiryStatusFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: enquiryStatus, isLoading, isError, error } = useEnquiryStatus(isEdit ? enquiryStatusGuid : null, isOpen && isEdit)

  const [saved, setSaved]                         = useState(false)
  const [failure, setFailure]                     = useState<string | null>(null)
  const [enquiryStatusCode, setEnquiryStatusCode] = useState('')
  const [enquiryStatusName, setEnquiryStatusName] = useState('')
  const [errors, setErrors]                       = useState<Record<string, string>>({})

  // Prefill once the status loads; re-runs per guid since react-query resets `enquiryStatus` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && enquiryStatus) {
      setEnquiryStatusCode(enquiryStatus.enquiryStatusCode)
      setEnquiryStatusName(enquiryStatus.enquiryStatusName)
    } else if (!isEdit) {
      setEnquiryStatusCode(''); setEnquiryStatusName('')
    }
    setErrors({})
  }, [isOpen, isEdit, enquiryStatus])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!enquiryStatusCode.trim()) e.enquiryStatusCode = 'Status Code is required'
    if (!enquiryStatusName.trim()) e.enquiryStatusName = 'Status Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: EnquiryStatusInput = { enquiryStatusCode, enquiryStatusName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Enquiry status updated successfully' : 'Enquiry status added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} enquiry status. Please try again.`)

    if (isEdit && enquiryStatusGuid) {
      updateEnquiryStatus.mutate({ guid: enquiryStatusGuid, input }, { onSuccess, onError })
    } else {
      createEnquiryStatus.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateEnquiryStatus.isPending : createEnquiryStatus.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Enquiry Status Updated!' : 'Enquiry Status Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new enquiry status has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update Enquiry Status" : "Couldn't Add Enquiry Status"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Enquiry Status"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load enquiry status details.') : 'Failed to load enquiry status details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !enquiryStatus)) {
    return (
      <div className="modal-overlay open" id="edit-enquiry-status-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Enquiry Status</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading enquiry status details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-enquiry-status-modal' : 'new-enquiry-status-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-flag'}`}></i> {isEdit ? 'Edit Enquiry Status' : 'Add Enquiry Status'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Status Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. CA'}
              maxLength={8}
              value={enquiryStatusCode}
              onChange={e => { setEnquiryStatusCode(e.target.value); clearError('enquiryStatusCode') }}
              style={errors.enquiryStatusCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.enquiryStatusCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryStatusCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Status Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Contact Attempted (CA)'}
              value={enquiryStatusName}
              onChange={e => { setEnquiryStatusName(e.target.value); clearError('enquiryStatusName') }}
              style={errors.enquiryStatusName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.enquiryStatusName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryStatusName}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Enquiry Status' : 'Add Enquiry Status')}
          </button>
        </div>
      </div>
    </div>
  )
}
