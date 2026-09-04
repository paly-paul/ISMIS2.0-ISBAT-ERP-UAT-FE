'use client'
import { useState } from 'react'
import { ModalProps } from '../types'
import { ScrollTable } from '@/components/ScrollTable'
import { SuccessPopup } from '../shared/SuccessPopup'

const ENQUIRY_RECORDS = [
  { ref: 'ENQ-2026-0047', name: 'Kamya Brian Sse', date: '09/05/2026', phone: '+256 772 456 789', email: 'kamyabrian@gmail.com', programme: 'BSc. Computer Science',        campus: 'Kampala · Intake 20261',  mode: 'Day',     status: 'Pending' },
  { ref: 'ENQ-2026-0046', name: 'Nambi Doreen',    date: '08/05/2026', phone: '+256 700 334 455', email: '',                     programme: 'Diploma in Nursing',            campus: 'Kampala · Intake 20261',  mode: 'Day',     status: 'Pending' },
  { ref: 'ENQ-2026-0044', name: 'Atim Connie',     date: '07/05/2026', phone: '+256 756 223 441', email: '',                     programme: 'BCom. Accounting',              campus: 'Kampala · Intake 20261',  mode: 'Evening', status: 'Follow-up' },
  { ref: 'ENQ-2026-0043', name: 'Ssali Brian',     date: '07/05/2026', phone: '+256 788 001 122', email: 'ssali.b@gmail.com',    programme: 'MBA Business Admin (ODL)',      campus: 'Distance · Intake 20261', mode: 'ODL',     status: 'Pending' },
  { ref: 'ENQ-2026-0042', name: 'Okello Joseph',   date: '06/05/2026', phone: '+256 705 998 010', email: 'okello.j@yahoo.com',   programme: 'Diploma in Community Health',   campus: 'Mbarara · Intake 20262',  mode: 'Day',     status: 'Pending' },
  { ref: 'ENQ-2026-0041', name: 'Nakato Sarah',    date: '06/05/2026', phone: '+256 750 887 332', email: 'nakato.s@gmail.com',   programme: 'HEC Information Technology',    campus: 'Kampala · Intake 20261',  mode: 'Day',     status: 'Pending' },
]

export function ImportSourceModal({ isOpen, onClose }: ModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [imported, setImported] = useState<typeof ENQUIRY_RECORDS[0] | null>(null)

  if (!isOpen) return null

  function handleClose() {
    setSearchTerm(''); setSelectedRef(null); setImported(null)
    onClose()
  }

  const q = searchTerm.trim().toLowerCase()
  const filtered = ENQUIRY_RECORDS.filter(r =>
    !q || r.name.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q) ||
    r.phone.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.programme.toLowerCase().includes(q)
  )
  const selected = ENQUIRY_RECORDS.find(r => r.ref === selectedRef) || null

  if (imported) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title="Enquiry Imported!"
            subtitle={`${imported.name} (${imported.programme}) has been imported to Application Payment.`}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open">
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title flex items-center gap-2"><i className="lni lni-notepad"></i> Import from Enquiry</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div className="mb-3" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: '1.5px solid var(--g300)', borderRadius: 'var(--rxs)',
          padding: '0 12px', background: 'var(--white)',
        }}>
          <i className="lni lni-search-alt" style={{ fontSize: 14, color: 'var(--g400)', flexShrink: 0 }} />
          <input
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              padding: '9px 0', fontSize: 'var(--fs-base)', fontFamily: 'var(--font)', color: 'var(--g900)',
            }}
            placeholder="Search by name, phone, email, ref or programme..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="mb-3" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <ScrollTable>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: 'var(--g100)', borderBottom: '1px solid var(--g200)' }}>
                  {['Ref', 'Name', 'Phone / Email', 'Programme Interest', 'Mode', 'Status'].map(h => (
                    <th key={h} className="p-3" style={{
                      color: 'var(--g500)', background: 'var(--g100)', textAlign: 'left',
                      position: 'static', boxShadow: 'none',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.ref} className={`cursor-pointer hover:bg-b50 ${selectedRef === r.ref ? 'bg-b50' : ''}`}
                      style={selectedRef === r.ref ? { outline: '2px solid var(--b400)', outlineOffset: -2 } : undefined}
                      onClick={() => setSelectedRef(r.ref)}>
                    <td className="p-3 font-mono text-xs text-b600" style={{ position: 'static', textAlign: 'left', boxShadow: 'none', background: 'transparent' }}>{r.ref}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs" style={{ color: 'var(--g400)' }}>{r.date}</div>
                    </td>
                    <td className="p-3">
                      <div>{r.phone}</div>
                      <div className="text-xs" style={{ color: 'var(--g400)' }}>{r.email || '—'}</div>
                    </td>
                    <td className="p-3">
                      <div>{r.programme}</div>
                      <div className="text-xs" style={{ color: 'var(--g400)' }}>{r.campus}</div>
                    </td>
                    <td className="p-3"><span className="badge badge-grey">{r.mode}</span></td>
                    <td className="p-3"><span className="badge badge-amber">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span className="text-sm text-g500">{selected ? <>Selected: <strong className="text-g800">{selected.name}</strong> &mdash; {selected.programme}</> : 'No record selected'}</span>
          <div className="flex gap-2">
            <button className="btn" onClick={handleClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!selected} onClick={() => { if (selected) setImported(selected) }}>
              <i className="lni lni-download"></i> Import to Application Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
