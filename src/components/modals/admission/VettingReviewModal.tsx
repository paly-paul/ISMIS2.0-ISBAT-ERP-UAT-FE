'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { applicantProfileHref } from '@/lib/applicantProfileLink'
import { useVettingApplicationDetail, useWaitApplication } from '@/hooks/admission/useVetting'
import { VetApplicationInput } from '@/lib/api/admission/vetting'
import { AuthError } from '@/lib/api/client'

// A friendlier label than the raw documentType string from the wire
// ("NationalId" → "National ID").
const DOCUMENT_LABELS: Record<string, string> = {
  NationalId: 'National ID',
  Passport: 'Passport',
  Visa: 'Visa',
  Photo: 'Passport Photo',
}

interface Props extends ModalProps {
  applicationGuid: string | null
  vetApplication: {
    mutate: (variables: { applicationGuid: string; input: VetApplicationInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  onReject: () => void
}

export function VettingReviewModal({ isOpen, onClose, showToast, applicationGuid, vetApplication, onReject }: Props) {
  const { data: detail, isLoading, isError, error } = useVettingApplicationDetail(applicationGuid, isOpen)
  const waitApplication = useWaitApplication()

  const [remarks, setRemarks] = useState('')
  const [approved, setApproved] = useState(false)
  const [waited, setWaited] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!isOpen || !applicationGuid) return null

  function handleClose() { setApproved(false); setWaited(false); setFailure(null); setRemarks(''); onClose() }

  function handleWait() {
    if (!applicationGuid) return
    waitApplication.mutate(
      { applicationGuid, remarks: remarks.trim() || null },
      {
        onSuccess: () => { setWaited(true); showToast('Applicant placed on hold — waiting for original documents', 'amber') },
        onError: (err: Error) => setFailure(err.message || 'Failed to place application on hold.'),
      },
    )
  }

  function handleApprove() {
    if (!applicationGuid) return
    vetApplication.mutate(
      // action: 2 = Approved — RegistrarDecision now matches the persisted
      // status enum's own numbering (2=Approved, 3=Rejected), not the old
      // separate 1/2 request-side enum.
      { applicationGuid, input: { action: 2, justificationReg: null } },
      {
        onSuccess: () => setApproved(true),
        onError: (err: Error) => setFailure(err.message || 'Failed to approve application.'),
      },
    )
  }

  if (approved && detail) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Application Approved!" subtitle={`${detail.firstName} ${detail.lastName}'s provisional admission letter has been issued.`} onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (waited && detail) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Application On Hold" subtitle={`${detail.firstName} ${detail.lastName} is now waiting on original documents.`} onClose={handleClose} />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title="Action Failed" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup
            title="Couldn't Load Application"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load application details.') : 'Failed to load application details.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (isLoading || !detail) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          <div className="modal-hdr modal-hdr-blue">
            <div className="modal-title"><i className="lni lni-eye"></i> Reviewing Application</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <span style={{ color: 'var(--g400)' }}>Loading application details…</span>
          </div>
        </div>
      </div>
    )
  }

  const missingDocs = detail.documents.filter(d => !d.uploaded)

