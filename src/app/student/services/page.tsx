'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'

// Ported from isbat_student_module.html's Student Services page. No backend
// contract exists for a ticketing workflow — mock data only.
interface Ticket {
  id: string
  student: string
  studentId: string
  category: 'Finance' | 'Assessment' | 'Academic' | 'Infrastructure'
  subject: string
  status: 'Open' | 'In Progress' | 'Closed'
  raised: string
  detail: string
}

const TICKETS: Ticket[] = [
  { id: 'TKT-001', student: 'Sarah Namutebi', studentId: 'STU-2024-001', category: 'Finance', subject: 'Payment receipt not generated', status: 'Open', raised: '2 hrs ago', detail: 'Payment of $300 made via bank transfer (ref: ABSA-2025-0110-4421) on Jan 10, 2025 — receipt not generated and balance not updated.' },
  { id: 'TKT-002', student: 'John Mukasa', studentId: 'STU-2024-002', category: 'Assessment', subject: 'CW marks not reflecting', status: 'In Progress', raised: '1 day ago', detail: 'CW1 marks submitted by the lecturer are not showing on the student portal.' },
  { id: 'TKT-003', student: 'Aisha Nalwoga', studentId: 'STU-2024-015', category: 'Academic', subject: 'Timetable clash Sem 3', status: 'Open', raised: '2 days ago', detail: 'Two elective units are scheduled for the same slot on Wednesdays.' },
  { id: 'TKT-004', student: 'David Okello', studentId: 'STU-2024-031', category: 'Infrastructure', subject: 'Lab PC not working — Block C', status: 'Closed', raised: '3 days ago', detail: 'Workstation 14 in Block C Lab 2 does not power on.' },
]

const CATEGORY_BADGE: Record<Ticket['category'], string> = { Finance: 'badge-red', Assessment: 'badge-blue', Academic: 'badge-cyan', Infrastructure: 'badge-grey' }

// The mockup's own university-wide aggregate figures — deliberately not
// derived from TICKETS below, which is only the 4 example rows the mockup
// actually renders, a representative subset rather than the full queue.
const STATS = { open: 4, inProgress: 7, closedThisMonth: 23, avgResolutionDays: '1.8d' }

export default function Page() {
  const [category, setCategory] = useState('All Categories')
  const [status, setStatus] = useState('All Statuses')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [response, setResponse] = useState('')
  const [newStatus, setNewStatus] = useState('In Progress')

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const rows = TICKETS.filter(t =>
    (category === 'All Categories' || t.category === category) &&
    (status === 'All Statuses' || t.status === status)
  )

  function openTicket(t: Ticket) { setActiveTicket(t); setResponse(''); setNewStatus('In Progress') }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Student Services</div><div className="pg-sub">Tickets raised by students — respond and close</div></div>
          <div className="flex gap-2">
            <SearchSelect
              style={{ width: 150 }}
              options={['All Categories', 'Finance', 'Assessment', 'Academic', 'Infrastructure']}
              value={category}
              onChange={setCategory}
            />
            <SearchSelect
              style={{ width: 140 }}
              options={['All Statuses', 'Open', 'In Progress', 'Closed']}
              value={status}
              onChange={setStatus}
            />
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card [--b700:var(--red)] [--b400:#f87171]"><div className="stat-lbl">Open</div><div className="stat-num" style={{ color: 'var(--red)' }}>{STATS.open}</div><div className="stat-sub dn">Needs response</div></div>
          <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]"><div className="stat-lbl">In Progress</div><div className="stat-num" style={{ color: 'var(--amber)' }}>{STATS.inProgress}</div><div className="stat-sub warn">Being handled</div></div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Closed This Month</div><div className="stat-num" style={{ color: 'var(--green)' }}>{STATS.closedThisMonth}</div><div className="stat-sub up">↑ 5 vs last month</div></div>
          <div className="stat-card"><div className="stat-lbl">Avg Resolution</div><div className="stat-num" style={{ color: 'var(--b700)' }}>{STATS.avgResolutionDays}</div><div className="stat-sub">days to close</div></div>
        </div>

        <ScrollTable>
          <table>
          <thead><tr><th>Ticket ID</th><th>Student</th><th>Category</th><th>Subject</th><th>Status</th><th>Raised</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id}>
                <td className="font-mono font-bold text-b700">{t.id}</td>
                <td><div style={{ fontWeight: 600 }}>{t.student}</div><div style={{ fontSize: 11, color: 'var(--g500)' }}>{t.studentId}</div></td>
                <td><span className={`badge ${CATEGORY_BADGE[t.category]}`}>{t.category}</span></td>
                <td>{t.subject}</td>
                <td>{t.status === 'Open' ? <span className="badge badge-red"><span className="bdot"></span> Open</span> : t.status === 'In Progress' ? <span className="badge badge-amber"><span className="bdot"></span> In Progress</span> : <span className="badge badge-green"><span className="bdot"></span> Closed</span>}</td>
                <td style={{ color: 'var(--g500)', fontSize: 12 }}>{t.raised}</td>
                <td>{t.status === 'Closed'
                  ? <button className="btn btn-neu btn-sm" onClick={() => openTicket(t)}>View</button>
                  : <button className="btn btn-primary btn-sm" onClick={() => openTicket(t)}>{t.status === 'Open' ? 'Respond' : 'View'}</button>}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </ScrollTable>
      </div>

      {activeTicket && (
        <div className="modal-overlay open" onClick={() => setActiveTicket(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><div className="modal-title"><i className="lni lni-ticket" style={{ color: 'var(--b700)' }}></i> Ticket Response — {activeTicket.id}</div><button className="modal-close" onClick={() => setActiveTicket(null)}>✕</button></div>
            <div>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--rsm)', padding: '14px 16px', marginBottom: 16, border: '1.5px solid var(--g200)' }}>
                <div className="flex" style={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div><div style={{ fontWeight: 700, color: 'var(--g900)' }}>{activeTicket.subject}</div><div style={{ fontSize: 12, color: 'var(--g500)', marginTop: 3 }}>{activeTicket.student} · {activeTicket.studentId} · {activeTicket.category} · {activeTicket.raised}</div></div>
                  <span className={`badge ${activeTicket.status === 'Open' ? 'badge-red' : activeTicket.status === 'In Progress' ? 'badge-amber' : 'badge-green'}`}>{activeTicket.status}</span>
                </div>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--g700)', lineHeight: 1.6 }}>{activeTicket.detail}</div>
              </div>
              <div className="fg"><label className="lbl">Response <span className="req">*</span></label><textarea className="ctrl" rows={4} placeholder="Type your response…" value={response} onChange={e => setResponse(e.target.value)} /></div>
              <div className="fg"><label className="lbl">Update Status</label>
                <SearchSelect
                  options={['In Progress', 'Pending Student', 'Resolved — Close Ticket']}
                  value={newStatus}
                  onChange={setNewStatus}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setActiveTicket(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { showToast('Response sent', 'ok'); setActiveTicket(null) }}><i className="lni lni-envelope"></i> Send Response</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
