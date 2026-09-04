'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useEnquiryStatus } from '@/hooks/config/useEnquiryStatuses'
import { AuthError } from '@/lib/api/client'

interface ViewEnquiryStatusModalProps extends ModalProps {
  enquiryStatusGuid: string | null
  onEdit: () => void
}

export function ViewEnquiryStatusModal({ isOpen, onClose, enquiryStatusGuid, onEdit }: ViewEnquiryStatusModalProps) {
  const { data: enquiryStatus, isLoading, isError, error } = useEnquiryStatus(enquiryStatusGuid, isOpen)

  const [enquiryStatusCode, setEnquiryStatusCode] = useState('')
  const [enquiryStatusName, setEnquiryStatusName] = useState('')

  // Fill the view once the status loads; re-runs per guid since react-query resets `enquiryStatus` to undefined between them.
  useEffect(() => {
    if (!isOpen || !enquiryStatus) return
    setEnquiryStatusCode(enquiryStatus.enquiryStatusCode)
    setEnquiryStatusName(enquiryStatus.enquiryStatusName)
  }, [isOpen, enquiryStatus])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Enquiry Status"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load enquiry status details.') : 'Failed to load enquiry status details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !enquiryStatus) {
    return (
      <div className="modal-overlay open" id="view-enquiry-status-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Enquiry Status</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading enquiry status details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-enquiry-status-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Enquiry Status</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Status Code </div>
            <div className="val font-mono uppercase">{enquiryStatusCode || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Status Name </div>
            <div className="val">{enquiryStatusName || '—'}</div>
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
