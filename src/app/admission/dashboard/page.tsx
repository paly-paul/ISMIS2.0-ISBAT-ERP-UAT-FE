'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10

const PIPELINE = [
  { label: 'App. Payment',   status: 'done',   note: '23 paid' },
  { label: 'App. Filing',    status: 'done',   note: '20 filed' },
  { label: 'Vetting',        status: 'active', note: '5 pending' },
  { label: 'Reg. Payment',   status: '',        note: '$250 check' },
  { label: 'Registration',   status: '',        note: "Registrar's Desk" },
  { label: 'Active Student', status: '',        note: 'T_Student' },
]

const RECENT_APPS = [
  { ref: 'APP-2026-0023', name: 'Nakato Sarah Bridget',   src: 'Walk-in',      prog: 'BSc. Computer Science',      type: 'Direct', fee: '50,000',     feeOk: true,  stage: 'In Vetting',     action: 'review' },
  { ref: 'APP-2026-0022', name: 'Okello James Patrick',   src: 'CRM (Merito)', prog: 'MBA Business Admin',         type: 'ODL',    fee: 'Waived (HTC)', feeOk: true, stage: 'In Vetting',     action: 'review' },
  { ref: 'APP-2026-0021', name: 'Tumukunde Alice Grace',  src: 'Walk-in',      prog: 'Diploma in Nursing',         type: 'Direct', fee: '50,000',     feeOk: true,  stage: 'Reg. Payment',   action: 'register' },
  { ref: 'APP-2026-0020', name: 'Mugisha David Kalisa',   src: 'CRM (Merito)', prog: 'BSc. Information Technology', type: 'Direct', fee: 'Pending',    feeOk: false, stage: 'Payment Pending', action: 'collect' },
  { ref: 'APP-2026-0019', name: 'Nampijja Grace Miriam',  src: 'Walk-in',      prog: 'BCom. Accounting',           type: 'Direct', fee: '50,000',     feeOk: true,  stage: 'Filing Pending', action: 'file' },
]

const VETTING_QUEUE = [
  { name: 'Nakato Sarah Bridget', prog: 'BSc. CS',        docs: 4, time: '2h ago',  urgent: true },
  { name: 'Okello James Patrick', prog: 'MBA ODL',        docs: 5, time: '3h ago',  urgent: true },
  { name: 'Byamukama Robert',     prog: 'BEng. Civil',    docs: 3, time: '5h ago',  urgent: false },
  { name: 'Nalwoga Brenda',       prog: 'Diploma Nursing',docs: 5, time: '6h ago',  urgent: false },
]

const READY_REG = [
  { name: 'Tumukunde Alice',   prog: 'Nursing', fee: 'Paid $250', paid: true },
  { name: 'Ssemakula Peter',   prog: 'IT',      fee: 'Pending',   paid: false },
  { name: 'Birungi Christine', prog: 'BCom.',   fee: 'Paid $250', paid: true },
]

const DONUT_DATA = [
  { label: 'Direct (Walk-in)', value: 9, pct: 39, color: '#2d448f' },
  { label: 'CRM (Merito)',     value: 6, pct: 26, color: '#3b82f6' },
  { label: 'ODel Online App.', value: 4, pct: 17, color: '#d97706' },
  { label: 'Online Enquiry',   value: 4, pct: 17, color: '#059669' },
]

const CONV_BARS = [
  { from: 'Enquiry',       to: 'App. Payment',  pct: 38, level: 'low'  as const, meta: '60 → 23 · 37 lost' },
  { from: 'App. Payment',  to: 'App. Filing',   pct: 87, level: 'high' as const, meta: '23 → 20 · 3 pending' },
  { from: 'App. Filing',   to: 'Vetting',       pct: 90, level: 'high' as const, meta: '20 → 18 · 2 pending' },
  { from: 'Vetting',       to: 'Reg. Payment',  pct: 89, level: 'high' as const, meta: '18 → 16 · 2 pending' },
  { from: 'Reg. Payment',  to: 'Active Student',pct: 88, level: 'high' as const, meta: '16 → 14 · 2 pending' },
]

