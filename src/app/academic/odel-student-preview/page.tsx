'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [odpTab, setOdpTab] = useState('personal')

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">ODel Student Preview</div>
            <div className="pg-sub">What the candidate sees online — Personal Info → Qualifications → Family → Documents → Application Payment</div>
          </div>
          <div className="flex gap-2">
            <span className="badge badge-cyan"><i className="lni lni-world"></i> Online Portal Preview</span>
            <button className="btn btn-neu" onClick={() => nav('acad-dashboard')}>← Back</button>
          </div>
        </div>

        <div className="info-box mb-[14px]">
          <i className="lni lni-information"></i> Preview of the public-facing form at{' '}
          <span className="font-mono bg-[var(--b100)] py-0.5 px-[6px] rounded text-[var(--fs-xs)]">ERP.../online.ASP</span>
          {' '}— no login required; candidates access via Reference No. + Email.
        </div>

        <div className="card">
          <div className="odp-tabs">
            <button className={`odp-tab${odpTab === 'personal' ? ' active' : ''}`} data-odp="personal" onClick={() => setOdpTab('personal')}><i className="lni lni-user"></i> Personal Info</button>
            <button className={`odp-tab${odpTab === 'qualifications' ? ' active' : ''}`} data-odp="qualifications" onClick={() => setOdpTab('qualifications')}><i className="lni lni-graduation"></i> Qualifications</button>
            <button className={`odp-tab${odpTab === 'family' ? ' active' : ''}`} data-odp="family" onClick={() => setOdpTab('family')}><i className="lni lni-users"></i> Family Details</button>
            <button className={`odp-tab${odpTab === 'documents' ? ' active' : ''}`} data-odp="documents" onClick={() => setOdpTab('documents')}><i className="lni lni-paperclip"></i> Documents</button>
            <button className={`odp-tab${odpTab === 'payment' ? ' active' : ''}`} data-odp="payment" onClick={() => setOdpTab('payment')}><i className="lni lni-credit-cards"></i> Application Payment</button>
          </div>

          {odpTab === 'personal' && (
            <div className="odp-pane active" id="odp-personal">
              <div className="prof-photo-row">
                <label className="prof-photo-zone" id="odp-photo-zone">
                  <input type="file" accept="image/*" />
                  <div className="prof-photo-icon"><i className="lni lni-camera"></i><small>Photo</small></div>
                  <img className="prof-photo-preview" alt="Profile preview" />
                </label>
                <div className="prof-photo-info">
                  <div className="prof-photo-title">Profile Photo</div>
                  <div className="prof-photo-hint">Click the circle or drop a passport-style photo · JPG / PNG · max 2 MB</div>
                </div>
              </div>
              <div className="g3">
                <div className="fg"><div className="lbl">First Name <span className="req">*</span></div><input className="ctrl" type="text" placeholder="First name" /></div>
                <div className="fg"><div className="lbl">Last Name <span className="req">*</span></div><input className="ctrl" type="text" placeholder="Last name" /></div>
                <div className="fg"><div className="lbl">Date of Birth <span className="req">*</span></div><DatePicker onChange={() => {}} /></div>
                <div className="fg"><div className="lbl">Gender <span className="req">*</span></div>
                  <SearchSelect placeholder="-- Select --" options={['Female', 'Male', 'Other']} />
                </div>
                <div className="fg"><div className="lbl">Nationality <span className="req">*</span></div>
                  <SearchSelect options={['Ugandan', 'Kenyan', 'Tanzanian', 'Rwandan', 'Other']} />
                </div>
                <div className="fg"><div className="lbl">National ID / Passport <span className="req">*</span></div><input className="ctrl" type="text" placeholder="CM12345..." /></div>
                <div className="fg"><div className="lbl">Phone <span className="req">*</span></div>
                  <div className="inp-wrap"><span className="inp-icon"><i className="lni lni-phone"></i></span><input className="ctrl" type="tel" placeholder="+256 700 000 000" /></div>
                </div>
                <div className="fg"><div className="lbl">Email <span className="req">*</span></div>
                  <div className="inp-wrap"><span className="inp-icon"><i className="lni lni-envelope"></i></span><input className="ctrl" type="email" placeholder="applicant@email.com" /></div>
                </div>
                <div className="fg"><div className="lbl">Country of Residence</div>
                  <SearchSelect options={['Uganda', 'Kenya', 'Tanzania', 'Rwanda', 'Other']} />
                </div>
                <div className="fg span3"><div className="lbl">Residential Address</div><input className="ctrl" type="text" placeholder="District / Town / Village" /></div>
              </div>
              <div className="flex justify-end mt-[14px]">
                <button className="btn btn-primary" onClick={() => setOdpTab('qualifications')}>Next: Qualifications →</button>
              </div>
            </div>
          )}

          {odpTab === 'qualifications' && (
            <div className="odp-pane active" id="odp-qualifications">
              <div className="info-box mb-[14px]">
                <i className="lni lni-graduation"></i> Enter your highest qualification. ODL candidates can attach scanned certificates in the Documents tab.
              </div>
              <div className="g2">
                <div className="fg"><div className="lbl">Highest Qualification <span className="req">*</span></div>
                  <SearchSelect placeholder="-- Select --" options={['A-Level (UACE)', 'Diploma', "Bachelor's Degree", "Master's Degree"]} />
                </div>
                <div className="fg"><div className="lbl">Institution Attended <span className="req">*</span></div><input className="ctrl" type="text" placeholder="School / College / University" /></div>
                <div className="fg"><div className="lbl">Year of Completion <span className="req">*</span></div><input className="ctrl" type="number" min={1980} max={2030} placeholder="2024" /></div>
                <div className="fg"><div className="lbl">Grade / GPA</div><input className="ctrl" type="text" placeholder="e.g. 18 Points / 3.5 GPA" /></div>
                <div className="fg span2"><div className="lbl">Subjects / Specialization</div><textarea className="ctrl" rows={2} placeholder="e.g. Mathematics, Economics, Physics..."></textarea></div>
              </div>
              <div className="sec-divider">Work Experience (optional)</div>
              <div className="g2">
                <div className="fg"><div className="lbl">Current Employer</div><input className="ctrl" type="text" placeholder="Company / Organisation" /></div>
                <div className="fg"><div className="lbl">Years of Experience</div><input className="ctrl" type="number" min={0} max={50} placeholder="0" /></div>
              </div>
              <div className="flex justify-between mt-[14px]">
                <button className="btn btn-neu" onClick={() => setOdpTab('personal')}>← Personal Info</button>
                <button className="btn btn-primary" onClick={() => setOdpTab('family')}>Next: Family Details →</button>
              </div>
            </div>
          )}

          {odpTab === 'family' && (
            <div className="odp-pane active" id="odp-family">
              <div className="g2">
                <div className="fg"><div className="lbl">Father&apos;s / Guardian&apos;s Name</div><input className="ctrl" type="text" placeholder="Full name" /></div>
                <div className="fg"><div className="lbl">Father&apos;s / Guardian&apos;s Occupation</div><input className="ctrl" type="text" placeholder="Occupation" /></div>
                <div className="fg"><div className="lbl">Father&apos;s / Guardian&apos;s Phone</div>
                  <div className="inp-wrap"><span className="inp-icon"><i className="lni lni-phone"></i></span><input className="ctrl" type="tel" placeholder="+256 700 000 000" /></div>
                </div>
                <div className="fg"><div className="lbl">Mother&apos;s Name</div><input className="ctrl" type="text" placeholder="Full name" /></div>
                <div className="fg"><div className="lbl">Mother&apos;s Occupation</div><input className="ctrl" type="text" placeholder="Occupation" /></div>
                <div className="fg"><div className="lbl">Mother&apos;s Phone</div>
                  <div className="inp-wrap"><span className="inp-icon"><i className="lni lni-phone"></i></span><input className="ctrl" type="tel" placeholder="+256 700 000 000" /></div>
                </div>
                <div className="fg span2"><div className="lbl">Emergency Contact</div><input className="ctrl" type="text" placeholder="Name + Phone (in case of emergency)" /></div>
              </div>
              <div className="flex justify-between mt-[14px]">
                <button className="btn btn-neu" onClick={() => setOdpTab('qualifications')}>← Qualifications</button>
                <button className="btn btn-primary" onClick={() => setOdpTab('documents')}>Next: Documents →</button>
              </div>
            </div>
          )}

          {odpTab === 'documents' && (
            <div className="odp-pane active" id="odp-documents">
              <div className="info-box mb-[14px]">
                <i className="lni lni-paperclip"></i> Upload scanned copies. Physical originals will be verified by the Administrator at final stage. Provisional certificates are accepted at this stage.
              </div>
              <div className="g2">
                <div className="fg"><div className="lbl">Passport Photo <span className="req">*</span></div>
                  <div className="file-zone"><input type="file" accept="image/*" /><div className="file-zone-icon"><i className="lni lni-image"></i></div><p>JPG / PNG · max 2MB</p></div>
                </div>
                <div className="fg"><div className="lbl">National ID / Passport <span className="req">*</span></div>
                  <div className="file-zone"><input type="file" accept=".pdf,image/*" /><div className="file-zone-icon"><i className="lni lni-files"></i></div><p>PDF / image</p></div>
                </div>
                <div className="fg"><div className="lbl">Academic Certificate <span className="req">*</span></div>
                  <div className="file-zone"><input type="file" accept=".pdf,image/*" /><div className="file-zone-icon"><i className="lni lni-files"></i></div><p>Highest qualification</p></div>
                </div>
                <div className="fg"><div className="lbl">Academic Transcript</div>
                  <div className="file-zone"><input type="file" accept=".pdf,image/*" /><div className="file-zone-icon"><i className="lni lni-files"></i></div><p>Optional</p></div>
                </div>
                <div className="fg span2"><div className="lbl">Other Supporting Documents</div>
                  <div className="file-zone"><input type="file" accept=".pdf,image/*" multiple /><div className="file-zone-icon"><i className="lni lni-files"></i></div><p>Recommendation letters, work certificates, etc.</p></div>
                </div>
              </div>
              <div className="flex justify-between mt-[14px]">
                <button className="btn btn-neu" onClick={() => setOdpTab('family')}>← Family</button>
                <button className="btn btn-primary" onClick={() => setOdpTab('payment')}>Next: Application Payment →</button>
              </div>
            </div>
          )}

          {odpTab === 'payment' && (
            <div className="odp-pane active" id="odp-payment">
              <div className="card border-2 border-dashed border-[var(--cyan)] bg-[var(--cyan-bg)] mb-0">
                <div className="card-hdr border-[rgba(2,132,199,.2)]">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-world"></i></span> Candidate-Facing ODL Application Form</div>
                  <span className="badge badge-cyan">Online Portal Preview</span>
                </div>
                <div className="info-box mb-[14px]">
                  <i className="lni lni-information"></i> This is the online form accessible at{' '}
                  <span className="font-mono bg-[var(--b100)] py-0.5 px-[6px] rounded text-[var(--fs-xs)]">ERP.../online.ASP</span>.
                  {' '}No login required — candidates access via Reference Number + Email.
                </div>
                <div className="g3">
                  <div className="fg"><div className="lbl">Full Name <span className="req">*</span></div><input className="ctrl" type="text" placeholder="Full legal name" /></div>
                  <div className="fg"><div className="lbl">Email Address <span className="req">*</span></div><input className="ctrl" type="email" placeholder="Your email (used for ref. number)" /></div>
                  <div className="fg"><div className="lbl">Phone Number <span className="req">*</span></div><input className="ctrl" type="tel" placeholder="+256 700 000 000" /></div>
                </div>
                <div className="sec-divider">Application Fee</div>
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Fee Type <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="-- Select fee type --"
                      options={[{ value: 'application', label: 'Application Fee' }]}
                    />
                  </div>
                  <div className="fg">
                    <div className="lbl">Amount</div>
                    <div className="p-[14px_16px] bg-[var(--g100)] border-[1.5px] border-dashed border-[var(--g300)] rounded-[var(--rsm)] text-g400 text-[var(--fs-sm)] font-medium">
                      Select a fee type to view the amount
                    </div>
                  </div>
                </div>
                <div className="sec-divider">Payment Option</div>
                <div className="tgl-group mb-[14px]">
                  <button className="tgl-btn tgl-active"><i className="lni lni-credit-cards"></i> Pay Online via DPO</button>
                  <button className="tgl-btn"><i className="lni lni-apartment"></i> Pay Manually at Office</button>
                </div>
                <div className="success-box mb-[14px]"><i className="lni lni-checkmark"></i> <span>No fee exemptions apply to ODL applications. Application fee must be paid to complete the process.</span></div>
                <div className="flex gap-[10px] justify-between flex-wrap">
                  <button className="btn btn-neu" onClick={() => setOdpTab('documents')}>← Documents</button>
                  <div className="flex gap-2">
                    <button className="btn btn-neu" onClick={() => showToast('Application saved. Reference number sent to email.', 'success')}><i className="lni lni-save"></i> Save &amp; Get Reference No.</button>
                    <button className="btn btn-primary" onClick={() => showToast('Redirecting to DPO payment gateway...', 'success')}><i className="lni lni-credit-cards"></i> Proceed to Payment →</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
