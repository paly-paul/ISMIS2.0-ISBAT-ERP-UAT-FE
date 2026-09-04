'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { FollowUpModeInput } from '@/lib/api/admission/followUpMode'
import { useFollowUpMode } from '@/hooks/admission/useFollowUpModes'
import { AuthError } from '@/lib/api/client'

interface FollowUpModeFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  followUpModeGuid: string | null
  createFollowUpMode: {
    mutate: (input: FollowUpModeInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateFollowUpMode: {
    mutate: (variables: { guid: string; input: FollowUpModeInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

export function FollowUpModeFormModal({ isOpen, onClose, showToast, mode: formMode, followUpModeGuid, createFollowUpMode, updateFollowUpMode }: FollowUpModeFormModalProps) {
  const isEdit = formMode === 'edit'
  const { data: mode, isLoading, isError, error } = useFollowUpMode(isEdit ? followUpModeGuid : null, isOpen && isEdit)

  const [saved, setSaved]                       = useState(false)
  const [failure, setFailure]                   = useState<string | null>(null)
  const [followUpModeName, setFollowUpModeName] = useState('')
  const [errors, setErrors]                     = useState<Record<string, string>>({})

  // Prefill once the mode loads; re-runs per guid since react-query resets `mode` to undefined between them.
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && mode) {
      setFollowUpModeName(mode.followUpModeName)
    } else if (!isEdit) {
      setFollowUpModeName('')
    }
    setErrors({})
  }, [isOpen, isEdit, mode])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!followUpModeName.trim()) e.followUpModeName = 'Followup Mode Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const input: FollowUpModeInput = { followUpModeName }
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Followup mode updated successfully' : 'Followup mode added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} followup mode. Please try again.`)

    if (isEdit && followUpModeGuid) {
      updateFollowUpMode.mutate({ guid: followUpModeGuid, input }, { onSuccess, onError })
    } else {
      createFollowUpMode.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateFollowUpMode.isPending : createFollowUpMode.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Followup Mode Updated!' : 'Followup Mode Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new followup mode has been saved successfully.'}
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
          <FailurePopup title={isEdit ? "Couldn't Update Followup Mode" : "Couldn't Add Followup Mode"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isEdit && isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Followup Mode"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load followup mode details.') : 'Failed to load followup mode details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isEdit && (isLoading || !mode)) {
    return (
      <div className="modal-overlay open" id="edit-followup-mode-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-pencil"></i> Edit Followup Mode</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading followup mode details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-followup-mode-modal' : 'new-followup-mode-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className={`lni ${isEdit ? 'lni-pencil' : 'lni-comments'}`}></i> {isEdit ? 'Edit Followup Mode' : 'Add Followup Mode'}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Followup Mode Name <span className="req">*</span></div>
          <input
            className="ctrl"
            type="text"
            placeholder={isEdit ? undefined : 'e.g. Phone Call'}
            value={followUpModeName}
            onChange={e => { setFollowUpModeName(e.target.value); clearError('followUpModeName') }}
            style={errors.followUpModeName ? { borderColor: 'var(--red)' } : undefined}
          />
          {errors.followUpModeName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpModeName}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Followup Mode' : 'Add Followup Mode')}
          </button>
        </div>
      </div>
    </div>
  )
}
