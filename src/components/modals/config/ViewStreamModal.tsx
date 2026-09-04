'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useStream } from '@/hooks/config/useStreams'
import { AuthError } from '@/lib/api/client'

interface ViewStreamModalProps extends ModalProps {
  streamGuid: string | null
  onEdit: () => void
}

export function ViewStreamModal({ isOpen, onClose, streamGuid, onEdit }: ViewStreamModalProps) {
  const { data: stream, isLoading, isError, error } = useStream(streamGuid, isOpen)

  const [streamCode, setStreamCode] = useState('')
  const [streamName, setStreamName] = useState('')

  // Fill the view when the selected stream loads.
  useEffect(() => {
    if (!isOpen || !stream) return
    setStreamCode(stream.streamCode)
    setStreamName(stream.streamName)
  }, [isOpen, stream])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Stream"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load stream details.') : 'Failed to load stream details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !stream) {
    return (
      <div className="modal-overlay open" id="view-stream-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Stream</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading stream details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-stream-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Stream</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Stream Code </div>
            <div className="val font-mono uppercase">{streamCode || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Stream Name </div>
            <div className="val">{streamName || '—'}</div>
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
