'use client'
import { useState } from 'react'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'

// Ported from isbat_student_module.html's Send Communication page. No
// backend contract exists for bulk messaging — the "recipients matching
// filters" count and templates are illustrative mock data.
const TEMPLATES: Record<string, string> = {
  'Fee Payment Reminder': 'Dear {student_name},\n\nThis is a reminder that you have an outstanding balance of {balance} for {semester}. Please clear this before the deadline of {deadline}.\n\nRegards,\nISBAT Finance Office',
  'Registration Deadline': 'Dear {student_name},\n\nRegistration for {semester} closes on {deadline}. Please complete your registration to avoid late fees.\n\nRegards,\nISBAT Registrar',
  'Academic Warning': 'Dear {student_name},\n\nYour academic performance in {semester} requires attention. Please contact your programme coordinator.\n\nRegards,\nISBAT Academic Office',
  'Welcome New Student': 'Dear {student_name},\n\nWelcome to ISBAT University! We look forward to supporting you through {semester} and beyond.\n\nRegards,\nISBAT Student Services',
}

export default function Page() {
  const [channel, setChannel] = useState<'Email' | 'WhatsApp' | 'Both'>('Email')
  const [statusFilter, setStatusFilter] = useState('All Students')
  const [progFilter, setProgFilter] = useState('All Programmes')
  const [batchFilter, setBatchFilter] = useState('All Batches')
  const [sponsorFilter, setSponsorFilter] = useState('All')
  const [subject, setSubject] = useState('')
  const [template, setTemplate] = useState('— Custom message —')
  const [body, setBody] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Illustrative recipient count — narrows a bit per active filter, purely
  // for demo purposes (no backend to actually count against).
  const activeFilters = [statusFilter, progFilter, batchFilter, sponsorFilter].filter(f => !f.startsWith('All')).length
  const recipientCount = Math.max(3, 28 - activeFilters * 6)

  function handleTemplateChange(name: string) {
    setTemplate(name)
    if (TEMPLATES[name]) { setBody(TEMPLATES[name]); showToast('Template loaded', 'ok') }
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr"><div><div className="pg-title">Send Communication</div><div className="pg-sub">Bulk email or WhatsApp to filtered student groups</div></div></div>
        <div className="g2">
          <div className="card">
            <div className="card-hdr"><div className="card-title"><i className="lni lni-target-customer"></i> Recipient Targeting</div></div>
            <div className="fg"><label className="lbl">Channel</label>
              <div className="tgl-group">
                {(['Email', 'WhatsApp', 'Both'] as const).map(c => (
                  <button key={c} className={`tgl-btn${channel === c ? ' tgl-active' : ''}`} onClick={() => setChannel(c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="fg"><label className="lbl">Filter by Status</label>
              <SearchSelect
                options={['All Students', 'Yet to Register', 'Yet to Clear', 'Dropout', 'Active']}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
            <div className="fg"><label className="lbl">Filter by Programme</label>
              <SearchSelect
                options={['All Programmes', 'BSc. IT', 'BBA', 'BSc. Accounting', 'MBA']}
                value={progFilter}
                onChange={setProgFilter}
              />
            </div>
            <div className="fg"><label className="lbl">Filter by Batch</label>
              <SearchSelect
                options={['All Batches', 'BSc.IT-2024A', 'BBA-2024A', 'BSc.IT-2025A']}
                value={batchFilter}
                onChange={setBatchFilter}
              />
            </div>
            <div className="fg"><label className="lbl">Filter by Sponsorship</label>
              <SearchSelect
                options={['All', 'HESFB', 'Watoto', 'Self-Sponsored']}
                value={sponsorFilter}
                onChange={setSponsorFilter}
              />
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--b50)', borderRadius: 'var(--rxs)', border: '1.5px solid var(--b200)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--b700)' }}>Recipients matching filters:</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--b700)' }}>{recipientCount} students</span>
            </div>
          </div>
          <div className="card">
            <div className="card-hdr"><div className="card-title"><i className="lni lni-envelope"></i> Message Composition</div></div>
            <div className="fg"><label className="lbl">Subject <span className="req">*</span></label><input className="ctrl" placeholder="e.g. Reminder: Outstanding Fee Balance — Spring 2026" value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div className="fg"><label className="lbl">Template</label>
              <SearchSelect
                options={['— Custom message —', ...Object.keys(TEMPLATES)]}
                value={template}
                onChange={handleTemplateChange}
              />
            </div>
            <div className="fg"><label className="lbl">Message Body <span className="req">*</span></label><textarea className="ctrl" rows={7} placeholder={'Dear {student_name},\n\nVariables: {student_name}, {balance}, {semester}, {deadline}'} value={body} onChange={e => setBody(e.target.value)} /></div>
            <div className="info-box" style={{ marginBottom: 14 }}><i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i><div style={{ fontSize: 12 }}>Use <code>{'{student_name}'}</code>, <code>{'{balance}'}</code>, <code>{'{semester}'}</code> for personalised messages.</div></div>
            <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-neu">Preview</button>
              <button className="btn btn-primary" onClick={() => showToast(`Message sent to ${recipientCount} students`, 'ok')}><i className="lni lni-envelope"></i> Send to {recipientCount} Students</button>
            </div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
