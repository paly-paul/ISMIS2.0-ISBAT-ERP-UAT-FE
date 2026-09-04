'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { EnquirySourceMasterInput } from '@/lib/api/admission/enquirySourceMaster'
import { useEnquirySourceMaster } from '@/hooks/admission/useEnquirySourceMasters'
import { AuthError } from '@/lib/api/client'

interface EnquirySourceMasterFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  enquirySourceGuid: string | null
  createEnquirySourceMaster: {
    mutate: (input: EnquirySourceMasterInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateEnquirySourceMaster: {
    mutate: (variables: { guid: string; input: EnquirySourceMasterInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function EnquirySourceMasterFormModal({ isOpen, onClose, showToast, mode, enquirySourceGuid, createEnquirySourceMaster, updateEnquirySourceMaster }: EnquirySourceMasterFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: source, isLoading, isError, error } = useEnquirySourceMaster(isEdit ? enquirySourceGuid : null, isOpen && isEdit)

  const [saved, setSaved]                         = useState(false)
  const [failure, setFailure]                     = useState<string | null>(null)
  const [enquirySourceName, setEnquirySourceName] = useState('')
  const [errors, setErrors]                       = useState<Record<string, string>>({})

  // Prefill once the source loads; re-runs per guid since react-query resets `source` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && source) {
      setEnquirySourceName(source.enquirySourceName)
    } else if (!isEdit) {
      setEnquirySourceName('')
    }
    setErrors({})
  }, [isOpen, isEdit, source])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!enquirySourceName.trim()) e.enquirySourceName = 'Enquiry Source Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: EnquirySourceMasterInput = { enquirySourceName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Enquiry source updated successfully' : 'Enquiry source added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} enquiry source. Please try again.`)

    if (isEdit && enquirySourceGuid) {
      updateEnquirySourceMaster.mutate({ guid: enquirySourceGuid, input }, { onSuccess, onError })
    } else {
      createEnquirySourceMaster.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateEnquirySourceMaster.isPending : createEnquirySourceMaster.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Enquiry Source Updated!' : 'Enquiry Source Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new enquiry source has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Enquiry Source" : "Couldn't Add Enquiry Source"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Enquiry Source"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load enquiry source details.') : 'Failed to load enquiry source details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !source)) {
    return (
      <div className="modal-overlay open" id="edit-enquiry-source-master-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Enquiry Source</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading enquiry source details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-enquiry-source-master-modal' : 'new-enquiry-source-master-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-volume'}`}></i> {isEdit ? 'Edit Enquiry Source' : 'Add Enquiry Source'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Enquiry Source Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. Social Media'}
            value={enquirySourceName}
            onChange={e => { setEnquirySourceName(e.target.value); clearError('enquirySourceName') }}
            style={errors.enquirySourceName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.enquirySourceName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquirySourceName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Enquiry Source' : 'Add Enquiry Source')}
          </button>
        </div>
      </div>
    </div>
  )
}
