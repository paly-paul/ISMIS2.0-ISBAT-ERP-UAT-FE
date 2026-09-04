'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useEnquirySource } from '@/hooks/admission/useEnquirySources'
import { AuthError } from '@/lib/api/client'

interface ViewEnquirySourceModalProps extends ModalProps {
  isbatSourceGuid: string | null
  onEdit: () => void
}

export function ViewEnquirySourceModal({ isOpen, onClose, isbatSourceGuid, onEdit }: ViewEnquirySourceModalProps) {
  const { data: source, isLoading, isError, error } = useEnquirySource(isbatSourceGuid, isOpen)

  const [sourceName, setSourceName] = useState('')

  // Fill the view once the source loads; re-runs per guid since react-query resets `source` to undefined between them.
  useEffect(() => {
    if (!isOpen || !source) return
    setSourceName(source.sourceName)
  }, [isOpen, source])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
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

  if (isLoading || !source) {
    return (
      <div className="modal-overlay open" id="view-enquiry-source-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Isbat Enquiry Source</div>
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
    <div className="modal-overlay open" id="view-enquiry-source-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Isbat Enquiry Source</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Source Name </div>
          <div className="val">{sourceName || '—'}</div>
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
