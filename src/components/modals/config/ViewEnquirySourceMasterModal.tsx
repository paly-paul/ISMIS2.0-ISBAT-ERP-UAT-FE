'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { useEnquirySourceMaster } from '@/hooks/admission/useEnquirySourceMasters'
import { AuthError } from '@/lib/api/client'

interface ViewEnquirySourceMasterModalProps extends ModalProps {
  enquirySourceGuid: string | null
  onEdit: () => void
}

export function ViewEnquirySourceMasterModal({ isOpen, onClose, enquirySourceGuid, onEdit }: ViewEnquirySourceMasterModalProps) {
  const { data: source, isLoading, isError, error } = useEnquirySourceMaster(enquirySourceGuid, isOpen)

  const [enquirySourceName, setEnquirySourceName] = useState('')

  // Fill the view once the source loads; re-runs per guid since react-query resets `source` to undefined between them.
  useEffect(() => {
    if (!isOpen || !source) return
    setEnquirySourceName(source.enquirySourceName)
  }, [isOpen, source])

  if (!isOpen) return null

  function handleClose() { onClose() }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Enquiry Source"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load enquiry source details.') : 'Failed to load enquiry source details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !source) {
    return (
      <div className="modal-overlay open" id="view-enquiry-source-master-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> View Enquiry Source</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading enquiry source details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="view-enquiry-source-master-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Enquiry Source</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="fg">
          <div className="lbl">Enquiry Source Name </div>
          <div className="val">{enquirySourceName || '—'}</div>
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
