'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { BatchTimeInput } from '@/lib/api/academic/batchTime'
import { useBatchTime } from '@/hooks/config/useBatchTimes'
import { AuthError } from '@/lib/api/client'

interface BatchTimeFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  batchTimeGuid: string | null
  createBatchTime: {
    mutate: (input: BatchTimeInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateBatchTime: {
    mutate: (variables: { guid: string; input: BatchTimeInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function BatchTimeFormModal({ isOpen, onClose, showToast, mode, batchTimeGuid, createBatchTime, updateBatchTime }: BatchTimeFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: batchTimeRecord, isLoading, isError, error } = useBatchTime(isEdit ? batchTimeGuid : null, isOpen && isEdit)

  const [saved, setSaved]                 = useState(false)
  const [failure, setFailure]             = useState<string | null>(null)
  const [batchTime, setBatchTime]         = useState('')
  const [batchTimeCode, setBatchTimeCode] = useState('')
  const [errors, setErrors]               = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && batchTimeRecord) {
      setBatchTime(batchTimeRecord.batchTime)
      setBatchTimeCode(batchTimeRecord.batchTimeCode)
    } else if (!isEdit) {
      setBatchTime(''); setBatchTimeCode('')
    }
    setErrors({})
  }, [isOpen, isEdit, batchTimeRecord])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!batchTime.trim()) e.batchTime = 'Batch Time is required'
    if (!batchTimeCode.trim()) e.batchTimeCode = 'Batch Time Code is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: BatchTimeInput = { batchTime, batchTimeCode }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Batch time updated successfully' : 'Batch time added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} batch time. Please try again.`)

    if (isEdit && batchTimeGuid) {
      updateBatchTime.mutate({ guid: batchTimeGuid, input }, { onSuccess, onError })
    } else {
      createBatchTime.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateBatchTime.isPending : createBatchTime.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Batch Time Updated!' : 'Batch Time Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new batch time has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Batch Time" : "Couldn't Add Batch Time"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Batch Time"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load batch time details.') : 'Failed to load batch time details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !batchTimeRecord)) {
    return (
      <div className="modal-overlay open" id="edit-batch-time-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Batch Time</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading batch time details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-batch-time-modal' : 'new-batch-time-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-timer'}`}></i> {isEdit ? 'Edit Batch Time' : 'Add Batch Time'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Batch Time <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Morning'}
              maxLength={50}
              value={batchTime}
              onChange={e => { setBatchTime(e.target.value); clearError('batchTime') }}
              style={errors.batchTime ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.batchTime && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.batchTime}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Batch Time Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. MRN'}
              maxLength={10}
              value={batchTimeCode}
              onChange={e => { setBatchTimeCode(e.target.value.toUpperCase()); clearError('batchTimeCode') }}
              style={errors.batchTimeCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.batchTimeCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.batchTimeCode}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Batch Time' : 'Add Batch Time')}
          </button>
        </div>
      </div>
    </div>
  )
}
