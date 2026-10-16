'use client'
import { useEffect, useMemo, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { EnquiryUpdateInput, formatEnquiryPhone } from '@/lib/api/admission/enquiry'
import { useEnquiry } from '@/hooks/admission/useEnquiries'
import { useEmployees } from '@/hooks/employee/useEmployees'
import { useSearchProgramMastersInfinite } from '@/hooks/academic/useProgramMaster'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { AuthError } from '@/lib/api/client'
import { flattenUniquePages } from '@/lib/pagination'
import { scrollToFirstError } from '@/lib/scrollToFirstError'

interface EnquiryAssignModalProps extends ModalProps {
  enquiryGuid: string | null
  updateEnquiry: {
    mutate: (variables: { guid: string; input: EnquiryUpdateInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

// put-enquiry.md: campusGuid required; enquiryStatusGuid, programGuid and
// advisorGuid optional. advisorGuid reassigns the enquiry's own advisor (the
// list's advisor filter and the follow-up worklists read it straight away);
// it adds no follow-up history entry. This is a staff assignment
// action, not a full edit of the enquiry's original details, which are
// shown read-only above the editable fields. enquiryStatus is left out —
// see the note on EnquiryUpdateInput in lib/api/admission/enquiry.ts.
export function EnquiryAssignModal({ isOpen, onClose, showToast, enquiryGuid, updateEnquiry }: EnquiryAssignModalProps) {
  const { data: enquiry, isLoading, isError, error } = useEnquiry(enquiryGuid, isOpen)
  const { data: employees = [] } = useEmployees(isOpen)
  const { data: campuses = [] }  = useCampuses(isOpen)
  // No intakeName/intakeCode field exists on the enquiry response itself —
  // resolve intakeGuid against the real Intake master, same client-side
  // resolution pattern as the enquiry-list page's own resolveProgramName.
  const { data: intakes = [] }   = useIntakes(isOpen)
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
  const [programSearch, setProgramSearch] = useState('')
  const [committedProgramSearch, setCommittedProgramSearch] = useState('')
  const [programPickerOpen, setProgramPickerOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCommittedProgramSearch(programSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [programSearch])

  const programQuery = useSearchProgramMastersInfinite(committedProgramSearch, 20, isOpen && programPickerOpen)
  const programs = useMemo(() => {
    const items = flattenUniquePages(programQuery.data?.pages ?? [], p => p.programGuid)
    if (enquiry?.programGuid && enquiry.programName && !items.some(p => p.programGuid === enquiry.programGuid)) {
      items.unshift({ programGuid: enquiry.programGuid, programName: enquiry.programName, programCode: enquiry.programCode ?? '' } as typeof items[number])
    }
    return items
  }, [enquiry?.programCode, enquiry?.programGuid, enquiry?.programName, programQuery.data])

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
    scrollToFirstError(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!enquiryGuid || !validate()) return
    updateEnquiry.mutate(
      { guid: enquiryGuid, input: { advisorGuid: advisorGuid || null, programGuid: programGuid || null, campusGuid } },
      {
        onSuccess: () => { setSaved(true); showToast('Enquiry updated successfully') },
        onError: (error: Error) => {
          // Campus (validation_error) and advisor (validation_error or 404
          // "Advisor not found.") have fields to point at; the rest go to the popup.
          const code = error instanceof AuthError ? error.code : undefined
          const field =
            code === 'validation_error' && /campus/i.test(error.message) ? 'campusGuid'
            : (code === 'validation_error' || code === 'not_found') && /advisor/i.test(error.message) ? 'advisorGuid'
            : null
          if (field) {
            const e = { [field]: error.message }
            setErrors(prev => ({ ...prev, ...e }))
            scrollToFirstError(e)
            return
          }
          setFailure(error.message || 'Failed to update enquiry. Please try again.')
        },
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
            <div className="fg m-0"><div className="lbl">Phone</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{formatEnquiryPhone(enquiry)}</div></div>
            <div className="fg m-0"><div className="lbl">Email</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.email || '—'}</div></div>
            <div className="fg m-0"><div className="lbl">Enquiry Date</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.enquiryDate.slice(0, 10)}</div></div>
            <div className="fg m-0"><div className="lbl">Source</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.enquirySourceName || enquiry.sourceName || '—'}</div></div>
            {enquiry.isbatSourceName && <div className="fg m-0"><div className="lbl">Isbat Source</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.isbatSourceName}</div></div>}
            <div className="fg m-0"><div className="lbl">Intake</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{resolveIntakeLabel(enquiry.intakeGuid)}</div></div>
            <div className="fg m-0"><div className="lbl">Campus</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{resolveCampusName(enquiry.campusGuid)}</div></div>
            <div className="fg m-0"><div className="lbl">Status</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.enquiryStatusName || '—'}</div></div>
            <div className="fg m-0"><div className="lbl">Remarks</div><div style={{ fontSize: 13.5, color: 'var(--g700)' }}>{enquiry.remarks || '—'}</div></div>
          </div>

          <div className="sec-divider">Assign</div>
          <div className="g2">
            <div className="fg">
              <div className="lbl">Advisor</div>
              {/* PUT can reassign the advisor but never clear it (null/omitted
                  = keep), so once one is set the picker has no placeholder —
                  and with it no ✕ — to clear back to. */}
              <SearchSelect placeholder={enquiry.advisorGuid ? undefined : '— unassigned —'} options={advisorOptions} value={advisorGuid} onChange={v => { setAdvisorGuid(v); setErrors(prev => ({ ...prev, advisorGuid: '' })) }} />
              {errors.advisorGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.advisorGuid}</p>}
            </div>
            <div className="fg">
              <div className="lbl">Programme</div>
              <SearchSelect
                placeholder="— select —"
                options={programOptions}
                value={programGuid}
                onChange={setProgramGuid}
                onSearch={setProgramSearch}
                onOpenChange={setProgramPickerOpen}
                isLoading={programQuery.isLoading}
                hasNextPage={programQuery.hasNextPage}
                isFetchingNextPage={programQuery.isFetchingNextPage}
                onLoadMore={() => programQuery.fetchNextPage()}
              />
            </div>
            <div className="fg">
              <div className="lbl">Campus <span className="req">*</span></div>
              <SearchSelect
                placeholder="— select —"
                options={campusOptions}
                value={campusGuid}
                onChange={val => { setCampusGuid(val); if (errors.campusGuid) setErrors(p => ({ ...p, campusGuid: '' })) }}
              />
              {errors.campusGuid && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.campusGuid}</p>}
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
