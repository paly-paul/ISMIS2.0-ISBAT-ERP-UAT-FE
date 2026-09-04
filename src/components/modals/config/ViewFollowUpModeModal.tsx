'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useFollowUpMode } from '@/hooks/admission/useFollowUpModes'
import { AuthError } from '@/lib/api/client'

interface ViewFollowUpModeModalProps extends ModalProps {
  followUpModeGuid: string | null
  onEdit: () => void
}

export function ViewFollowUpModeModal({ isOpen, onClose, followUpModeGuid, onEdit }: ViewFollowUpModeModalProps) {
  const { data: mode, isLoading, isError, error } = useFollowUpMode(followUpModeGuid, isOpen)

  const [followUpModeName, setFollowUpModeName] = useState('')

  // Fill the view once the mode loads; re-runs per guid since react-query resets `mode` to undefined between them.
  useEffect(() => {
    if (!isOpen || !mode) return
    setFollowUpModeName(mode.followUpModeName)
  }, [isOpen, mode])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
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

  if (isLoading || !mode) {
    return (
      <div className="modal-overlay open" id="view-followup-mode-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Followup Mode</div>
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
    <div className="modal-overlay open" id="view-followup-mode-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Followup Mode</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Followup Mode Name </div>
          <div className="val">{followUpModeName || '—'}</div>
        </div>
        <div className="modal-footer">
          <span className="flex-1"></span>
          <button className="btn btn-neu" onClick={onEdit} style={{ marginRight: 8 }}>
            <i className="lni lni-pencil"></i> Edit
          </button>
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
