'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import { applicantProfileHref } from '@/lib/applicantProfileLink'
import { useRegistrationDetail, useRegistrationTypes, useRegisterStudent, RegisterStudentResponse } from '@/hooks/admission/useRegistrarDesk'
import { AuthError } from '@/lib/api/client'

interface Props extends ModalProps {
  applicationGuid: string | null
  onRegistered: (result: RegisterStudentResponse) => void
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

// Real now — per registrar-desk-api-docs.html. Admission Type and Address
// are deliberately dropped from both cards (frontend notes: not part of
// this view). Everything under "Registration Payment Details" renders as
// plain read-only labels, never as pickers — it's a record of a payment
// already made in Payment Console, not a form filled in here. The only
// genuinely editable fields are Registration Type, Aptech, and Refugee/
// Refugee ID — the actual POST /register body.
export function CompleteRegistrationModal({ isOpen, onClose, showToast, applicationGuid, onRegistered }: Props) {
  const { data: detail, isLoading, isError, error } = useRegistrationDetail(applicationGuid, isOpen && !!applicationGuid)
  const { data: registrationTypes = [] } = useRegistrationTypes()
  const registerStudent = useRegisterStudent()

  const [registrationTypeId, setRegistrationTypeId] = useState('')
  const [isRefugee, setIsRefugee] = useState(false)
  const [refugeeId, setRefugeeId] = useState('')
  const [aptech, setAptech] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Prefill from whatever's already on file for this application — the
  // registrar can still change these before submitting.
  useEffect(() => {
    if (!isOpen || !detail) return
    setIsRefugee(detail.refugee)
    setRefugeeId(detail.refugeeId ?? '')
    setRegistrationTypeId('')
    setAptech(false)
    setFailure(null)
  }, [isOpen, detail])

  if (!isOpen || !applicationGuid) return null

  function handleClose() {
    setRegistrationTypeId(''); setIsRefugee(false); setRefugeeId(''); setAptech(false); setFailure(null)
    onClose()
  }

  const registrationTypeOptions = registrationTypes.map(t => ({ value: String(t.intType), label: t.registrationType }))

  function handleSubmit() {
    if (!applicationGuid) return
    if (!registrationTypeId) { showToast('Please select a Registration Type', 'error'); return }
    if (isRefugee && !refugeeId.trim()) { showToast('Please enter the Refugee ID', 'error'); return }
    registerStudent.mutate(
      {
        applicationGuid,
        input: {
          registrationTypeId: +registrationTypeId,
          isRefugee,
          refugeeId: isRefugee ? refugeeId.trim() : null,
          aptech,
        },
      },
      {
        onSuccess: result => onRegistered(result),
        onError: (err: Error) => {
          const code = err instanceof AuthError ? err.code : undefined
          setFailure(err.message || `Failed to register student${code ? ` (${code})` : ''}. Please try again.`)
        },
      },
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 420 }}>
          <FailurePopup title="Couldn't Register Student" subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 420 }}>
          <FailurePopup
            title="Couldn't Load Registration Detail"
            subtitle={error instanceof AuthError ? (error.message || 'Failed to load registration details.') : 'Failed to load registration details.'}
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
            <div className="modal-title"><i className="lni lni-pencil"></i> Completing Registration</div>
            <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
            <span style={{ color: 'var(--g400)' }}>Loading registration details…</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2">
            <i className="lni lni-pencil"></i> Completing Registration: <span className="text-b600">{detail.studentName}</span>
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="modal-scroll">
          <div className="g2" style={{ gap: 28, alignItems: 'start' }}>
            {/* LEFT: Application detail (read-only, real) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-g700"><i className="lni lni-user mr-1" /> Student Profile</h3>
                <a
                  href={applicantProfileHref({
                    ref: detail.appRefNo,
                    name: detail.studentName,
                    programme: detail.programName ?? undefined,
                    dob: detail.dob ?? undefined,
                    gender: detail.gender ?? undefined,
                    nationality: detail.nationality ?? undefined,
                    nationalId: detail.nationalId ?? undefined,
                    phone: detail.phone ?? undefined,
                    email: detail.emailId ?? undefined,
                    intake: detail.intakeCode ?? undefined,
                    campus: detail.campusName ?? undefined,
                    submitted: detail.submitted,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--fs-xs)', color: 'var(--b600)', fontWeight: 600 }}
                >
                  <i className="lni lni-external-link" /> View Full Profile
                </a>
              </div>

              {/* Admission Type dropped from this card per
                  registrar-desk-api-docs.html's frontend notes. */}
              <div className="sec-divider">Personal Information</div>
              <div className="g2 mb-4">
                <div className="fg"><label className="lbl">First Name</label><input className="ctrl" readOnly value={detail.firstName ?? ''} /></div>
                <div className="fg"><label className="lbl">Last Name</label><input className="ctrl" readOnly value={detail.lastName ?? '—'} /></div>
                <div className="fg"><label className="lbl">Date of Birth</label><input className="ctrl" readOnly value={fmtDate(detail.dob)} /></div>
                <div className="fg"><label className="lbl">Gender</label><input className="ctrl" readOnly value={detail.gender ?? '—'} /></div>
                <div className="fg"><label className="lbl">Nationality</label><input className="ctrl" readOnly value={detail.nationality ?? '—'} /></div>
                <div className="fg"><label className="lbl">National ID</label><input className="ctrl" readOnly value={detail.nationalId ?? '—'} /></div>
                <div className="fg"><label className="lbl">Phone</label><input className="ctrl" readOnly value={detail.phone ?? '—'} /></div>
                <div className="fg"><label className="lbl">Email</label><input className="ctrl" readOnly value={detail.emailId ?? '—'} /></div>
              </div>

              {/* Admission Type dropped from this card too — same field,
                  second card, also not needed here per the frontend notes. */}
              <div className="sec-divider">Application Details</div>
              <div className="g2">
                <div className="fg"><label className="lbl">App. Ref</label><input className="ctrl font-mono" readOnly value={detail.appRefNo} /></div>
                <div className="fg"><label className="lbl">Programme</label><input className="ctrl" readOnly value={detail.programName ?? '—'} /></div>
                <div className="fg"><label className="lbl">Intake</label><input className="ctrl" readOnly value={detail.intakeCode ?? '—'} /></div>
                <div className="fg"><label className="lbl">Campus</label><input className="ctrl" readOnly value={detail.campusName ?? '—'} /></div>
                <div className="fg"><label className="lbl">Submitted</label><input className="ctrl" readOnly value={fmtDate(detail.submitted)} /></div>
                {/* Read-only per the frontend notes — pre-assigned by
                    admissions, not chosen here. */}
                <div className="fg"><label className="lbl">Semester</label><input className="ctrl" readOnly value={detail.semesterName ?? '—'} /></div>
                <div className="fg"><label className="lbl">Batch</label><input className="ctrl" readOnly value={detail.batchName ?? '—'} /></div>
              </div>
            </div>

            {/* RIGHT: Fees, registration payment readiness, and the actual
                editable Register form */}
            <div>
              <div className="sec-divider">Fees &amp; Ledger Lines</div>
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex justify-between text-sm"><span className="text-g600">Admission Fee</span><span className="font-semibold text-g800">{detail.admissionFee != null ? detail.admissionFee.toLocaleString() : '—'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-g600">Registration Fee</span><span className="font-semibold text-g800">{detail.regFee != null ? detail.regFee.toLocaleString() : '—'}</span></div>
              </div>
              {detail.feeLines.length > 0 && (
                <div className="flex flex-col gap-1 mb-4" style={{ border: '1.5px solid var(--g200)', borderRadius: 'var(--rsm)', padding: '8px 12px' }}>
                  {detail.feeLines.map(line => (
                    <div key={line.ledgerGuid} className="flex justify-between text-sm">
                      <span className="text-g600">{line.ledgerName}</span>
                      <span className="font-medium text-g800">{line.amount.toLocaleString()} {line.currencyName}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="sec-divider">Registration Payment Details</div>
              <div className="g2 mb-4">
                <div className="fg m-0"><label className="lbl">Payment Type</label><input className="ctrl" readOnly value={detail.regPaymentTypeName ?? '—'} /></div>
                <div className="fg m-0"><label className="lbl">Receipt Book</label><input className="ctrl" readOnly value={detail.regReceiptBookCode ?? '—'} /></div>
                <div className="fg m-0"><label className="lbl">Receipt No.</label><input className="ctrl" readOnly value={detail.regReceiptNo ?? '—'} /></div>
                <div className="fg m-0"><label className="lbl">Amount Paid</label><input className="ctrl" readOnly value={detail.regPaymentAmount != null ? detail.regPaymentAmount.toLocaleString() : '—'} /></div>
                <div className="fg m-0"><label className="lbl">Payment Date</label><input className="ctrl" readOnly value={fmtDate(detail.regPaymentDate)} /></div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`badge ${detail.registrationFeeConfirmed ? 'badge-green' : 'badge-red'}`}>{detail.registrationFeeConfirmed ? 'Reg. Fee Confirmed' : 'Reg. Fee Not Confirmed'}</span>
                <span className={`badge ${detail.provisionalLetterIssued ? 'badge-green' : 'badge-grey'}`}>{detail.provisionalLetterIssued ? 'Provisional Letter Issued' : 'Letter Not Issued'}</span>
                <span className={`badge ${detail.academicDocumentsVerified ? 'badge-green' : 'badge-amber'}`}>{detail.academicDocumentsVerified ? 'Documents Verified' : 'Documents Pending'}</span>
              </div>
              {!detail.registrationFeeConfirmed && (
                <div className="warn-box mb-4">
                  <i className="lni lni-warning mr-2" />
                  <span className="text-sm">Registration Fee isn&apos;t confirmed yet — the server will reject registration until Payment Console shows it as paid.</span>
                </div>
              )}

              <p className="text-xs font-bold uppercase tracking-wide mt-2 mb-2" style={{ color: 'var(--b600)' }}>Register Student</p>
              {registrationTypeOptions.length === 0 && (
                <div className="warn-box mb-3">
                  <i className="lni lni-warning mr-2" />
                  <span className="text-sm">No Registration Types are configured yet — an administrator needs to set these up in Registration Type Master before this application can be registered.</span>
                </div>
              )}
              <div className="fg">
                <label className="lbl">Registration Type <span className="req">*</span></label>
                <SearchSelect placeholder="-- Select Registration Type --" options={registrationTypeOptions} value={registrationTypeId} onChange={setRegistrationTypeId} />
              </div>

              <label className="flex items-center gap-2 mt-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={aptech} onChange={e => setAptech(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span className="font-medium text-g700">Aptech Credit Exemption Student?</span>
              </label>

              <label className="flex items-center gap-2 mt-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={isRefugee} onChange={e => setIsRefugee(e.target.checked)} style={{ width: 16, height: 16 }} />
                <span className="font-medium text-g700">Refugee Student?</span>
              </label>
              {isRefugee && (
                <div className="fg mt-2">
                  <label className="lbl">Refugee ID <span className="req">*</span></label>
                  <input className="ctrl" placeholder="Refugee ID number" value={refugeeId} onChange={e => setRefugeeId(e.target.value)} />
                </div>
              )}

              <button
                className="btn btn-success w-full mt-4"
                disabled={registerStudent.isPending}
                onClick={handleSubmit}
              >
                <i className="lni lni-checkmark-circle mr-1" /> {registerStudent.isPending ? 'Registering…' : 'Complete Registration & Onboard Student'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
