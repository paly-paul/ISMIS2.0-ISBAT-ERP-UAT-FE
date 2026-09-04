'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { getSessionIdentity } from '@/lib/session'
import { validatePassword } from '@/lib/errorMessages'

// "My Profile" — the signed-in staff user's own account page, reached from
// the header's profile dropdown (see Header.tsx) on every module. There is
// no real "get current user" endpoint yet (session identity only carries
// displayName — see session.ts), so the account/employee fields below are
// seeded once from displayName and otherwise illustrative, same "UI-first
// prototype" convention as every other page in this app (field set mirrors
// ViewEmployeeModal's Personal Details section). Save actions are
// local-only, same convention as student/profile's Personal Information card.
// The photo picker reuses the .prof-photo-zone component already styled in
// globals.css (see odel-student-preview's Personal tab) rather than a new one.

const TABS = [
  { id: 'info', label: 'Profile Info', icon: 'lni-user' },
  { id: 'security', label: 'Security & Access', icon: 'lni-shield' },
] as const
type TabId = typeof TABS[number]['id']

interface SignIn { id: number; device: string; location: string; when: string; current?: boolean }

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export default function ProfilePage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [displayName, setDisplayName] = useState('Administrator')
  const [tab, setTab] = useState<TabId>('info')

  const [photo, setPhoto] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+256 701 234 567')
  const [address, setAddress] = useState('Plot 15, Kansanga Road, Kampala')
  const [emergencyName, setEmergencyName] = useState('Jane Doe (Spouse)')
  const [emergencyPhone, setEmergencyPhone] = useState('+256 772 555 019')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const signIns: SignIn[] = [
    { id: 1, device: 'Chrome on Windows', location: 'Kampala, UG', when: 'Active now', current: true },
    { id: 2, device: 'Safari on iPhone', location: 'Kampala, UG', when: 'Yesterday, 6:42 PM' },
    { id: 3, device: 'Chrome on Windows', location: 'Kampala, UG', when: 'Aug 21, 2026, 9:05 AM' },
  ]

  useEffect(() => {
    const identity = getSessionIdentity()
    const name = identity?.displayName || 'Administrator'
    setDisplayName(name)
    const parts = name.trim().split(/\s+/)
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    setEmail(`${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@isbat.ac.ug`)
  }, [])

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('Photo must be under 2 MB.', 'err')
    const reader = new FileReader()
    reader.onload = ev => { setPhoto(ev.target?.result as string); showToast('Photo updated', 'ok') }
    reader.readAsDataURL(file)
  }

  function handleSaveProfile() {
    setDisplayName(`${firstName} ${lastName}`.trim() || displayName)
    showToast('Profile saved', 'ok')
  }

  function handleChangePassword() {
    const err = validatePassword(newPw)
    if (err) return showToast(err, 'err')
    if (!currentPw) return showToast('Current password is required.', 'err')
    if (newPw !== confirmPw) return showToast('New password and confirmation do not match.', 'err')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    showToast('Password updated', 'ok')
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">My Profile</div><div className="pg-sub">View and manage your account details</div></div>
        </div>

        <div className="stu-banner">
          <div className="stu-banner-top">
            <label className="prof-photo-zone" style={{ width: 52, height: 52, borderRadius: 12, borderColor: 'rgba(255,255,255,.4)', background: 'rgba(255,255,255,.2)' }} title="Change photo">
              <input type="file" accept="image/*" onChange={handlePhoto} />
              {photo
                ? <img className="prof-photo-preview" src={photo} alt="Profile" style={{ display: 'block', borderRadius: 10 }} />
                : <span style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>{initials(displayName)}</span>}
            </label>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stu-banner-name">{displayName}</div>
              <div className="stu-banner-id">AR-2024-0001 · System Administrator</div>
              <div className="stu-banner-pills">
                <span className="stu-pill">✓ Active</span>
                <span className="stu-pill"><i className="lni lni-briefcase"></i> Academic Affairs</span>
                <span className="stu-pill"><i className="lni lni-display"></i> Main Campus</span>
              </div>
            </div>
          </div>
          <div className="stu-meta-row">
            <div className="stu-meta-item"><div className="stu-meta-lbl">Email</div><div className="stu-meta-val">{email}</div></div>
            <div className="stu-meta-item"><div className="stu-meta-lbl">Mobile</div><div className="stu-meta-val">{phone}</div></div>
            <div className="stu-meta-item"><div className="stu-meta-lbl">Department</div><div className="stu-meta-val">Academic Affairs</div></div>
            <div className="stu-meta-item"><div className="stu-meta-lbl">Campus</div><div className="stu-meta-val">Main Campus</div></div>
            <div className="stu-meta-item"><div className="stu-meta-lbl">Member Since</div><div className="stu-meta-val">Jan 2024</div></div>
          </div>
        </div>

        <div className="ptabs">
          {TABS.map(t => (
            <button key={t.id} className={`ptab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              <i className={`lni ${t.icon}`}></i> {t.label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div>
            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-camera"></i> Profile Photo</div></div>
              <div className="prof-photo-row" style={{ paddingTop: 0, borderBottom: 'none', marginBottom: 0 }}>
                <label className={`prof-photo-zone${photo ? ' has-photo' : ''}`}>
                  <input type="file" accept="image/*" onChange={handlePhoto} />
                  <div className="prof-photo-icon"><i className="lni lni-camera"></i><small>Photo</small></div>
                  {photo && <img className="prof-photo-preview" src={photo} alt="Profile preview" />}
                </label>
                <div className="prof-photo-info">
                  <div className="prof-photo-title">{photo ? 'Looking good' : 'Add a profile photo'}</div>
                  <div className="prof-photo-hint">Click the circle or drop a passport-style photo · JPG / PNG · max 2 MB</div>
                </div>
              </div>
            </div>

            <div className="g2">
              <div className="card">
                <div className="card-hdr"><div className="card-title"><i className="lni lni-pencil-alt"></i> Personal Information</div><span className="badge badge-grey">Editable</span></div>
                <div className="g2">
                  <div className="fg"><label className="lbl">First Name <span className="req">*</span></label><input className="ctrl" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                  <div className="fg"><label className="lbl">Last Name <span className="req">*</span></label><input className="ctrl" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                </div>
                <div className="g3">
                  <div className="fg"><label className="lbl">Staff ID</label><input className="ctrl font-mono" readOnly value="AR-2024-0001" /></div>
                  <div className="fg"><label className="lbl">Title</label><input className="ctrl" readOnly value="Mr." /></div>
                  <div className="fg"><label className="lbl">Date of Birth</label><input className="ctrl" readOnly value="14 Mar 1991" /></div>
                </div>
                <div className="g3" style={{ marginBottom: 0 }}>
                  <div className="fg"><label className="lbl">Sex</label><input className="ctrl" readOnly value="Male" /></div>
                  <div className="fg"><label className="lbl">Nationality</label><input className="ctrl" readOnly value="Ugandan" /></div>
                  <div className="fg"><label className="lbl">Marital Status</label><input className="ctrl" readOnly value="Married" /></div>
                </div>
              </div>
              <div className="card">
                <div className="card-hdr"><div className="card-title"><i className="lni lni-home"></i> Contact</div></div>
                <div className="g2">
                  <div className="fg"><label className="lbl">Email <span className="req">*</span></label><input className="ctrl" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="fg"><label className="lbl">Mobile <span className="req">*</span></label><input className="ctrl" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                </div>
                <div className="fg"><label className="lbl">Home Address</label><input className="ctrl" value={address} onChange={e => setAddress(e.target.value)} /></div>
                <div className="g2" style={{ marginBottom: 0 }}>
                  <div className="fg"><label className="lbl">Emergency Contact</label><input className="ctrl" value={emergencyName} onChange={e => setEmergencyName(e.target.value)} /></div>
                  <div className="fg"><label className="lbl">Emergency Phone</label><input className="ctrl" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} /></div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-briefcase"></i> Role &amp; Assignment</div><span className="badge badge-grey">Read-only</span></div>
              <div className="g3">
                <div className="fg"><label className="lbl">Role</label><input className="ctrl" readOnly value="System Administrator" /></div>
                <div className="fg"><label className="lbl">Department</label><input className="ctrl" readOnly value="Academic Affairs" /></div>
                <div className="fg"><label className="lbl">Campus</label><input className="ctrl" readOnly value="Main Campus" /></div>
              </div>
              <div className="g3" style={{ marginBottom: 0 }}>
                <div className="fg"><label className="lbl">Employment Type</label><input className="ctrl" readOnly value="Full-time" /></div>
                <div className="fg"><label className="lbl">Date of Joining</label><input className="ctrl" readOnly value="08 Jan 2024" /></div>
                <div className="fg"><label className="lbl">Reporting To</label><input className="ctrl" readOnly value="Registrar's Office" /></div>
              </div>
              <div className="fg" style={{ marginBottom: 0 }}>
                <label className="lbl">Approval Status</label>
                <div style={{ marginTop: 4 }}><span className="badge badge-green"><span className="bdot"></span>Approved</span></div>
              </div>
              <div className="info-box"><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>Role, department, campus, and employment details are managed by IT/HR — contact your administrator to request a change.</div></div>
            </div>

            <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginBottom: 20 }}>
              <button className="btn btn-neu">Discard</button>
              <button className="btn btn-primary" onClick={handleSaveProfile}><i className="lni lni-save"></i> Save Profile</button>
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div className="g2">
            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-lock"></i> Change Password</div></div>
              <div className="fg"><label className="lbl">Current Password <span className="req">*</span></label><input className="ctrl" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} /></div>
              <div className="fg"><label className="lbl">New Password <span className="req">*</span></label><input className="ctrl" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
              <div className="fg"><label className="lbl">Confirm New Password <span className="req">*</span></label><input className="ctrl" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} /></div>
              <div className="flex gap-2" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => router.push('/login/forgot')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--b700)' }}
                >
                  Forgot your current password?
                </button>
                <button className="btn btn-primary" onClick={handleChangePassword}><i className="lni lni-checkmark"></i> Update Password</button>
              </div>
            </div>

            <div className="card">
              <div className="card-hdr"><div className="card-title"><i className="lni lni-alarm-clock"></i> Recent Sign-in Activity</div></div>
              <div className="timeline">
                {signIns.map((s, i) => (
                  <div className="tl-item" key={s.id}>
                    <div className={`tl-dot ${s.current ? 'cur' : i === signIns.length - 1 ? 'done' : 'pending'}`}><i className={`lni ${s.device.includes('iPhone') ? 'lni-mobile' : 'lni-desktop'}`}></i></div>
                    <div>
                      <div className="tl-label">{s.device}{s.current ? ' · This device' : ''}</div>
                      <div className="tl-meta">{s.location} · {s.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <Toast toast={toast} />
    </>
  )
}
