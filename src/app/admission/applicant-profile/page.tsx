'use client'
import { Suspense, useLayoutEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab = 'personal' | 'application' | 'qualification' | 'documents'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'personal',     label: 'Personal Information', icon: 'lni-user-4' },
  { id: 'application',  label: 'Application Details',  icon: 'lni-clipboard' },
  { id: 'qualification', label: 'Qualification',       icon: 'lni-graduation' },
  { id: 'documents',    label: 'Documents',            icon: 'lni-folder-2' },
]

const MOCK_QUALIFICATION = {
  type: 'A-Level (UACE)',
  institution: 'Kampala S.S.',
  year: '2023',
  indexNo: 'U1234/056',
  percentage: '14 Points',
  duration: '2 Years',
}

const MOCK_DOCUMENTS = [
  { label: 'O-Level Certificate', icon: 'lni-certificate', status: 'Uploaded' },
  { label: 'A-Level Certificate', icon: 'lni-certificate', status: 'Uploaded' },
  { label: 'Passport Photo',      icon: 'lni-image',       status: 'Uploaded' },
  { label: 'National ID',         icon: 'lni-id-card',     status: 'Pending'  },
]

function getParam(searchParams: URLSearchParams, key: string, fallback = '—') {
  return searchParams.get(key) || fallback
}

function ApplicantProfileContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('personal')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab])

  const name        = getParam(searchParams, 'name', 'Unknown Applicant')
  const ref         = getParam(searchParams, 'ref')
  const programme   = getParam(searchParams, 'programme')
  const type        = getParam(searchParams, 'type')
  const dob         = getParam(searchParams, 'dob')
  const gender      = getParam(searchParams, 'gender')
  const nationality = getParam(searchParams, 'nationality')
  const nationalId  = getParam(searchParams, 'nationalId')
  const phone       = getParam(searchParams, 'phone')
  const email       = getParam(searchParams, 'email')
  const intake      = getParam(searchParams, 'intake')
  const campus      = getParam(searchParams, 'campus')
  const submitted   = getParam(searchParams, 'submitted')

  const [firstName, ...rest] = name.split(' ')
  const lastName = rest.join(' ')
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '—'

  return (
    <div id="page-applicant-profile">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Applicant Profile</div>
          <div className="pg-sub">Read-only view &middot; captured during Application Filing</div>
        </div>
        <button className="btn btn-neu" onClick={() => router.push('/admission/dashboard')}>
          <i className="lni lni-arrow-left" /> Back to Admission
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center rounded-full font-bold text-white shrink-0" style={{ width: 64, height: 64, background: 'var(--b500)', fontSize: 22 }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg text-g900">{name}</div>
            <div className="text-sm text-g500">{programme}{type !== '—' && ` · ${type}`}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ref !== '—' && <span className="badge badge-blue font-mono">{ref}</span>}
            {campus !== '—' && <span className="badge badge-grey">{campus}</span>}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              ref={el => { if (el) tabRefs.current[t.id] = el }}
              className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <i className={`lni ${t.icon}`} /> {t.label}
            </button>
          ))}
          <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
        </div>

        <div key={activeTab} className="p-5 tab-panel-in">
          {activeTab === 'personal' && (
            <div className="g3">
              <div className="fg"><label className="lbl">First Name</label><input className="ctrl" readOnly value={firstName || ''} /></div>
              <div className="fg"><label className="lbl">Last Name</label><input className="ctrl" readOnly value={lastName || '—'} /></div>
              <div className="fg"><label className="lbl">Date of Birth</label><input className="ctrl" readOnly value={dob} /></div>
              <div className="fg"><label className="lbl">Gender</label><input className="ctrl" readOnly value={gender} /></div>
              <div className="fg"><label className="lbl">Nationality</label><input className="ctrl" readOnly value={nationality} /></div>
              <div className="fg"><label className="lbl">National ID</label><input className="ctrl" readOnly value={nationalId} /></div>
              <div className="fg"><label className="lbl">Phone</label><input className="ctrl" readOnly value={phone} /></div>
              <div className="fg"><label className="lbl">Email</label><input className="ctrl" readOnly value={email} /></div>
            </div>
          )}

          {activeTab === 'application' && (
            <div className="g3">
              <div className="fg"><label className="lbl">App. Ref</label><input className="ctrl font-mono" readOnly value={ref} /></div>
              <div className="fg"><label className="lbl">Admission Type</label><input className="ctrl" readOnly value={type} /></div>
              <div className="fg"><label className="lbl">Programme</label><input className="ctrl" readOnly value={programme} /></div>
              <div className="fg"><label className="lbl">Intake</label><input className="ctrl" readOnly value={intake} /></div>
              <div className="fg"><label className="lbl">Campus</label><input className="ctrl" readOnly value={campus} /></div>
              <div className="fg"><label className="lbl">Submitted</label><input className="ctrl" readOnly value={submitted} /></div>
            </div>
          )}

          {activeTab === 'qualification' && (
            <div className="g3">
              <div className="fg"><label className="lbl">Type</label><input className="ctrl" readOnly value={MOCK_QUALIFICATION.type} /></div>
              <div className="fg"><label className="lbl">Institution</label><input className="ctrl" readOnly value={MOCK_QUALIFICATION.institution} /></div>
              <div className="fg"><label className="lbl">Year</label><input className="ctrl" readOnly value={MOCK_QUALIFICATION.year} /></div>
              <div className="fg"><label className="lbl">Index No.</label><input className="ctrl" readOnly value={MOCK_QUALIFICATION.indexNo} /></div>
              <div className="fg"><label className="lbl">Percentage / GPA</label><input className="ctrl" readOnly value={MOCK_QUALIFICATION.percentage} /></div>
              <div className="fg"><label className="lbl">Duration</label><input className="ctrl" readOnly value={MOCK_QUALIFICATION.duration} /></div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {MOCK_DOCUMENTS.map(doc => (
                <div key={doc.label} className="border border-g200 bg-white rounded-[10px] overflow-hidden">
                  <div className="h-20 flex items-center justify-center bg-b50">
                    <i className={`lni ${doc.icon} text-b500 text-2xl`} />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-g800 mb-1">{doc.label}</p>
                    <span className={`badge ${doc.status === 'Uploaded' ? 'badge-green' : 'badge-amber'}`}>{doc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ApplicantProfilePage() {
  return (
    <Suspense>
      <ApplicantProfileContent />
    </Suspense>
  )
}
