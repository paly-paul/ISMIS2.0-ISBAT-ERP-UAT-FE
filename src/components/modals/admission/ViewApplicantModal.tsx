'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { ModalProps } from '../types'
import { ApplicationListItem, useApplicationByGuid } from '@/hooks/admission/useApplicationFiling'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { applicantProfileHref } from '@/lib/applicantProfileLink'
import { formatDate } from '@/lib/date'

interface ViewApplicantModalProps extends Partial<ModalProps> {
  isOpen: boolean
  onClose: () => void
  applicant: ApplicationListItem | null
}

type Tab = 'personal' | 'application' | 'documents'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'personal', label: 'Personal Information', icon: 'lni-user' },
  { id: 'application', label: 'Application & Academic', icon: 'lni-clipboard' },
  { id: 'documents', label: 'Documents & Sponsor', icon: 'lni-files' },
]

function genderLabel(g: number | null): string {
  if (g === 0) return 'Male'
  if (g === 1) return 'Female'
  if (g === 2) return 'Other'
  return g != null ? String(g) : '—'
}

// Application Filling's SaveGeneral sends empty optional fields as the
// literal string "null" (see saveGeneral), and the backend stores that as
// text in string columns. Treat it as empty so it shows as "—" and doesn't
// make an empty section (e.g. a reference) look filled in.
function withoutNullText(a: ApplicationListItem): ApplicationListItem {
  const out: Record<string, unknown> = { ...a }
  for (const k of Object.keys(out)) {
    const v = out[k]
    if (typeof v === 'string' && v.trim().toLowerCase() === 'null') out[k] = null
  }
  return out as unknown as ApplicationListItem
}

// Layout, tabs, fields and footer mirror ViewProgrammeModal /
// ViewCourseUnitModal so the View modals read as one family.
function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--g900)', fontWeight: 500, overflowWrap: 'anywhere' }}>{value || '—'}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="sec-divider" style={{ gridColumn: '1 / -1', marginTop: 6, marginBottom: 0 }}>{children}</div>
}

const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', rowGap: 20, columnGap: 24 }
const PANEL_PADDING = '20px clamp(14px, 4vw, 24px)'

