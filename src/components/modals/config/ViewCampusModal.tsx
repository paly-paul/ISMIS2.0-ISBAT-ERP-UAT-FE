'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { Campus } from '@/lib/api/academic/campus'

interface ViewCampusModalProps extends ModalProps {
  campus: Campus | null
  onEdit: () => void
}

export function ViewCampusModal({ isOpen, onClose, campus, onEdit }: ViewCampusModalProps) {
  const [campusCode, setCampusCode] = useState('')
  const [campusName, setCampusName] = useState('')
  const [location, setLocation] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')

  useEffect(() => {
    if (isOpen && campus) {
      setCampusCode(campus.campusCode)
      setCampusName(campus.campusName)
      setLocation(campus.location)
      setAddress(campus.address ?? '')
      setContact(campus.contact ?? '')
    }
  }, [isOpen, campus])

  if (!isOpen || !campus) return null

  function handleClose() { onClose() }

  return (
    <div className="modal-overlay open" id="view-campus-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Campus</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g3">
          <div className="fg">
            <div className="lbl">Campus Code </div>
            <div className="val font-mono uppercase">{campusCode || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Campus Name </div>
            <div className="val">{campusName || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Location </div>
            <div className="val">{location || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Address</div>
            <div className="val">{address || '—'}</div>
          </div>
          <div className="fg">
            <div className="lbl">Contact</div>
            <div className="val">{contact || '—'}</div>
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
