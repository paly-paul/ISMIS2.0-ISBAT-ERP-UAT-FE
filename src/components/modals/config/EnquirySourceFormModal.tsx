'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { EnquirySourceInput } from '@/lib/api/admission/enquirySource'
import { useEnquirySource } from '@/hooks/admission/useEnquirySources'
import { AuthError } from '@/lib/api/client'

interface EnquirySourceFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  isbatSourceGuid: string | null
  createEnquirySource: {
    mutate: (input: EnquirySourceInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateEnquirySource: {
    mutate: (variables: { guid: string; input: EnquirySourceInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function EnquirySourceFormModal({ isOpen, onClose, showToast, mode, isbatSourceGuid, createEnquirySource, updateEnquirySource }: EnquirySourceFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: source, isLoading, isError, error } = useEnquirySource(isEdit ? isbatSourceGuid : null, isOpen && isEdit)

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  // Prefill once the source loads; re-runs per guid since react-query resets `source` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && source) {
      setSourceName(source.sourceName)
    } else if (!isEdit) {
      setSourceName('')
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
    if (!sourceName.trim()) e.sourceName = 'Source Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: EnquirySourceInput = { sourceName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Isbat enquiry source updated successfully' : 'Isbat enquiry source added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} Isbat enquiry source. Please try again.`)

    if (isEdit && isbatSourceGuid) {
      updateEnquirySource.mutate({ guid: isbatSourceGuid, input }, { onSuccess, onError })
    } else {
      createEnquirySource.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateEnquirySource.isPending : createEnquirySource.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Isbat Enquiry Source Updated!' : 'Isbat Enquiry Source Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new Isbat enquiry source has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Isbat Enquiry Source" : "Couldn't Add Isbat Enquiry Source"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Isbat Enquiry Source"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load Isbat enquiry source details.') : 'Failed to load Isbat enquiry source details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !source)) {
    return (
      <div className="modal-overlay open" id="edit-enquiry-source-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Isbat Enquiry Source</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading Isbat enquiry source details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-enquiry-source-modal' : 'new-enquiry-source-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-compass'}`}></i> {isEdit ? 'Edit Isbat Enquiry Source' : 'Add Isbat Enquiry Source'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Source Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. Open Day'}
            value={sourceName}
            onChange={e => { setSourceName(e.target.value); clearError('sourceName') }}
            style={errors.sourceName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.sourceName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.sourceName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Isbat Enquiry Source' : 'Add Isbat Enquiry Source')}
          </button>
        </div>
      </div>
    </div>
  )
}