function donutSegments() {
  const total = DONUT_DATA.reduce((s, d) => s + d.value, 0)
  const R = 45, C = 2 * Math.PI * R
  let offset = 0
  return DONUT_DATA.map(d => {
    const len = (d.value / total) * C
    const gap = 2
    const seg = { ...d, dashArray: `${len - gap} ${C - len + gap}`, dashOffset: -offset }
    offset += len
    return seg
  })
}

function ConvBar({ from, to, pct, level, meta }: { from: string; to: string; pct: number; level: 'high' | 'low'; meta: string }) {
  const isHigh = level === 'high'
  return (
    <div className="conv-item">
      <div className="conv-hdr">
        <span className="conv-from">{from} → {to}</span>
        <span className={`conv-pct ${isHigh ? 'conv-pct-high' : 'conv-pct-low'}`}>{pct}%</span>
      </div>
      <div className="conv-track">
        <div className={`conv-fill ${isHigh ? 'conv-fill-high' : 'conv-fill-low'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="conv-meta">{meta}</span>
    </div>
  )
}

function stageBadge(stage: string) {
  const map: Record<string, string> = {
    'In Vetting':      'badge-amber',
    'Reg. Payment':    'badge-green',
    'Payment Pending': 'badge-amber',
    'Filing Pending':  'badge-blue',
  }
  return map[stage] || 'badge-grey'
}

function srcBadge(src: string) {
  const map: Record<string, string> = {
    'Walk-in':      'badge-blue',
    'CRM (Merito)': 'badge-purple',
    'Online':       'badge-green',
    'ODel':         'badge-amber',
  }
  return map[src] || 'badge-grey'
}


export default function DashboardPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [hoveredSrc, setHoveredSrc] = useState<string | null>(null)
  const segments = donutSegments()
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(RECENT_APPS, PAGE_SIZE)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  return (
    <div id="page-dashboard">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Admission Dashboard</div>
          <div className="pg-sub">Spring 2026 (20261) · Real-time overview of the admission pipeline</div>
        </div>
        <button className="btn btn-primary" onClick={() => router.push('/admission/payment')}>
          <i className="lni lni-plus" /> New Application
        </button>
      </div>

      {/* Pipeline */}
      <div className="pipeline mb-6">
        {PIPELINE.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className={`pip-step ${step.status}`}>
              <div className="pip-circle">{i + 1}</div>
              {/* min-w-0 — this div is itself a flex child of .pip-step; without it,
                  its default min-width:auto still sizes to the label/note's natural
                  width and blocks .pip-step's flex:1 from landing on equal widths
                  across steps (see the #page-dashboard .pip-step rule in globals.css). */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="pip-label">{step.label}</span>
                <span className="pip-desc">{step.note}</span>
              </div>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`pip-line${step.status === 'done' ? ' done' : ''}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Stat cards */}
      <div className="stats-row mb-6">
        <div className="stat-card flex flex-col">
          <span className="stat-lbl">Total Applicants</span>
          <span className="stat-num">23</span>
          <span className="stat-sub up">↑ 18% vs last intake</span>
        </div>
        <div className="stat-card flex flex-col">
          <span className="stat-lbl">Awaiting Vetting</span>
          <span className="stat-num" style={{ color: 'var(--amber)' }}>5</span>
          <span className="stat-sub warn">Needs attention</span>
        </div>
        <div className="stat-card flex flex-col">
          <span className="stat-lbl">Provisionally Admitted</span>
          <span className="stat-num" style={{ color: 'var(--green)' }}>14</span>
          <span className="stat-sub up">↑ 6 this week</span>
        </div>
        <div className="stat-card flex flex-col">
          <span className="stat-lbl">Fully Registered</span>
          <span className="stat-num" style={{ color: 'var(--gold)' }}>4</span>
          <span className="stat-sub up">↑ 2 this week</span>
        </div>
      </div>

      {/* Admission Progress */}
      <div className="card mb-6">
        <div className="card-hdr">
          <div>
            <div className="card-title">Admission Progress — Spring 2026 (20261)</div>
            <div className="card-sub">Application source mix + stage-to-stage conversion · 23 applicants, 14 active</div>
          </div>
          <span className="badge-green px-2 py-0.5 rounded-full font-medium" style={{ fontSize: 'var(--fs-xs)' }}>● Live</span>
        </div>
        <div className="adm-chart-grid">
          {/* Left — donut chart */}
          <div className="adm-chart-col">
            <h3 className="adm-chart-title">Application Source Mix</h3>
            <p className="adm-chart-sub">How the 23 applicants reached the admission desk</p>
            <div className="donut-wrap">
              <div className="donut-svg-wrap">
                <svg viewBox="0 0 120 120" className="donut">
                  {segments.map(seg => (
                    <circle key={seg.label} className="donut-seg" cx="60" cy="60" r="45" fill="none"
                      stroke={seg.color} strokeWidth="18"
                      strokeDasharray={seg.dashArray} strokeDashoffset={seg.dashOffset}
                      onMouseEnter={() => setHoveredSrc(seg.label)}
                      onMouseLeave={() => setHoveredSrc(null)} />
                  ))}
                  <text x="60" y="55" className="donut-center-num" textAnchor="middle" dominantBaseline="middle">23</text>
                  <text x="60" y="70" className="donut-center-lbl" textAnchor="middle">APPLICANTS</text>
                </svg>
              </div>
              <div className="donut-legend">
                {DONUT_DATA.map(d => (
                  <div
                    key={d.label}
                    className={`donut-legend-item${hoveredSrc === d.label ? ' active' : ''}${hoveredSrc && hoveredSrc !== d.label ? ' dim' : ''}`}
                    onMouseEnter={() => setHoveredSrc(d.label)}
                    onMouseLeave={() => setHoveredSrc(null)}
                  >
                    <span className="donut-swatch" style={{ background: d.color }} />
                    <span className="donut-legend-lbl">{d.label}</span>
                    <span className="donut-legend-val">{d.value}</span>
                    <span className="donut-legend-pct">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="donut-metrics">
              <div className="donut-metric">
                <div className="donut-metric-lbl">Counsellor-Driven</div>
                <div className="donut-metric-val">65%</div>
                <div className="donut-metric-sub">Direct + CRM</div>
              </div>
              <div className="donut-metric">
                <div className="donut-metric-lbl">Self-Service</div>
                <div className="donut-metric-val">35%</div>
                <div className="donut-metric-sub">ODel + Online</div>
              </div>
              <div className="donut-metric">
                <div className="donut-metric-lbl">Top Source</div>
                <div className="donut-metric-val">Direct</div>
                <div className="donut-metric-sub">9 applicants</div>
              </div>
            </div>
          </div>

          {/* Right — conversion bars */}
          <div className="adm-chart-col">
            <h3 className="adm-chart-title">Stage-to-Stage Conversion</h3>
            <p className="adm-chart-sub">Where applicants drop off — % moving forward each step</p>
            <div className="conv-list">
              {CONV_BARS.map(b => (
                <ConvBar key={b.from} from={b.from} to={b.to} pct={b.pct} level={b.level} meta={b.meta} />
              ))}
            </div>
            <div className="conv-summary">
              <div>
                <div className="conv-summary-lbl">Overall Conversion (Enquiry → Active)</div>
                <div className="conv-summary-meta">60 enquiries · 14 active students</div>
              </div>
              <span className="conv-summary-val">23%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Applications */}
      <div className="card mb-6">
        <div className="card-hdr">
          <div className="card-title">Recent Applications — Spring 2026</div>
          <div className="flex items-center gap-2">
            <button className="btn btn-neu btn-sm" onClick={() => router.push('/admission/applicants')}>View All</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/admission/payment')}>
              <i className="lni lni-plus" /> New
            </button>
          </div>
        </div>
        <ScrollTable>
          <table>
            <thead>
              <tr className="border-b border-g200 text-left text-g500 uppercase tracking-wider" style={{ fontSize: 'var(--fs-xs)' }}>
                <th style={{ width: 48 }}></th>
                <th className="pb-2 pr-4 font-medium">Ref No.</th>
                <th className="pb-2 pr-4 font-medium">Applicant Name</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Programme</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">App. Fee</th>
                <th className="pb-2 pr-4 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(app => (
                <tr key={app.ref} className="border-b border-g100 hover:bg-g50 transition-colors">
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => router.push('/admission/applicants')}>
                        View
                      </button>
                      {app.action === 'review' && (
                        <button className="btn btn-neu btn-sm" onClick={() => router.push('/admission/vetting')}>
                          Review →
                        </button>
                      )}
                      {app.action === 'register' && (
                        <button className="btn btn-success btn-sm" onClick={() => router.push('/admission/registration')}>
                          Register →
                        </button>
                      )}
                      {app.action === 'collect' && (
                        <button className="btn btn-amber btn-sm" onClick={() => router.push('/admission/payment')}>
                          Collect Fee
                        </button>
                      )}
                      {app.action === 'file' && (
                        <button className="btn btn-primary btn-sm" onClick={() => router.push('/admission/filing')}>
                          File Now →
                        </button>
                      )}
                    </ActionMenu>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-b600" style={{ fontSize: 'var(--fs-xs)' }}>{app.ref}</td>
                  <td className="py-2.5 pr-4 text-g800 font-medium">{app.name}</td>
                  <td className="py-2.5 pr-4"><span className={`badge ${srcBadge(app.src)}`}>{app.src}</span></td>
                  <td className="py-2.5 pr-4 text-g700">{app.prog}</td>
                  <td className="py-2.5 pr-4 text-g600">{app.type}</td>
                  <td className="py-2.5 pr-4">
                    {app.feeOk
                      ? <span className="text-clr-green font-medium" style={{ fontSize: 'var(--fs-xs)' }}>✓ {app.fee}</span>
                      : <span className="text-clr-amber font-medium" style={{ fontSize: 'var(--fs-xs)' }}>{app.fee}</span>}
                  </td>
                  <td className="py-2.5 pr-4"><span className={`badge ${stageBadge(app.stage)}`}>{app.stage}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="applications" onPageChange={setPage} />
      </div>

      {/* Bottom panels */}
      <div className="g2">
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Vetting Queue (5)</div>
            <button style={{ fontSize: 'var(--fs-xs)', color: 'var(--b500)', fontWeight: 600 }} onClick={() => router.push('/admission/vetting')}>Open →</button>
          </div>
          <div className="timeline">
            {VETTING_QUEUE.map(item => (
              <div key={item.name} className="tl-item">
                <div className={`tl-dot ${item.urgent ? 'active' : ''}`}>
                  {item.urgent ? <i className="lni lni-warning" style={{ fontSize: 14 }} /> : null}
                </div>
                <div className="tl-content">
                  <div className="tl-label">{item.name}</div>
                  <div className="tl-meta">{item.prog} · Docs {item.docs}/5 · {item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Ready to Register (3)</div>
            <button style={{ fontSize: 'var(--fs-xs)', color: 'var(--b500)', fontWeight: 600 }} onClick={() => router.push('/admission/registration')}>Open →</button>
          </div>
          <div className="timeline">
            {READY_REG.map(item => (
              <div key={item.name} className="tl-item">
                <div className={`tl-dot ${item.paid ? 'done' : 'active'}`}>
                  {item.paid
                    ? <i className="lni lni-checkmark" style={{ fontSize: 14 }} />
                    : <i className="lni lni-warning" style={{ fontSize: 14 }} />}
                </div>
                <div className="tl-content">
                  <div className="tl-label">{item.name}</div>
                  <div className="tl-meta">{item.prog} · Reg. fee <span className={item.paid ? 'text-clr-green font-medium' : 'text-clr-amber font-medium'}>{item.fee}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
