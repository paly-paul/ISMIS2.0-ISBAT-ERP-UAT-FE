'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { SearchSelect } from '@/components/SearchSelect'
import { sanitizePhoneInput } from '@/lib/errorMessages'

const EMPTY = {
  firstName: '', lastName: '', phone: '', email: '',
  channel: '', programme: '', intake: '', mode: '', notes: '',
}

export function EnquiryFormModal({ isOpen, onClose }: ModalProps) {
  const [form, setForm]     = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved]   = useState(false)

  if (!isOpen) return null

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }))
  }

  function handleClose() { setForm(EMPTY); setErrors({}); setSaved(false); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'First Name is required'
    if (!form.lastName.trim())  e.lastName  = 'Last Name is required'
    if (!form.phone.trim())     e.phone     = 'Phone is required'
    if (!form.channel)          e.channel   = 'Please select an Enquiry Channel'
    if (!form.programme)        e.programme = 'Please select a Programme Interest'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup title="Enquiry Saved!" subtitle="The new enquiry has been added to the register." onClose={handleClose} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-notepad"></i> New Enquiry &mdash; Information Desk</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="g2 mb-4">
          <div className="fg">
            <label className="lbl">First Name <span className="req">*</span></label>
            <input className="ctrl" placeholder="Enter first name" value={form.firstName}
              onChange={e => set('firstName', e.target.value)}
              style={errors.firstName ? { borderColor: 'var(--red)' } : undefined} />
            {errors.firstName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.firstName}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Last Name <span className="req">*</span></label>
            <input className="ctrl" placeholder="Enter last name" value={form.lastName}
              onChange={e => set('lastName', e.target.value)}
              style={errors.lastName ? { borderColor: 'var(--red)' } : undefined} />
            {errors.lastName && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.lastName}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Phone <span className="req">*</span></label>
            <input className="ctrl" type="tel" inputMode="numeric" placeholder="+256 7XX XXX XXX" value={form.phone}
              onChange={e => set('phone', sanitizePhoneInput(e.target.value))}
              style={errors.phone ? { borderColor: 'var(--red)' } : undefined} />
            {errors.phone && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.phone}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Email</label>
            <input className="ctrl" type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="fg">
            <label className="lbl">Enquiry Channel <span className="req">*</span></label>
            <SearchSelect
              placeholder="Select channel"
              options={['Walk-In', 'Phone Call', 'Email', 'Website', 'Social Media', 'Referral']}
              value={form.channel}
              onChange={v => set('channel', v)}
            />
            {errors.channel && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.channel}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Programme Interest <span className="req">*</span></label>
            <SearchSelect
              placeholder="Select programme"
              options={['BSc Computer Science', 'BBA Management', 'BSc Nursing', 'Diploma IT', 'BBA Accounting']}
              value={form.programme}
              onChange={v => set('programme', v)}
            />
            {errors.programme && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programme}</p>}
          </div>
          <div className="fg">
            <label className="lbl">Preferred Intake</label>
            <SearchSelect
              placeholder="Select intake"
              options={['September 2026', 'January 2027', 'May 2027']}
              value={form.intake}
              onChange={v => set('intake', v)}
            />
          </div>
          <div className="fg">
            <label className="lbl">Preferred Study Mode</label>
            <SearchSelect
              placeholder="Select mode"
              options={['Full-Time', 'Part-Time', 'Weekend', 'Evening', 'Online / ODL']}
              value={form.mode}
              onChange={v => set('mode', v)}
            />
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="lbl">Notes</label>
            <textarea className="ctrl" rows={3} placeholder="Additional notes or remarks..." value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (validate()) setSaved(true) }}>
            <i className="lni lni-save"></i> Save Enquiry
          </button>
        </div>
      </div>
    </div>
  )
}
