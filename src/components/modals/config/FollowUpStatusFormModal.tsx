'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { FollowUpStatusInput } from '@/lib/api/academic/followUpStatus'
import { useFollowUpStatus } from '@/hooks/config/useFollowUpStatuses'
import { AuthError } from '@/lib/api/client'

interface FollowUpStatusFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  followUpStatusGuid: string | null
  createFollowUpStatus: {
    mutate: (input: FollowUpStatusInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateFollowUpStatus: {
    mutate: (variables: { guid: string; input: FollowUpStatusInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function FollowUpStatusFormModal({ isOpen, onClose, showToast, mode, followUpStatusGuid, createFollowUpStatus, updateFollowUpStatus }: FollowUpStatusFormModalProps) {
  const isEdit = mode === 'edit'
  const { data: followUpStatus, isLoading, isError, error } = useFollowUpStatus(isEdit ? followUpStatusGuid : null, isOpen && isEdit)

  const [saved, setSaved]                           = useState(false)
  const [failure, setFailure]                       = useState<string | null>(null)
  const [followUpStatusCode, setFollowUpStatusCode] = useState('')
  const [followUpStatusName, setFollowUpStatusName] = useState('')
  const [isClose, setIsClose]                       = useState(false)
  const [errors, setErrors]                         = useState<Record<string, string>>({})

  // Prefill once the status loads; re-runs per guid since react-query resets `followUpStatus` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && followUpStatus) {
      setFollowUpStatusCode(followUpStatus.followUpStatusCode)
      setFollowUpStatusName(followUpStatus.followUpStatusName)
      setIsClose(followUpStatus.isClose === 1)
    } else if (!isEdit) {
      setFollowUpStatusCode(''); setFollowUpStatusName(''); setIsClose(false)
    }
    setErrors({})
  }, [isOpen, isEdit, followUpStatus])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!followUpStatusCode.trim()) e.followUpStatusCode = 'Status Code is required'
    if (!followUpStatusName.trim()) e.followUpStatusName = 'Status Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: FollowUpStatusInput = { followUpStatusCode, followUpStatusName, isClose: isClose ? 1 : 0 }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Followup status updated successfully' : 'Followup status added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} followup status. Please try again.`)

    if (isEdit && followUpStatusGuid) {
      updateFollowUpStatus.mutate({ guid: followUpStatusGuid, input }, { onSuccess, onError })
    } else {
      createFollowUpStatus.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateFollowUpStatus.isPending : createFollowUpStatus.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Followup Status Updated!' : 'Followup Status Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new followup status has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Followup Status" : "Couldn't Add Followup Status"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Followup Status"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load followup status details.') : 'Failed to load followup status details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !followUpStatus)) {
    return (
      <div className="modal-overlay open" id="edit-followup-status-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Followup Status</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading followup status details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-followup-status-modal' : 'new-followup-status-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-phone'}`}></i> {isEdit ? 'Edit Followup Status' : 'Add Followup Status'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Status Code <span className="req">*</span></div>
            <input
              className="ctrl font-mono uppercase"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. T1'}
              maxLength={8}
              value={followUpStatusCode}
              onChange={e => { setFollowUpStatusCode(e.target.value); clearError('followUpStatusCode') }}
              style={errors.followUpStatusCode ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.followUpStatusCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpStatusCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Status Name <span className="req">*</span></div>
            <input
              className="ctrl"
              type="text"
              placeholder={isEdit ? undefined : 'e.g. Meeting Scheduled'}
              value={followUpStatusName}
              onChange={e => { setFollowUpStatusName(e.target.value); clearError('followUpStatusName') }}
              style={errors.followUpStatusName ? { borderColor: 'var(--red)' } : undefined}
            />
            {errors.followUpStatusName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpStatusName}</p>}
          </div>
          <div className="fg span2">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={isClose}
                onChange={e => setIsClose(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--b500)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--g700)', fontWeight: 500 }}>Closes the followup when applied</span>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Followup Status' : 'Add Followup Status')}
          </button>
        </div>
      </div>
    </div>
  )
}
