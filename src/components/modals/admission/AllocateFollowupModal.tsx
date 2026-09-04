'use client'
import { useState, useEffect } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'

export interface FollowupEnquiry {
  ref: string; name: string; programme: string; assignedTo: string; followupDate: string; priority: string
}

const STAFF = ['Jane Nalule', 'David Okwir', 'Peter Ssentongo', 'Grace Achieng']

interface Props extends ModalProps {
  enquiry: FollowupEnquiry | null
  onAllocate: (ref: string, assignedTo: string, followupDate: string, priority: string) => void
}

export function AllocateFollowupModal({ isOpen, onClose, enquiry, onAllocate }: Props) {
  const [assignedTo, setAssignedTo] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (enquiry) {
      setAssignedTo(enquiry.assignedTo === 'Unallocated' ? '' : enquiry.assignedTo)
      setFollowupDate(enquiry.followupDate === '—' ? '' : enquiry.followupDate)
      setPriority(enquiry.priority || 'Medium')
      setNotes(''); setErrors({}); setSaved(false)
    }
  }, [enquiry])

  if (!isOpen || !enquiry) return null

  function handleClose() { setAssignedTo(''); setFollowupDate(''); setPriority('Medium'); setNotes(''); setErrors({}); setSaved(false); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!assignedTo)    e.assignedTo   = 'Please assign a staff member'
    if (!followupDate)  e.followupDate = 'Follow-up date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Follow-up Allocated!" subtitle={`${enquiry.name} has been assigned to ${assignedTo} for follow-up.`} onClose={handleClose} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2"><i className="lni lni-calendar"></i> Allocate Follow-up &mdash; {enquiry.ref}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g2">
          <div className="fg">
            <label className="lbl">Assign To <span className="req">*</span></label>
            <SearchSelect
              placeholder="-- Select Staff --"
              options={STAFF}
              value={assignedTo}
              onChange={v => { setAssignedTo(v); if (errors.assignedTo) setErrors(p => ({ ...p, assignedTo: '' })) }}
            />
            {errors.assignedTo && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.assignedTo}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Follow-up Date <span className="req">*</span></label>
            <DatePicker value={followupDate}
              onChange={v => { setFollowupDate(v); if (errors.followupDate) setErrors(p => ({ ...p, followupDate: '' })) }}
              hasError={!!errors.followupDate} />
            {errors.followupDate && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followupDate}</p>}
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="lbl">Priority</label>
            <SearchSelect options={['High', 'Medium', 'Low']} value={priority} onChange={setPriority} />
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="lbl">Notes</label>
            <textarea className="ctrl" rows={3} placeholder="Any context for the assigned staff member..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (validate()) { onAllocate(enquiry.ref, assignedTo, followupDate, priority); setSaved(true) } }}>
            <i className="lni lni-checkmark"></i> Allocate Follow-up
          </button>
        </div>
      </div>
    </div>
  )
}
