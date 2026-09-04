'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { sanitizePhoneInput } from '@/lib/errorMessages'

export default function EnquiryFormPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [phone, setPhone] = useState('')
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  return (
    <div id="page-enquiry-form">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">New Enquiry</h1>
          <p className="text-sm text-g500 mt-0.5">Information Desk — capture walk-in, phone &amp; online enquiries</p>
        </div>
        <button className="btn btn-ghost" onClick={() => router.push('/admission/enquiry-list')}><i className="lni lni-arrow-left" /> Enquiry List</button>
      </div>

      <div className="card max-w-3xl">
        <div className="g2">
          <div className="fg"><label className="lbl">First Name <span className="text-clr-red">*</span></label><input className="ctrl" placeholder="e.g. Brian" /></div>
          <div className="fg"><label className="lbl">Last Name <span className="text-clr-red">*</span></label><input className="ctrl" placeholder="e.g. Kamya" /></div>
          <div className="fg"><label className="lbl">Phone <span className="text-clr-red">*</span></label><input className="ctrl" type="tel" inputMode="numeric" placeholder="+256 7XX XXX XXX" value={phone} onChange={e => setPhone(sanitizePhoneInput(e.target.value))} /></div>
          <div className="fg"><label className="lbl">Email</label><input className="ctrl" type="email" placeholder="candidate@example.com" /></div>
          <div className="fg">
            <label className="lbl">Enquiry Channel</label>
            <SearchSelect placeholder="— select —" options={['Walk-in', 'Phone', 'Online', 'Kiosk']} />
          </div>
          <div className="fg">
            <label className="lbl">Programme Interest</label>
            <SearchSelect placeholder="— select —" options={['BSCS — Computer Science', 'BBA — Business Administration', 'BSIT — Information Technology', 'MBA — Master of Business Admin']} />
          </div>
          <div className="fg">
            <label className="lbl">Preferred Intake</label>
            <SearchSelect placeholder="— select —" options={['Spring 2026', 'Fall 2026', 'Spring 2027']} />
          </div>
          <div className="fg">
            <label className="lbl">Preferred Study Mode</label>
            <SearchSelect placeholder="— select —" options={['Full-time', 'Weekend', 'Evening', 'ODL']} />
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="lbl">Enquiry Notes</label>
            <textarea className="ctrl" rows={3} placeholder="Additional notes about the enquiry..." />
          </div>
        </div>
        <div className="sec-divider" />
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => router.push('/admission/enquiry-list')}>Cancel</button>
          <button className="btn btn-primary" onClick={() => showToast('Enquiry saved successfully.', 'success')}>Save Enquiry</button>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
