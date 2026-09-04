'use client'
import { useState, useEffect } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { SearchSelect } from '@/components/SearchSelect'

export interface FollowupRecord {
  ref: string; name: string; assignedTo: string; followupDate: string; priority: string; status: string
}

interface Props extends ModalProps {
  record: FollowupRecord | null
  onLog: (ref: string, outcome: string, completed: boolean) => void
}

export function LogFollowupModal({ isOpen, onClose, record, onLog }: Props) {
  const [outcome, setOutcome] = useState('')
  const [notes, setNotes] = useState('')
  const [markComplete, setMarkComplete] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (record) { setOutcome(''); setNotes(''); setMarkComplete(false); setErrors({}); setSaved(false) }
  }, [record])

  if (!isOpen || !record) return null

  function handleClose() { setOutcome(''); setNotes(''); setMarkComplete(false); setErrors({}); setSaved(false); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!outcome)       e.outcome = 'Please select an outcome'
    if (!notes.trim())  e.notes   = 'Follow-up notes are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={markComplete ? 'Follow-up Completed!' : 'Follow-up Logged!'}
            subtitle={markComplete ? `${record.name}'s follow-up has been marked as completed.` : `Outcome recorded: ${outcome}`}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2"><i className="lni lni-phone"></i> Log Follow-up &mdash; {record.ref}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="fg mb-3">
          <label className="lbl">Outcome <span className="req">*</span></label>
          <SearchSelect
            options={[
              { value: '', label: 'Select outcome' },
              { value: 'Interested — scheduled next call', label: 'Interested — scheduled next call' },
              { value: 'Not reachable', label: 'Not reachable' },
              { value: 'Requested callback', label: 'Requested callback' },
              { value: 'Converted to application', label: 'Converted to application' },
              { value: 'Not interested', label: 'Not interested' },
            ]}
            value={outcome}
            onChange={v => { setOutcome(v); if (errors.outcome) setErrors(p => ({ ...p, outcome: '' })) }}
          />
          {errors.outcome && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.outcome}</p>}
        </div>

        <div className="fg mb-3">
          <label className="lbl">Follow-up Notes <span className="req">*</span></label>
          <textarea className="ctrl" rows={3} placeholder="Summarize the conversation..." value={notes}
            onChange={e => { setNotes(e.target.value); if (errors.notes) setErrors(p => ({ ...p, notes: '' })) }}
            style={errors.notes ? { borderColor: 'var(--red)' } : undefined} />
          {errors.notes && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.notes}</p>}
        </div>

        <label className="chk-item mb-3" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={markComplete} onChange={e => setMarkComplete(e.target.checked)} />
          <span className="text-sm text-g700">Mark this follow-up as completed</span>
        </label>

        <div className="modal-footer">
          <button className="btn" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (validate()) { onLog(record.ref, outcome, markComplete); setSaved(true) } }}>
            <i className="lni lni-checkmark"></i> Save Follow-up
          </button>
        </div>
      </div>
    </div>
  )
}
