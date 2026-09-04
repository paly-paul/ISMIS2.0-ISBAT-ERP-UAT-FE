'use client'
import { useState } from 'react'
import { Toast } from '@/components/Toast'

const SEMESTERS = ['Spring 2026 (20261)', 'Fall 2025 (20252)', 'Spring 2025 (20251)']

const REVENUE_BY_PROGRAMME = [
  { label: 'BSc. Computer Science', value: 'USD 24,750', pct: 38, color: 'var(--b700)', meta: '33 students · 38% of total' },
  { label: 'MBA Business Admin', value: 'USD 19,500', pct: 30, color: 'var(--b500)', meta: '26 students · 30% of total' },
  { label: 'BCom. Accounting', value: 'USD 12,750', pct: 20, color: 'var(--cyan)', meta: '17 students · 20% of total' },
  { label: 'Diploma in Nursing', value: 'USD 8,800', pct: 13, color: 'var(--purple)', meta: '12 students · 13% of total' },
]

const CLEARANCE_DISTRIBUTION = [
  { label: 'Fully Cleared', badge: 'badge-green', pct: 59, color: 'var(--green)', count: '142 (59%)', clr: 'text-green' },
  { label: '50–99% Paid', badge: 'badge-amber', pct: 25, color: 'var(--amber)', count: '60 (25%)', clr: 'text-amber' },
  { label: 'Below 50%', badge: 'badge-red', pct: 11, color: 'var(--red)', count: '27 (11%)', clr: 'text-red' },
  { label: 'No Payment', badge: 'badge-grey', pct: 5, color: 'var(--g400)', count: '12 (5%)', clr: 'text-muted' },
]

export default function Page() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const [semester, setSemester] = useState(SEMESTERS[0])

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Financial Reports</div>
            <div className="pg-sub">Revenue summaries · Outstanding reports · Programme-wise collections · Period comparisons</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select className="ctrl w-auto" value={semester} onChange={e => setSemester(e.target.value)}>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-neu btn-sm" onClick={() => showToast(`Exporting ${semester} report to Excel…`, 'success')}>
              <i className="lni lni-upload"></i> Export Excel
            </button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]">
            <div className="stat-lbl">Total Revenue (UGX)</div>
            <div className="stat-num text-green">247M</div>
            <div className="stat-sub up">↑ 18% vs last sem</div>
          </div>
          <div className="stat-card">
            <div className="stat-lbl">Revenue (USD)</div>
            <div className="stat-num text-blue">65,800</div>
            <div className="stat-sub up">↑ 12% growth</div>
          </div>
          <div className="stat-card [--b700:var(--gold)] [--b400:#fbbf24]">
            <div className="stat-lbl">Collection Rate</div>
            <div className="stat-num" style={{ color: 'var(--gold)' }}>68%</div>
            <div className="stat-sub warn">Target: 80%</div>
          </div>
          <div className="stat-card [--b700:var(--red)] [--b400:#f87171]">
            <div className="stat-lbl">Outstanding (UGX)</div>
            <div className="stat-num text-red">234M</div>
            <div className="stat-sub dn">89 students</div>
          </div>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bar-chart"></i></span> Revenue by Programme</div>
            </div>
            <div className="flex flex-col gap-[14px]">
              {REVENUE_BY_PROGRAMME.map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-[5px]" style={{ fontSize: 13 }}>
                    <span className="font-bold">{r.label}</span>
                    <span className="font-bold">{r.value}</span>
                  </div>
                  <div className="prog-bar-track"><div className="prog-bar-fill" style={{ width: `${r.pct}%`, background: r.color }}></div></div>
                  <div className="text-g400 mt-1" style={{ fontSize: 11 }}>{r.meta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-users"></i></span> Fee Clearance Distribution</div>
            </div>
            <div className="flex flex-col gap-[10px]">
              {CLEARANCE_DISTRIBUTION.map((c, i) => (
                <div key={i} className="flex items-center gap-3 flex-wrap">
                  <span className={`badge ${c.badge}`} style={{ minWidth: 120, textAlign: 'center' }}>{c.label}</span>
                  <div className="prog-bar-track flex-1" style={{ minWidth: 60 }}><div className="prog-bar-fill" style={{ width: `${c.pct}%`, background: c.color }}></div></div>
                  <span className={`font-bold ${c.clr}`}>{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
