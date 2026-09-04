'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import { EnquiryFollowUpInput, EnquiryFollowUpListItem } from '@/lib/api/admission/enquiryFollowUp'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useFollowUpStatuses } from '@/hooks/config/useFollowUpStatuses'
import { useFollowUpModes } from '@/hooks/admission/useFollowUpModes'
import { useEnquiryStatuses } from '@/hooks/config/useEnquiryStatuses'
import { useInterestLevels } from '@/hooks/admission/useInterestLevels'

interface NewFollowUpLogModalProps extends ModalProps {
  // Capped at 1000, fetched by the page only while this modal is open — the
  // real ?search= endpoint (see getEnquiryFollowUps) is confirmed to work,
  // but SearchSelect below only takes a static option list, not a live
  // server-search callback, so it isn't wired through here. Revisit if the
  // real enquiry count ever grows past this cap.
  enquiries: EnquiryFollowUpListItem[]
  createFollowUp: {
    mutate: (input: EnquiryFollowUpInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

// Today's date at midnight, matching the confirmed payload sample's format.
function todayAtMidnight() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}T00:00:00`
}

// intEnquiry/followUpStatus/followUpMode/enquiryStatus/interestLevel are all
// unconfirmed numbers — see the long note on EnquiryFollowUpInput in
// lib/api/admission/enquiryFollowUp.ts. Each dropdown here is real (backed
// by the actual masters), but the value actually sent for these five fields
// is that option's 1-based position in its list, not a confirmed id.
export function NewFollowUpLogModal({ isOpen, onClose, showToast, enquiries, createFollowUp }: NewFollowUpLogModalProps) {
  const { data: employees = [] }        = useEmployees()
  const { data: followUpStatuses = [] } = useFollowUpStatuses()
  const { data: followUpModes = [] }    = useFollowUpModes()
  const { data: enquiryStatuses = [] }  = useEnquiryStatuses()
  const { data: interestLevels = [] }   = useInterestLevels()

  const enquiryOptions      = enquiries.map((e, i) => ({ value: String(i), label: `${e.enquiryCode} — ${e.studentName}` }))
  const advisorOptions      = employees.map(e => ({ value: e.employeeGuid, label: e.empName }))
  const followUpStatusOptions = followUpStatuses.map((s, i) => ({ value: String(i), label: s.followUpStatusName }))
  const followUpModeOptions   = followUpModes.map((m, i) => ({ value: String(i), label: m.followUpModeName }))
  const enquiryStatusOptions  = enquiryStatuses.map((s, i) => ({ value: String(i), label: s.enquiryStatusName }))
  const interestLevelOptions  = interestLevels.map((l, i) => ({ value: String(i), label: l.interestLevelName }))

  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [enquiryIdx, setEnquiryIdx]           = useState('')
  const [advisorGuid, setAdvisorGuid]         = useState('')
  const [followUpDate, setFollowUpDate]       = useState(() => todayAtMidnight().slice(0, 10))
  const [statusIdx, setStatusIdx]             = useState('')
  const [modeIdx, setModeIdx]                 = useState('')
  const [enquiryStatusIdx, setEnquiryStatusIdx] = useState('')
  const [levelIdx, setLevelIdx]               = useState('')
  const [nextFollowDate, setNextFollowDate]   = useState('')
  const [remarks, setRemarks]                 = useState('')
  const [errors, setErrors]                   = useState<Record<string, string>>({})

  if (!isOpen) return null

  function handleClose() {
    setSaved(false); setFailure(null)
    setEnquiryIdx(''); setAdvisorGuid(''); setFollowUpDate(todayAtMidnight().slice(0, 10))
    setStatusIdx(''); setModeIdx(''); setEnquiryStatusIdx(''); setLevelIdx('')
    setNextFollowDate(''); setRemarks(''); setErrors({})
    onClose()
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!enquiryIdx)       e.enquiryIdx = 'Please select an Enquiry'
    if (!advisorGuid)      e.advisorGuid = 'Please select an Advisor'
    if (!followUpDate)     e.followUpDate = 'Follow-up Date is required'
    if (!statusIdx)        e.statusIdx = 'Please select a Follow-up Status'
    if (!modeIdx)          e.modeIdx = 'Please select a Follow-up Mode'
    if (!enquiryStatusIdx) e.enquiryStatusIdx = 'Please select an Enquiry Status'
    if (!remarks.trim())   e.remarks = 'Remarks are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    createFollowUp.mutate(
      {
        intEnquiry: Number(enquiryIdx) + 1,
        advisorGuid,
        followUpDate: `${followUpDate}T00:00:00`,
        followUpStatus: Number(statusIdx) + 1,
        followUpMode: Number(modeIdx) + 1,
        enquiryStatus: Number(enquiryStatusIdx) + 1,
        interestLevel: levelIdx ? Number(levelIdx) + 1 : null,
        nextFollowDate: nextFollowDate ? `${nextFollowDate}T00:00:00` : null,
        remarks: remarks.trim(),
      },
      {
        onSuccess: () => { setSaved(true); showToast('Follow-up logged successfully') },
        onError: (error: Error) => setFailure(error.message || 'Failed to log follow-up. Please try again.'),
      },
    )
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Follow-up Logged!" subtitle="The follow-up has been saved successfully." onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Log Follow-up" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="new-followup-log-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-phone"></i> Log Follow-up</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g2">
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <div className="lbl">Enquiry <span className="req">*</span></div>
            <SearchSelect placeholder="— select from this page —" options={enquiryOptions} value={enquiryIdx} onChange={setEnquiryIdx} />
            {errors.enquiryIdx && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryIdx}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Advisor <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={advisorOptions} value={advisorGuid} onChange={setAdvisorGuid} />
            {errors.advisorGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.advisorGuid}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Follow-up Date <span className="req">*</span></div>
            <DatePicker value={followUpDate} onChange={setFollowUpDate} hasError={!!errors.followUpDate} />
            {errors.followUpDate && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpDate}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Follow-up Status <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={followUpStatusOptions} value={statusIdx} onChange={setStatusIdx} />
            {errors.statusIdx && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.statusIdx}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Follow-up Mode <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={followUpModeOptions} value={modeIdx} onChange={setModeIdx} />
            {errors.modeIdx && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.modeIdx}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Enquiry Status <span className="req">*</span></div>
            <SearchSelect placeholder="— select —" options={enquiryStatusOptions} value={enquiryStatusIdx} onChange={setEnquiryStatusIdx} />
            {errors.enquiryStatusIdx && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryStatusIdx}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Interest Level</div>
            <SearchSelect placeholder="— optional —" options={interestLevelOptions} value={levelIdx} onChange={setLevelIdx} />
          </div>
          <div className="fg">
            <div className="lbl">Next Follow-up Date</div>
            <DatePicker value={nextFollowDate} onChange={setNextFollowDate} />
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <div className="lbl">Remarks <span className="req">*</span></div>
            <textarea className="ctrl" rows={3} placeholder="e.g. Called student, interested in Diploma program." value={remarks} onChange={e => setRemarks(e.target.value)} />
            {errors.remarks && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.remarks}</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={createFollowUp.isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {createFollowUp.isPending ? 'Saving…' : 'Save Follow-up'}
          </button>
        </div>
      </div>
    </div>
  )
}