export function ViewApplicantModal({ isOpen, onClose, applicant: listRow }: ViewApplicantModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('personal')

  // Full record (get-application-by-guid.md). Completed applications only —
  // an in-progress one 400s, and then the list row is all there is to show.
  const { data: detail, isLoading: detailLoading, isError: detailUnavailable } =
    useApplicationByGuid(listRow?.applicationGuid, isOpen && !!listRow)
  const { data: programs = [] } = useProgramDropdown(undefined, isOpen && !!listRow)

  // Same sliding underline as ViewProgrammeModal.
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, isOpen, listRow, detailLoading])

  if (!isOpen || !listRow) return null

  function handleClose() {
    setActiveTab('personal')
    onClose()
  }

  const header = (
    <div className="modal-hdr modal-hdr-blue">
      <div className="modal-title">
        <i className="lni lni-eye"></i> View Applicant &mdash; <span className="font-mono">{listRow.appRefNo}</span>
      </div>
      <button className="modal-close" onClick={handleClose} aria-label="Close"><i className="lni lni-close"></i></button>
    </div>
  )

  if (detailLoading) {
    return (
      <div className="modal-overlay open">
        <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
          {header}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <span style={{ color: 'var(--g400)' }}>Loading applicant details…</span>
          </div>
        </div>
      </div>
    )
  }

  // The full record wins field by field; anything it leaves out keeps the
  // list row's value.
  const applicant = withoutNullText(detail ? { ...listRow, ...detail } : listRow)

  // Prefer the server's own name/label fields over raw guids and codes.
  const fullName = `${applicant.firstName ?? ''}${applicant.lastName ? ` ${applicant.lastName}` : ''}`.trim() || '—'
  const programName = applicant.programName || programs.find(p => p.programGuid === applicant.programGuid)?.programName || '—'
  const campusName = applicant.campusName || applicant.campusGuid || '—'
  const countryName = applicant.countryName || applicant.countryGuid || '—'
  const spCountryName = applicant.spCountryName || applicant.spCountryGuid || '—'

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
    submitted: applicant.createdDate ?? undefined,
  })

  const documents = [
    { label: 'National ID Document', icon: 'lni-id-card', file: applicant.idUserFileName },
    { label: 'Passport Document', icon: 'lni-passport', file: applicant.passUserFileName },
    { label: 'Visa Document', icon: 'lni-files', file: applicant.visaUserFileName },
    { label: 'Student Photo', icon: 'lni-image', file: applicant.studUserFileName },
  ]
  const uploadedCount = documents.filter(d => d.file).length

  const reference = (name: string | null, phone: string | null, org: string | null) =>
    `${name}${phone ? ` (${phone})` : ''}${org ? ` · ${org}` : ''}`

  return (
    <div className="modal-overlay open">
      {/* modal-flex's fixed 85vh (no height: auto override) so switching tabs
          doesn't resize the modal — each panel scrolls its own content. */}
      <div className="modal modal-80 modal-flex" onClick={e => e.stopPropagation()}>
        {header}

        <div className="tab-bar" role="tablist" aria-label="Applicant details" style={{ flexShrink: 0, padding: 0, background: 'var(--surface)' }}>
          {TABS.map(t => {
            const active = activeTab === t.id
            const count = t.id === 'documents' ? uploadedCount : 0
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                ref={el => { if (el) tabRefs.current[t.id] = el }}
                className={`tab-btn${active ? ' active' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActiveTab(t.id)}
              >
                <i className={`lni ${t.icon}`} aria-hidden="true" /> {t.label}
                {count > 0 && <span className={`badge ${active ? 'badge-blue' : 'badge-grey'}`}>{count}</span>}
              </button>
            )
          })}
          <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
        </div>

        {/* The by-guid endpoint only returns completed applications. */}
        {detailUnavailable && (
          <div role="status" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px clamp(14px, 4vw, 24px)', background: 'var(--amber-bg)', borderBottom: '1px solid var(--amber-bd)', color: 'var(--g700)', fontSize: 12.5 }}>
            <i className="lni lni-information" style={{ color: 'var(--amber)' }} aria-hidden="true" />
            The full record is only available once the application is completed. Showing the details from the applicants list.
          </div>
        )}

        {/* ── Personal Information ── */}
        {activeTab === 'personal' && (
          <div key="personal" className="modal-scroll tab-panel-in" style={{ padding: PANEL_PADDING }}>
            <div style={GRID}>
              <SectionTitle>Identity Details</SectionTitle>
              <Field label="First Name" value={applicant.firstName} />
              <Field label="Last Name" value={applicant.lastName} />
              <Field label="Date of Birth" value={formatDate(applicant.dob)} />
              <Field label="Gender" value={applicant.genderLabel || genderLabel(applicant.gender)} />
              <Field label="Country / Nationality" value={countryName} />
              <Field label="National ID" value={applicant.nationalId && <span className="font-mono">{applicant.nationalId}</span>} />
              <Field label="Passport Number" value={applicant.passportNo && <span className="font-mono">{applicant.passportNo}</span>} />
              <Field
                label="Refugee Status"
                value={applicant.refugee === 1
                  ? <span className="badge badge-amber">Refugee · ID {applicant.refugeeId || '—'}</span>
                  : 'No'}
              />

              <SectionTitle>Contact Information</SectionTitle>
              <Field label="Phone Number" value={applicant.phone} />
              <Field label="WhatsApp Number" value={applicant.whatsApp} />
              <Field label="Primary Email" value={applicant.emailId} />
              <Field label="University Email" value={applicant.universityEmail} />
            </div>
          </div>
        )}

        {/* ── Application & Academic ── */}
        {activeTab === 'application' && (
          <div key="application" className="modal-scroll tab-panel-in" style={{ padding: PANEL_PADDING }}>
            <div style={GRID}>
              <SectionTitle>Academic Application</SectionTitle>
              <Field label="Application Reference No." value={<span className="font-mono">{applicant.appRefNo}</span>} />
              <Field label="Programme" value={programName} />
              <Field label="Intake Code" value={applicant.intakeCode} />
              <Field label="Year Code" value={applicant.yearCode} />
              <Field label="Campus" value={campusName} />
              <Field
                label="Application Status"
                value={applicant.actionLabel ? <span className="badge badge-blue">{applicant.actionLabel}</span> : '—'}
              />
              <Field
                label="Save Status"
                value={applicant.saveStatusLabel
                  ? <span className="badge badge-grey">{applicant.saveStatusLabel}</span>
                  : applicant.saveStatus != null ? <span className="badge badge-grey">Status {applicant.saveStatus}</span> : '—'}
              />

              <SectionTitle>Timeline &amp; Verification</SectionTitle>
              <Field label="Created Date" value={formatDate(applicant.createdDate)} />
              <Field label="Modified Date" value={formatDate(applicant.modifiedDate)} />
              <Field
                label="Documents Verified"
                value={applicant.docVerified
                  ? <span className="badge badge-green"><i className="lni lni-checkmark" aria-hidden="true" /> Verified{applicant.verifiedDate ? ` · ${formatDate(applicant.verifiedDate)}` : ''}</span>
                  : <span className="badge badge-amber">Pending</span>}
              />
              {applicant.docRemarks && <Field label="Document Remarks" value={applicant.docRemarks} wide />}
            </div>
          </div>
        )}

        {/* ── Documents & Sponsor ── */}
        {activeTab === 'documents' && (
          <div key="documents" className="modal-scroll tab-panel-in" style={{ padding: PANEL_PADDING }}>
            <div style={GRID}>
              <SectionTitle>Uploaded Document Files</SectionTitle>
              <ul style={{ gridColumn: '1 / -1', listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--g200)', borderRadius: 'var(--rsm)' }}>
                {documents.map((d, idx) => (
                  <li key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderBottom: idx < documents.length - 1 ? '1px solid var(--g100)' : 'none', fontSize: 13 }}>
                    <i className={`lni ${d.icon}`} style={{ fontSize: 16, color: d.file ? 'var(--b600)' : 'var(--g300)' }} aria-hidden="true" />
                    <span style={{ fontWeight: 600, color: 'var(--g800)', flexShrink: 0 }}>{d.label}</span>
                    <span style={{ flex: 1 }} />
                    {d.file
                      ? <span className="font-mono" style={{ color: 'var(--b700)', fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.file}>{d.file}</span>
                      : <span className="badge badge-grey">Not uploaded</span>}
                  </li>
                ))}
              </ul>

              <SectionTitle>Sponsor Details</SectionTitle>
              <Field label="Sponsor Name" value={applicant.spName} />
              <Field label="Sponsor Email" value={applicant.spEmail} />
              <Field label="Sponsor Phone" value={applicant.spPhone} />
              <Field label="Sponsor Country" value={spCountryName} />

              {(applicant.ref1Name || applicant.ref2Name) && (
                <>
                  <SectionTitle>References</SectionTitle>
                  {applicant.ref1Name && <Field label="Reference 1" value={reference(applicant.ref1Name, applicant.ref1Phone, applicant.ref1Org)} />}
                  {applicant.ref2Name && <Field label="Reference 2" value={reference(applicant.ref2Name, applicant.ref2Phone, applicant.ref2Org)} />}
                </>
              )}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <span className="text-sm" style={{ color: 'var(--g500)' }}>
            {fullName} · {applicant.intakeCode || 'No intake'} · {uploadedCount} of {documents.length} documents uploaded
          </span>
          <span className="flex-1"></span>
          <a className="btn btn-neu" href={profileUrl} target="_blank" rel="noopener noreferrer">
            <i className="lni lni-external-link" aria-hidden="true"></i> View Full Profile
          </a>
          <button className="btn btn-primary" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
