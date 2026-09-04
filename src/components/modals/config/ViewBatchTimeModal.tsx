'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useBatchTime } from '@/hooks/config/useBatchTimes'
import { AuthError } from '@/lib/api/client'

interface ViewBatchTimeModalProps extends ModalProps {
  batchTimeGuid: string | null
  onEdit: () => void
}

export function ViewBatchTimeModal({ isOpen, onClose, batchTimeGuid, onEdit }: ViewBatchTimeModalProps) {
  const { data: batchTimeRecord, isLoading, isError, error } = useBatchTime(batchTimeGuid, isOpen)

  const [batchTime, setBatchTime]         = useState('')
  const [batchTimeCode, setBatchTimeCode] = useState('')

  // Fill the view when the selected batch time loads.
  useEffect(() => {
    if (!isOpen || !batchTimeRecord) return
    setBatchTime(batchTimeRecord.batchTime)
    setBatchTimeCode(batchTimeRecord.batchTimeCode)
  }, [isOpen, batchTimeRecord])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
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

  if (isLoading || !batchTimeRecord) {
    return (
      <div className="modal-overlay open" id="view-batch-time-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Batch Time</div>
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
    <div className="modal-overlay open" id="view-batch-time-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Batch Time</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Batch Time </div>
            <div className="val">{batchTime || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Batch Time Code </div>
            <div className="val font-mono uppercase">{batchTimeCode || '—'}</div>
          </div>
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
