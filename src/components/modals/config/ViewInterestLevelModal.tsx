'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useInterestLevel } from '@/hooks/admission/useInterestLevels'
import { AuthError } from '@/lib/api/client'

interface ViewInterestLevelModalProps extends ModalProps {
  interestLevelGuid: string | null
  onEdit: () => void
}

export function ViewInterestLevelModal({ isOpen, onClose, interestLevelGuid, onEdit }: ViewInterestLevelModalProps) {
  const { data: level, isLoading, isError, error } = useInterestLevel(interestLevelGuid, isOpen)

  const [interestLevelName, setInterestLevelName] = useState('')

  // Fill the view once the level loads; re-runs per guid since react-query resets `level` to undefined between them.
  useEffect(() => {
    if (!isOpen || !level) return
    setInterestLevelName(level.interestLevelName)
  }, [isOpen, level])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Interest Level"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load interest level details.') : 'Failed to load interest level details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !level) {
    return (
      <div className="modal-overlay open" id="view-interest-level-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Interest Level</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading interest level details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-interest-level-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Interest Level</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Interest Level Name </div>
          <div className="val">{interestLevelName || '—'}</div>
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
