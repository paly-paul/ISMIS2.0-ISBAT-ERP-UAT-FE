'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { ApplicationListItem } from '@/hooks/admission/useApplicationFiling'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useCountries } from '@/hooks/config/useCountries'
import { applicantProfileHref } from '@/lib/applicantProfileLink'

interface ViewApplicantModalProps extends Partial<ModalProps> {
  isOpen: boolean
  onClose: () => void
  applicant: ApplicationListItem | null
}

function genderLabel(g: number | null): string {
  if (g === 0) return 'Male'
  if (g === 1) return 'Female'
  if (g === 2) return 'Other'
  return g != null ? String(g) : '—'
}

function saveStatusBadge(status: number | null) {
  if (status === null) return <span className="badge badge-grey">—</span>
  return <span className="badge badge-blue">Status {status}</span>
}

function Field({
  label,
  value,
  mono,
  badge,
  wide,
}: {
  label: string
  value?: React.ReactNode
  mono?: boolean
  badge?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div
        style={{
          fontSize: '11.5px',
          fontWeight: 600,
          color: 'var(--g500)',
          letterSpacing: '0.04em',
          marginBottom: '5px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className={mono ? 'font-mono' : undefined}
        style={{
          fontSize: '13.5px',
          color: 'var(--g900)',
          fontWeight: 500,
          minHeight: '22px',
          display: 'flex',
          alignItems: 'center',
          wordBreak: 'break-word',
        }}
      >
        {badge || value || '—'}
      </div>
    </div>
  )
}

export function ViewApplicantModal({ isOpen, onClose, applicant }: ViewApplicantModalProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'application' | 'documents'>('personal')

  const { data: programs = [] } = useProgramMasters()
  const { data: campuses = [] } = useCampuses()
  const { data: countries = [] } = useCountries()

  if (!isOpen || !applicant) return null

  const fullName = `${applicant.firstName ?? ''}${applicant.lastName ? ` ${applicant.lastName}` : ''}`.trim() || '—'
  const programName = programs.find(p => p.programGuid === applicant.programGuid)?.programName ?? '—'
  const campusName = campuses.find(c => c.campusGuid === applicant.campusGuid)?.campusName ?? '—'
  const countryName = countries.find(c => c.countryGuid === applicant.countryGuid)?.countryName ?? '—'
  const spCountryName = countries.find(c => c.countryGuid === applicant.spCountryGuid)?.countryName ?? '—'

  const profileUrl = applicantProfileHref({
    ref: applicant.appRefNo,
    name: fullName !== '—' ? fullName : applicant.appRefNo,
    programme: programName !== '—' ? programName : undefined,
    dob: applicant.dob ?? undefined,
    gender: applicant.gender != null ? String(applicant.gender) : undefined,
    nationality: countryName !== '—' ? countryName : undefined,
    nationalId: applicant.nationalId ?? undefined,
    phone: applicant.phone ?? undefined,
    email: applicant.emailId ?? undefined,
    intake: applicant.intakeCode ?? undefined,
    campus: campusName !== '—' ? campusName : undefined,
    submitted: applicant.createdDate,
  })

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div
        className="modal modal-80 modal-flex"
        style={{ height: 'auto', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2">
            <i className="lni lni-eye" /> View Applicant Details —{' '}
            <span className="font-mono">{applicant.appRefNo}</span>
            {applicant.saveStatus != null && (
              <span className="badge badge-blue" style={{ fontSize: 11, marginLeft: 6 }}>
                Status {applicant.saveStatus}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <i className="lni lni-close" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Horizontal Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--g200)',
              padding: '0 24px',
              gap: 0,
              background: '#fafafa',
              flexShrink: 0,
            }}
          >
            <div
              onClick={() => setActiveTab('personal')}
              style={{
                flex: 1,
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 0',
                background: activeTab === 'personal' ? 'var(--b50)' : 'transparent',
                borderBottom: activeTab === 'personal' ? '2px solid var(--b500)' : '2px solid transparent',
                color: activeTab === 'personal' ? 'var(--b700)' : 'var(--g600)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <i className="lni lni-user" style={{ fontSize: 16 }} />
              Personal Information
            </div>

            <div
              onClick={() => setActiveTab('application')}
              style={{
                flex: 1,
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 0',
                background: activeTab === 'application' ? 'var(--b50)' : 'transparent',
                borderBottom: activeTab === 'application' ? '2px solid var(--b500)' : '2px solid transparent',
                color: activeTab === 'application' ? 'var(--b700)' : 'var(--g600)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <i className="lni lni-clipboard" style={{ fontSize: 16 }} />
              Application &amp; Academic
            </div>

            <div
              onClick={() => setActiveTab('documents')}
              style={{
                flex: 1,
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '14px 0',
                background: activeTab === 'documents' ? 'var(--b50)' : 'transparent',
                borderBottom: activeTab === 'documents' ? '2px solid var(--b500)' : '2px solid transparent',
                color: activeTab === 'documents' ? 'var(--b700)' : 'var(--g600)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <i className="lni lni-files" style={{ fontSize: 16 }} />
              Documents &amp; Sponsor
            </div>
          </div>

          {/* Modal Scroll Content */}
          <div className="modal-scroll" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            {/* TAB 1: Personal Information */}
            {activeTab === 'personal' && (
              <div>
                <div className="sec-divider" style={{ marginTop: 0 }}>Identity Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '18px', marginBottom: 28 }}>
                  <Field label="First Name" value={applicant.firstName} />
                  <Field label="Last Name" value={applicant.lastName} />
                  <Field label="Date of Birth" value={applicant.dob ? applicant.dob.slice(0, 10) : '—'} />
                  <Field label="Gender" value={genderLabel(applicant.gender)} />
                  <Field label="Country / Nationality" value={countryName} />
                  <Field label="National ID" value={applicant.nationalId} />
                  <Field label="Passport Number" value={applicant.passportNo} />
                  <Field
                    label="Refugee Status"
                    value={applicant.refugee === 1 ? `Yes (ID: ${applicant.refugeeId || '—'})` : 'No'}
                  />
                </div>

                <div className="sec-divider">Contact Information</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '18px' }}>
                  <Field label="Phone Number" value={applicant.phone} />
                  <Field label="WhatsApp Number" value={applicant.whatsApp} />
                  <Field label="Primary Email" value={applicant.emailId} />
                  <Field label="University Email" value={applicant.universityEmail} />
                </div>
              </div>
            )}

            {/* TAB 2: Application Details */}
            {activeTab === 'application' && (
              <div>
                <div className="sec-divider" style={{ marginTop: 0 }}>Academic Application</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '18px', marginBottom: 28 }}>
                  <Field label="Application Reference No." value={applicant.appRefNo} mono />
                  <Field label="Programme" value={programName} />
                  <Field label="Intake Code" value={applicant.intakeCode} />
                  <Field label="Year Code" value={applicant.yearCode} />
                  <Field label="Campus" value={campusName} />
                  <Field label="Save Status" badge={saveStatusBadge(applicant.saveStatus)} />
                </div>

                <div className="sec-divider">Timeline &amp; Verification</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '18px' }}>
                  <Field
                    label="Created Date"
                    value={applicant.createdDate ? applicant.createdDate.slice(0, 10) : '—'}
                  />
                  <Field
                    label="Modified Date"
                    value={applicant.modifiedDate ? applicant.modifiedDate.slice(0, 10) : '—'}
                  />
                  <Field
                    label="Documents Verified"
                    value={applicant.docVerified ? `Yes (${applicant.verifiedDate?.slice(0, 10) || ''})` : 'Pending'}
                  />
                  {applicant.docRemarks && (
                    <Field label="Document Remarks" value={applicant.docRemarks} wide />
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Documents & Sponsor */}
            {activeTab === 'documents' && (
              <div>
                <div className="sec-divider" style={{ marginTop: 0 }}>Uploaded Document Files</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '20px', rowGap: '16px', marginBottom: 28 }}>
                  <div className="card" style={{ padding: 14, background: 'var(--g50)', border: '1px solid var(--g200)' }}>
                    <div className="text-xs font-semibold text-g600 mb-1 flex items-center gap-1.5">
                      <i className="lni lni-id-card text-b600" /> National ID Document
                    </div>
                    <div className="text-sm font-medium text-g800">
                      {applicant.idUserFileName ? (
                        <span className="font-mono text-xs text-b700">{applicant.idUserFileName}</span>
                      ) : (
                        <span className="text-g400 italic">Not uploaded</span>
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 14, background: 'var(--g50)', border: '1px solid var(--g200)' }}>
                    <div className="text-xs font-semibold text-g600 mb-1 flex items-center gap-1.5">
                      <i className="lni lni-passport text-b600" /> Passport Document
                    </div>
                    <div className="text-sm font-medium text-g800">
                      {applicant.passUserFileName ? (
                        <span className="font-mono text-xs text-b700">{applicant.passUserFileName}</span>
                      ) : (
                        <span className="text-g400 italic">Not uploaded</span>
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 14, background: 'var(--g50)', border: '1px solid var(--g200)' }}>
                    <div className="text-xs font-semibold text-g600 mb-1 flex items-center gap-1.5">
                      <i className="lni lni-files text-b600" /> Visa Document
                    </div>
                    <div className="text-sm font-medium text-g800">
                      {applicant.visaUserFileName ? (
                        <span className="font-mono text-xs text-b700">{applicant.visaUserFileName}</span>
                      ) : (
                        <span className="text-g400 italic">Not uploaded</span>
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 14, background: 'var(--g50)', border: '1px solid var(--g200)' }}>
                    <div className="text-xs font-semibold text-g600 mb-1 flex items-center gap-1.5">
                      <i className="lni lni-image text-b600" /> Student Photo
                    </div>
                    <div className="text-sm font-medium text-g800">
                      {applicant.studUserFileName ? (
                        <span className="font-mono text-xs text-b700">{applicant.studUserFileName}</span>
                      ) : (
                        <span className="text-g400 italic">Not uploaded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sec-divider">Sponsor Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: '24px', rowGap: '18px' }}>
                  <Field label="Sponsor Name" value={applicant.spName} />
                  <Field label="Sponsor Email" value={applicant.spEmail} />
                  <Field label="Sponsor Phone" value={applicant.spPhone} />
                  <Field label="Sponsor Country" value={spCountryName} />
                </div>

                {(applicant.ref1Name || applicant.ref2Name) && (
                  <>
                    <div className="sec-divider mt-4">References</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '24px', rowGap: '18px' }}>
                      {applicant.ref1Name && (
                        <Field
                          label="Reference 1"
                          value={`${applicant.ref1Name}${applicant.ref1Phone ? ` (${applicant.ref1Phone})` : ''}${applicant.ref1Org ? ` · ${applicant.ref1Org}` : ''}`}
                        />
                      )}
                      {applicant.ref2Name && (
                        <Field
                          label="Reference 2"
                          value={`${applicant.ref2Name}${applicant.ref2Phone ? ` (${applicant.ref2Phone})` : ''}${applicant.ref2Org ? ` · ${applicant.ref2Org}` : ''}`}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            borderTop: '1px solid var(--g200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
          }}
        >
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-b600 hover:text-b800 font-semibold text-xs"
          >
            <i className="lni lni-external-link" /> View Full Profile Page
          </a>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
