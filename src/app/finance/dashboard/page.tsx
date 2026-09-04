'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { Toast } from '@/components/Toast'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10

export default function Page() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  function nav(id: string) { router.push('/finance/' + id) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const collections = [
    { label: 'Admission Fees', valueLabel: 'UGX 1,150,000 / 1,150,000', pct: 100, color: 'var(--green)', meta: '23 students · ', metaHi: '100% collected', metaClr: 'text-green' },
    { label: 'Registration Fees', valueLabel: 'USD 4,250 / 5,750', pct: 74, color: 'var(--b500)', meta: '17/23 registered · USD 1,500 outstanding · ', metaHi: '74%', metaClr: 'text-amber' },
    { label: 'Tuition — Semester 1', valueLabel: 'USD 38,250 / 127,500', pct: 30, color: 'var(--amber)', meta: '51 payments · USD 89,250 outstanding · ', metaHi: '30%', metaClr: 'text-amber' },
    { label: 'NCHE & Guild Fees', valueLabel: 'UGX 5,290,000 / 6,900,000', pct: 77, color: 'var(--purple)', meta: 'Regulatory fees · 230 students billed · ', metaHi: '77%', metaClr: 'text-clr-purple' },
  ]

  const pending = [
    { dot: 'active', icon: 'lni-warning', name: 'Mugisha David Kalisa', meta: 'BSc. IT · USD 750 tuition · 10 min ago' },
    { dot: 'active', icon: 'lni-warning', name: 'Okello James Patrick', meta: 'MBA ODL · USD 200 registration · 1h ago' },
    { dot: 'pending', icon: '', name: 'Atim Grace Beatrice', meta: 'BCom. · UGX 1,200,000 tuition · 2h ago' },
    { dot: 'pending', icon: '', name: 'Ssemakula Peter', meta: 'BSc. CS · USD 250 registration · 3h ago' },
    { dot: 'done', icon: 'lni-checkmark', name: 'Tumukunde Alice Grace', meta: 'Paid UGX 3,750,000 ✓ · 9:14 AM', metaClr: 'text-green' },
  ]

  const payments = [
    { receipt: 'RCP-2026-0089', student: 'Tumukunde Alice Grace', programme: 'Diploma Nursing', feeBadge: 'badge-green', fee: 'Tuition S1', amount: '1,000 USD', cur: 'USD', ugx: '3,750,000', method: 'Cash', pill: 'pill-blue', time: '09:14 AM' },
    { receipt: 'RCP-2026-0088', student: 'Nakato Sarah Bridget', programme: 'BSc. CS', feeBadge: 'badge-blue', fee: 'Registration', amount: '250 USD', cur: 'USD', ugx: '937,500', method: 'Bank', pill: 'pill-cyan', time: '08:47 AM' },
    { receipt: 'RCP-2026-0087', student: 'Nampijja Grace Miriam', programme: 'BCom. Accounting', feeBadge: 'badge-amber', fee: 'Tuition S1', amount: '400,000 UGX', cur: 'UGX', ugx: '400,000', method: 'Cash', pill: 'pill-blue', time: '08:22 AM' },
    { receipt: 'RCP-2026-0086', student: 'Byamukama Robert', programme: 'BEng. Civil', feeBadge: 'badge-blue', fee: 'Admission Fee', amount: '50,000 UGX', cur: 'UGX', ugx: '50,000', method: 'Cash', pill: 'pill-blue', time: '08:05 AM' },
  ]

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(payments, PAGE_SIZE)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Finance Dashboard</div>
            <div className="pg-sub">Spring 2026 (20261) · Real-time overview of fee collection and student financial status</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-neu" onClick={() => nav('exchange-rates')}><i className="lni lni-world"></i> Exchange Rates</button>
            <button className="btn btn-primary btn-lg" onClick={() => nav('payment-console')}><i className="lni lni-credit-cards"></i> Collect Payment</button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-lbl">Collected Today</div>
            <div className="stat-num text-blue">UGX 18.4M</div>
            <div className="stat-sub up">↑ 23% vs yesterday</div>
          </div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]">
            <div className="stat-lbl">Students Fully Cleared</div>
            <div className="stat-num text-green">142</div>
            <div className="stat-sub up">↑ 8 this week</div>
          </div>
          <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]">
            <div className="stat-lbl">Outstanding Balances</div>
            <div className="stat-num text-amber">89</div>
            <div className="stat-sub warn">UGX 234M total outstanding</div>
          </div>
          <div className="stat-card [--b700:var(--red)] [--b400:#f87171]">
            <div className="stat-lbl">Access Blocked</div>
            <div className="stat-num text-red">12</div>
            <div className="stat-sub dn">Below 50% clearance</div>
          </div>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bar-chart"></i></span> Collection by Fee Type — Spring 2026</div>
              <span className="badge badge-blue"><span className="bdot"></span>Live</span>
            </div>
            <div className="flex flex-col gap-4">
              {collections.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-[6px] text-[var(--fs-base)]">
                    <span className="font-bold">{c.label}</span>
                    <span className="font-bold" style={{ color: c.color }}>{c.valueLabel}</span>
                  </div>
                  <div className="prog-bar-track"><div className="prog-bar-fill" style={{ width: `${c.pct}%`, background: c.color }}></div></div>
                  <div className="text-[length:var(--fs-xs)] text-g400 mt-1">{c.meta}<span className={c.metaClr}>{c.metaHi}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-hourglass"></i></span> Pending Collections (Today)</div>
              <button className="btn btn-neu btn-sm" onClick={() => nav('payment-console')}>Collect →</button>
            </div>
            <div className="timeline">
              {pending.map((p, i) => (
                <div key={i} className="tl-item">
                  <div className={`tl-dot ${p.dot}`}>{p.icon && <i className={`lni ${p.icon}`}></i>}</div>
                  <div className="tl-content">
                    <div className="tl-label">{p.name}</div>
                    <div className="tl-meta">{p.metaClr ? <span className={`font-bold ${p.metaClr}`}>{p.meta}</span> : p.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-credit-cards"></i></span> Recent Payments — Today</div>
            <button className="btn btn-neu btn-sm" onClick={() => nav('payment-history')}>View All</button>
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th><th>Student</th><th>Programme</th><th>Fee Type</th>
                  <th>Amount Paid</th><th>Cur.</th><th>UGX Value</th><th>Method</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p, i) => (
                  <tr key={i}>
                    <td className="text-blue font-bold font-mono">{p.receipt}</td>
                    <td><strong>{p.student}</strong></td>
                    <td>{p.programme}</td>
                    <td><span className={`badge ${p.feeBadge}`}>{p.fee}</span></td>
                    <td className="text-green font-bold">{p.amount}</td>
                    <td><span className="badge badge-gold">{p.cur}</span></td>
                    <td className="font-bold">{p.ugx}</td>
                    <td><span className={`pill ${p.pill}`}>{p.method}</span></td>
                    <td className="text-muted">{p.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="payments" onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
