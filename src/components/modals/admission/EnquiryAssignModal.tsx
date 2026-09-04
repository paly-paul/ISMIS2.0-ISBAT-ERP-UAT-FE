'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { EnquiryUpdateInput } from '@/lib/api/admission/enquiry'
import { useEnquiry } from '@/hooks/admission/useEnquiries'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { AuthError } from '@/lib/api/client'

interface EnquiryAssignModalProps extends ModalProps {
  enquiryGuid: string | null
  updateEnquiry: {
    mutate: (variables: { guid: string; input: EnquiryUpdateInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

// Update.bru's payload only carries advisorGuid/programGuid/campusGuid
// (campusGuid required, the rest optional) — this is a staff assignment
// action, not a full edit of the enquiry's original details, which are
// shown read-only above the editable fields. enquiryStatus is left out —
// see the note on EnquiryUpdateInput in lib/api/admission/enquiry.ts.
export function EnquiryAssignModal({ isOpen, onClose, showToast, enquiryGuid, updateEnquiry }: EnquiryAssignModalProps) {
  const { data: enquiry, isLoading, isError, error } = useEnquiry(enquiryGuid, isOpen)
  const { data: employees = [] } = useEmployees()
  const { data: programs = [] }  = useProgramMasters()
  const { data: campuses = [] }  = useCampuses()
  // No intakeName/intakeCode field exists on the enquiry response itself —
  // resolve intakeGuid against the real Intake master, same client-side
  // resolution pattern as the enquiry-list page's own resolveProgramName.
  const { data: intakes = [] }   = useIntakes()
  function resolveIntakeLabel(guid: string | null) {
    if (!guid) return '—'
    const intake = intakes.find(i => i.intakeGuid === guid)
    return intake ? `${intake.intakeCode} — ${intake.description}` : '—'
  }
  // enquiry.campusName is confirmed null on both GET and this modal's own
  // PUT response (a live sample: campusGuid populated, campusName null) —
  // same "guid real, name field null" gap Intake already had to work around
  // above. campuses is already loaded here for the editable Campus dropdown
  // below, so resolving against it costs nothing extra.
  function resolveCampusName(guid: string | null) {
    if (!guid) return '—'
    return campuses.find(c => c.campusGuid === guid)?.campusName ?? '—'
  }

  const [saved, setSaved]     = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [advisorGuid, setAdvisorGuid] = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [campusGuid, setCampusGuid]   = useState('')
  const [errors, setErrors]   = useState<Record<string, string>>({})

  const advisorOptions = employees.map(e => ({ value: e.employeeGuid, label: e.empName }))
  const programOptions = programs.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))
  const campusOptions  = campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))

  // Prefill once the enquiry loads. Re-runs whenever a different guid is
  // fetched (react-query resets `enquiry` to undefined when enquiryGuid
  // changes, so stale data never leaks between rows).
  useEffect(() => {
    if (!isOpen || !enquiry) return
    setAdvisorGuid(enquiry.advisorGuid ?? '')
    setProgramGuid(enquiry.programGuid ?? '')
    setCampusGuid(enquiry.campusGuid)
    setErrors({})
  }, [isOpen, enquiry])

  if (!isOpen) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!campusGuid) e.campusGuid = 'Please select a Campus'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!enquiryGuid || !validate()) return
    updateEnquiry.mutate(
      { guid: enquiryGuid, input: { advisorGuid: advisorGuid || null, programGuid: programGuid || null, campusGuid } },
      {
        onSuccess: () => { setSaved(true); showToast('Enquiry updated successfully') },
        onError: (error: Error) => setFailure(error.message || 'Failed to update enquiry. Please try again.'),
      },
    )
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Enquiry Updated!" subtitle="Your changes have been saved successfully." onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Couldn't Update Enquiry" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Enquiry"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load enquiry details.') : 'Failed to load enquiry details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !enquiry) {
    return (
      <div className="modal-overlay open" id="enquiry-assign-modal">
        <div className="modal modal-md" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> Enquiry Details</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
            <span style={{ color: 'var(--g400)' }}>Loading enquiry details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id="enquiry-assign-modal">
      {/* modal-flex + modal-scroll, not a directly-scrolling plain .modal —
          the base .modal class carries both border-radius and its own
          overflow-y: auto, and a container that scrolls itself doesn't clip
          its own native scrollbar to that radius (a real rendering quirk,
          worst on classic non-overlay Windows scrollbars) — the scrollbar
          track sits flush against the corner and pokes a small square notch
          out past the rounded edge. modal-flex keeps the outer box
          non-scrolling (overflow: hidden, safe with border-radius) and moves
          the actual scrolling to an inner plain-rectangle div, which is what
          ProgrammeModal/VettingReviewModal/EditIntakeModal already do.
          height: auto overrides modal-flex's own fixed `height: 85vh` (meant
          for tall multi-step wizards) — this modal's content is short, and
          85vh would leave most of it empty space. The base .modal class's
          own max-height: 90vh still applies underneath, so modal-scroll only
          actually starts scrolling if content ever genuinely exceeds that. */}
      <div className="modal modal-md modal-flex" style={{ height: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> Enquiry Details — {enquiry.enquiryCode}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">
          {/* Read-only — the update endpoint doesn't accept these fields at all */}
          <div className="g2" style={{ marginBottom: 18 }}>
            <div className="fg m-0"><div className="lbl">Name</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.studentName}</div></div>
            <div className="fg m-0"><div className="lbl">Phone</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.mobile}</div></div>
            <div className="fg m-0"><div className="lbl">Email</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.email || '—'}</div></div>
            <div className="fg m-0"><div className="lbl">Enquiry Date</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.enquiryDate.slice(0, 10)}</div></div>
            <div className="fg m-0"><div className="lbl">Source</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.sourceName || '—'}</div></div>
            <div className="fg m-0"><div className="lbl">Intake</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{resolveIntakeLabel(enquiry.intakeGuid)}</div></div>
            <div className="fg m-0"><div className="lbl">Campus</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{resolveCampusName(enquiry.campusGuid)}</div></div>
            <div className="fg m-0"><div className="lbl">Status</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.enquiryStatusName || '—'}</div></div>
            <div className="fg m-0"><div className="lbl">Remarks</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.remarks || '—'}</div></div>
          </div>

          <div className="sec-divider">Assign</div>
          <div className="g2">
            <div className="fg">
              <div className="lbl">Advisor</div>
              <SearchSelect placeholder="— unassigned —" options={advisorOptions} value={advisorGuid} onChange={setAdvisorGuid} />
            </div>
            <div className="fg">
              <div className="lbl">Programme</div>
              <SearchSelect placeholder="— select —" options={programOptions} value={programGuid} onChange={setProgramGuid} />
            </div>
            <div className="fg">
              <div className="lbl">Campus <span className="req">*</span></div>
              <SearchSelect
                placeholder="— select —"
                options={campusOptions}
                value={campusGuid}
                onChange={val => { setCampusGuid(val); if (errors.campusGuid) setErrors(p => ({ ...p, campusGuid: '' })) }}
              />
              {errors.campusGuid && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.campusGuid}</p>}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={updateEnquiry.isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {updateEnquiry.isPending ? 'Saving…' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