  return (
    <div className="modal-overlay open">
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2">
            <i className="lni lni-eye"></i> Reviewing: {detail.firstName} {detail.lastName} &middot; {detail.programName}
            <span className="badge badge-blue">{detail.admissionType}</span>
          </div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">
          <div className="g2" style={{ gap: 28, alignItems: 'start' }}>
            {/* LEFT: Applicant Profile */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-g700"><i className="lni lni-user mr-1" /> Applicant Profile</h3>
                <a
                  href={applicantProfileHref({
                    ref: detail.appRefNo,
                    name: `${detail.firstName} ${detail.lastName}`,
                    programme: detail.programName,
                    type: detail.admissionType,
                    dob: detail.dob ?? undefined,
                    gender: detail.gender != null ? String(detail.gender) : undefined,
                    nationality: detail.nationality ?? undefined,
                    nationalId: detail.nationalId ?? undefined,
                    phone: detail.phone ?? undefined,
                    email: detail.emailId ?? undefined,
                    intake: detail.intakeCode,
                    campus: detail.campusName,
                    submitted: detail.submittedDate,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--fs-xs)', color: 'var(--b600)', fontWeight: 600 }}
                >
                  <i className="lni lni-external-link" /> View Full Profile
                </a>
              </div>

              <div className="sec-divider">Personal Information</div>
              <div className="g2 mb-4">
                <div className="fg"><label className="lbl">First Name</label><input className="ctrl" readOnly value={detail.firstName || ''} /></div>
                <div className="fg"><label className="lbl">Last Name</label><input className="ctrl" readOnly value={detail.lastName || '—'} /></div>
                <div className="fg"><label className="lbl">Date of Birth</label><input className="ctrl" readOnly value={detail.dob ? detail.dob.slice(0, 10) : '—'} /></div>
                {/* Confirmed via a real response: a raw int (e.g. 0), not the
                    "Male"/"Female"/"Other" string the docs describe — no
                    confirmed label mapping, so this displays the raw code
                    rather than guessing one (just without the "(code)"
                    suffix in the label itself, per request). */}
                <div className="fg"><label className="lbl">Gender</label><input className="ctrl" readOnly value={detail.gender != null ? String(detail.gender) : '—'} /></div>
                {/* Nationality is confirmed always null on the wire today — shown for
                    completeness, not expected to have a value yet (see vetting.ts). */}
                <div className="fg"><label className="lbl">Nationality</label><input className="ctrl" readOnly value={detail.nationality || '—'} /></div>
                <div className="fg"><label className="lbl">National ID</label><input className="ctrl" readOnly value={detail.nationalId || '—'} /></div>
                <div className="fg"><label className="lbl">Phone</label><input className="ctrl" readOnly value={detail.phone || '—'} /></div>
                <div className="fg"><label className="lbl">Email</label><input className="ctrl" readOnly value={detail.emailId || '—'} /></div>
              </div>

              <div className="sec-divider">Application Details</div>
              <div className="g2">
                <div className="fg"><label className="lbl">App. Ref</label><input className="ctrl font-mono" readOnly value={detail.appRefNo || ''} /></div>
                <div className="fg"><label className="lbl">Admission Type</label><input className="ctrl" readOnly value={detail.admissionType || ''} /></div>
                <div className="fg"><label className="lbl">Programme</label><input className="ctrl" readOnly value={detail.programName || ''} /></div>
                <div className="fg"><label className="lbl">Intake</label><input className="ctrl" readOnly value={detail.intakeCode || '—'} /></div>
                <div className="fg"><label className="lbl">Campus</label><input className="ctrl" readOnly value={detail.campusName || '—'} /></div>
                <div className="fg"><label className="lbl">Submitted</label><input className="ctrl" readOnly value={detail.submittedDate ? detail.submittedDate.slice(0, 10) : ''} /></div>
                <div className="fg"><label className="lbl">Fee Paid</label><input className="ctrl" readOnly value={detail.feePaid ? 'Yes' : 'No'} /></div>
              </div>
            </div>

            {/* RIGHT: Review content */}
            <div>
              <h3 className="text-sm font-semibold text-g700 mb-3"><i className="lni lni-folder mr-1" /> Uploaded Documents</h3>
              <div className="grid grid-cols-2 gap-3">
                {detail.documents.map(doc => {
                  const isMissing = !doc.uploaded
                  return (
                    <div key={doc.documentType} className={`border rounded-[10px] overflow-hidden ${isMissing ? 'border-clr-red-bd bg-clr-red-bg' : 'border-g200 bg-white'}`}>
                      <div className={`h-28 flex items-center justify-center ${isMissing ? 'bg-clr-red-bg' : 'bg-b50'}`}>
                        <i className={`lni ${isMissing ? 'lni-question-circle text-clr-red' : 'lni-file text-b500'} text-3xl`} />
                      </div>
                      <div className="p-3">
                        <p className={`text-sm font-medium mb-0.5 ${isMissing ? 'text-red-700' : 'text-g800'}`}>{DOCUMENT_LABELS[doc.documentType] ?? doc.documentType}</p>
                        {isMissing ? <span className="badge badge-red">Missing</span> : (
                          doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm text-xs"><i className="lni lni-eye" /> View</a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <h3 className="text-sm font-semibold text-g700 mb-3 mt-5"><i className="lni lni-book mr-1" /> Qualifications</h3>
              {detail.qualifications.length === 0 ? (
                <p className="text-sm text-g400 mb-4">No qualifications submitted yet.</p>
              ) : (
                <div className="flex flex-col gap-2 mb-4">
                  {detail.qualifications.map(q => (
                    <div key={q.applicationQualGuid} className="flex items-center justify-between border border-g200 rounded-[10px] px-3 py-2">
                      <div>
                        {/* institution is free text by convention only (e.g. "O Level" /
                            "A Level") — there is no separate structured type column. */}
                        <p className="text-sm font-medium text-g800">{q.institution} &middot; {q.university}</p>
                        <p className="text-xs text-g400">Grade {q.grade} &middot; {q.passYear} &middot; {q.yearsTaken} yrs</p>
                      </div>
                      {q.proofUrl
                        ? <a href={q.proofUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm text-xs"><i className="lni lni-eye" /> View Proof</a>
                        : <span className="badge badge-red">No Proof</span>
                      }
                    </div>
                  ))}
                </div>
              )}

              {missingDocs.length > 0 && (
                <div className="warn-box mb-4">
                  <i className="lni lni-warning mr-2 text-amber-700" />
                  <span className="text-sm">{missingDocs.length} document{missingDocs.length > 1 ? 's' : ''} missing ({missingDocs.map(d => DOCUMENT_LABELS[d.documentType] ?? d.documentType).join(', ')}). You may approve provisionally &mdash; student must submit within 7 days.</span>
                </div>
              )}

              <div className="fg">
                <label className="lbl">Vetting Remarks</label>
                <textarea className="ctrl" rows={3} placeholder="Enter notes — used for the Wait action's remarks; Approve/Reject send their own justification separately." value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div className="grid grid-cols-3 gap-3">
            <button className="btn btn-amber w-full justify-center" disabled={waitApplication.isPending} onClick={handleWait}>
              <i className="lni lni-timer" /> {waitApplication.isPending ? 'Saving…' : 'Wait for Original Documents'}
            </button>
            <button className="btn btn-success w-full justify-center" disabled={vetApplication.isPending} onClick={handleApprove}>
              <i className="lni lni-checkmark" /> {vetApplication.isPending ? 'Approving…' : 'Approve & Issue Provisional Letter'}
            </button>
            <button className="btn btn-danger w-full justify-center" onClick={onReject}><i className="lni lni-close" /> Reject Application</button>
          </div>
          <p className="text-xs text-g400 text-center">Sets T_Application.Action = 0 (Wait) / 2 (Approved) / 3 (Rejected)</p>
        </div>
      </div>
    </div>
  )
}
