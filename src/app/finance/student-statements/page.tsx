'use client'
import { useMemo, useState } from 'react'
import { Toast } from '@/components/Toast'

interface DemoStudent { name: string; sno: string; programme: string; email: string }

const DEMO_STUDENTS: DemoStudent[] = [
  { name: 'Tumukunde Alice Grace', sno: 'ISB/2026/0021', programme: 'Diploma in Nursing', email: 'alice.t@students.isbat.ac.ug' },
  { name: 'Okello James Patrick', sno: 'ISB/2026/0022', programme: 'MBA Business Admin (ODL)', email: 'okello.j@students.isbat.ac.ug' },
  { name: 'Nakato Sarah Bridget', sno: 'ISB/2026/0023', programme: 'BSc. Computer Science', email: 'nakato.s@students.isbat.ac.ug' },
  { name: 'Nampijja Grace Miriam', sno: 'ISB/2026/0019', programme: 'BCom. Accounting', email: 'nampijja.g@students.isbat.ac.ug' },
  { name: 'Mugisha David Kalisa', sno: 'ISB/2026/0020', programme: 'BSc. Information Technology', email: 'mugisha.d@students.isbat.ac.ug' },
]

interface FeeLine { label: string; amount: string; currency: 'USD' | 'UGX'; status: 'paid' | 'outstanding' }

// Same fee-line template applied to whichever demo student is generated —
// the reference design only ever specified one worked example (Tumukunde
// Alice Grace's statement), so every student's statement mirrors its shape.
const FEE_LINES: FeeLine[] = [
  { label: 'Admission Fee', amount: '50,000', currency: 'UGX', status: 'paid' },
  { label: 'Registration Fee', amount: '250', currency: 'USD', status: 'paid' },
  { label: 'Tuition — S1', amount: '750', currency: 'USD', status: 'outstanding' },
  { label: 'NCHE Fee (Annual)', amount: '20,000', currency: 'UGX', status: 'outstanding' },
  { label: 'Guild Fee (Semester)', amount: '10,000', currency: 'UGX', status: 'outstanding' },
]

function totalOutstanding(lines: FeeLine[]): string {
  const parts: string[] = []
  const usd = lines.filter(l => l.status === 'outstanding' && l.currency === 'USD')
    .reduce((sum, l) => sum + Number(l.amount.replace(/,/g, '')), 0)
  const ugx = lines.filter(l => l.status === 'outstanding' && l.currency === 'UGX')
    .reduce((sum, l) => sum + Number(l.amount.replace(/,/g, '')), 0)
  if (usd > 0) parts.push(`USD ${usd.toLocaleString()}`)
  if (ugx > 0) parts.push(`UGX ${ugx.toLocaleString()}`)
  return parts.join(' + ') || '—'
}

export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [search, setSearch] = useState('')
  const [student, setStudent] = useState<DemoStudent>(DEMO_STUDENTS[0])

  const outstanding = useMemo(() => totalOutstanding(FEE_LINES), [])

  function handleGenerate() {
    const q = search.trim().toLowerCase()
    if (!q) { showToast('Enter a student number or name.', 'warn'); return }
    const found = DEMO_STUDENTS.find(s => s.sno.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    if (!found) { showToast('Student not found.', 'warn'); return }
    setStudent(found)
    showToast('Statement generated for student.', 'success')
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Student Financial Statements</div>
            <div className="pg-sub">Generate individual student statements · Full ledger view · Print or email</div>
          </div>
        </div>

        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Search Student</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="inp-wrap" style={{ flex: 1, minWidth: 180 }}>
              <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
              <input
                className="ctrl" type="text" placeholder="Student number or name"
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
              />
            </div>
            <button className="btn btn-primary" onClick={handleGenerate}>
              <i className="lni lni-files"></i> Generate
            </button>
          </div>
        </div>

        <div className="card mt-[18px]" style={{ maxWidth: 680 }}>
          <div className="text-center mb-4 pb-3 border-b border-g200">
            <h3 className="font-bold text-g900" style={{ fontSize: 'var(--fs-lg)' }}>ISBAT University</h3>
            <p className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>Institute of Skill Development And Training</p>
            <p className="text-g500" style={{ fontSize: 'var(--fs-xs)' }}>Kampala, Uganda · erp.isbatuniversity.ac.ug</p>
            <div className="font-mono font-bold text-blue mt-2" style={{ fontSize: 14 }}>STMT-{student.sno}</div>
            <div className="text-g400 uppercase font-bold mt-1" style={{ fontSize: 10, letterSpacing: '.06em' }}>
              Student Financial Statement — Spring 2026
            </div>
          </div>

          <div className="receipt-row"><span className="text-muted">Student Name</span><span className="font-bold">{student.name}</span></div>
          <div className="receipt-row"><span className="text-muted">Student Number</span><span className="font-mono text-blue">{student.sno}</span></div>
          <div className="receipt-row"><span className="text-muted">Programme</span><span>{student.programme} · Semester 1</span></div>
          <div className="receipt-row"><span className="text-muted">Fee Structure</span><span>Local Student</span></div>

          <div style={{ height: 1, background: 'var(--g100)', margin: '10px 0' }}></div>

          {FEE_LINES.map((l, i) => (
            <div key={i} className="receipt-row">
              <span className="text-muted">{l.label}</span>
              <span className={`font-bold ${l.status === 'paid' ? 'text-green' : 'text-amber'}`}>
                {l.currency} {l.amount} {l.status === 'paid' ? '✓ Paid' : '— Outstanding'}
              </span>
            </div>
          ))}

          <div className="receipt-total"><span>Total Outstanding</span><span className="text-amber">{outstanding}</span></div>

          <div className="text-center text-g400 mt-3 pt-3 border-t border-dashed border-g300" style={{ fontSize: 10 }}>
            Fee Clearance Status: <strong>50% — Term 1 Assessment Access Granted</strong><br />
            Statement generated: 09 May 2026 · Finance Office · ISBAT University
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap" style={{ maxWidth: 680 }}>
          <button className="btn btn-neu flex-1 justify-center" onClick={() => window.print()}>
            <i className="lni lni-printer"></i> Print Statement
          </button>
          <button className="btn btn-primary flex-1 justify-center" onClick={() => showToast(`Statement emailed to ${student.email}`, 'success')}>
            <i className="lni lni-envelope"></i> Email to Student
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
