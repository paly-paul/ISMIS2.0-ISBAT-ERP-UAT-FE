'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { SearchSelect } from '@/components/SearchSelect'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  function nav(id: string) { router.push('/academic/' + id) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    function closeFilter(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('th')) setOpenFilter(null)
    }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [])

  const rows = [
    { ref: 'ODL-2026-001', name: 'Ssebulime Patrick',  email: 'patrick.ss@gmail.com',  programme: 'MBA ODL',          appliedDate: '10 Apr 2026', payment: 'Paid (DPO)',   paymentBadge: 'badge-green', paymentIcon: 'lni-checkmark', dpoToken: 'TKN-4829', status: 'Pending Recon.', statusBadge: 'badge-purple', rowClass: '',       strong: true,  variant: 'reconcile' },
    { ref: 'ODL-2026-002', name: 'Nakiyaga Flavia',    email: 'f.nakiyaga@email.com',  programme: 'BSc. IT ODL',      appliedDate: '11 Apr 2026', payment: 'Paid (DPO)',   paymentBadge: 'badge-green', paymentIcon: 'lni-checkmark', dpoToken: 'TKN-4831', status: 'Pending Recon.', statusBadge: 'badge-purple', rowClass: '',       strong: true,  variant: 'reconcile' },
    { ref: 'ODL-2026-003', name: 'Mutabazi Eric',      email: 'e.mutabazi@gmail.com',  programme: 'MBA ODL',          appliedDate: '12 Apr 2026', payment: 'Not Paid',     paymentBadge: 'badge-amber', paymentIcon: '',              dpoToken: '—',        status: 'Awaiting Payment', statusBadge: 'badge-amber',  rowClass: 'flagged', strong: true,  variant: 'view-app' },
    { ref: 'ODL-2026-004', name: 'Acayo Lydia',        email: 'l.acayo@email.com',     programme: 'Diploma Bus. ODL', appliedDate: '05 Apr 2026', payment: 'Paid',         paymentBadge: 'badge-green', paymentIcon: 'lni-checkmark', dpoToken: 'TKN-4791', status: 'Reconciled',     statusBadge: 'badge-green',  rowClass: '',       strong: false, variant: 'view' },
  ]
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.ref} ${r.name} ${r.email}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (search.trim() && !`${r.ref} ${r.name} ${r.email}`.toLowerCase().includes(search.trim().toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as Record<string, unknown>)[k])))
  })
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function fth(label: string, col: string, opts: string[]) {
    return (
      <FilterTh
        label={label}
        opts={opts}
        isOpen={openFilter === col}
        activeFilter={filters[col] ?? []}
        onToggle={(e) => { e.stopPropagation(); setOpenFilter(p => p === col ? null : col) }}
        onSelect={(vals) => { setFilters(f => ({ ...f, [col]: vals })); setOpenFilter(null) }}
        onClear={() => { setFilters(f => ({ ...f, [col]: [] })); setOpenFilter(null) }}
        onClose={() => setOpenFilter(null)}
      />
    )
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">ODL Applications</div>
            <div className="pg-sub">Online Distance Learning applicants · Temporary table → Reconciled → Regular application flow</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-neu btn-sm" onClick={() => nav('odl-reconciliation')}><i className="lni lni-credit-cards"></i> Reconciliation Desk →</button>
          </div>
        </div>

        {/* <div className="mb-[18px]">
          <div className="info-box"><i className="lni lni-world"></i> <span>ODL applications start online at <span className="font-mono bg-[var(--b100)] py-0.5 px-[6px] rounded text-[var(--fs-xs)]">ERP.../online.ASP</span>. Unlike regular applications, <strong>payment is not required to start</strong>. No fee exemptions apply to ODL applicants.</span></div>
        </div> */}

        <div className="pipeline">
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Online Apply</div><div className="pip-desc">Candidate fills form</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Ref. No. Sent</div><div className="pip-desc">Email to candidate</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step active"><div className="pip-circle">3</div><div className="pip-info"><div className="pip-label">Payment</div><div className="pip-desc">DPO gateway</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">4</div><div className="pip-info"><div className="pip-label">Reconciliation</div><div className="pip-desc">Accounts team</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">5</div><div className="pip-info"><div className="pip-label">Regular App.</div><div className="pip-desc">Moved to main form</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">6</div><div className="pip-info"><div className="pip-label">Admission</div><div className="pip-desc">Student status</div></div></div>
        </div>

        <div className="g4 mb-[18px]">
          <div className="stat-card"><div className="stat-lbl">Total ODL Applications</div><div className="stat-num">31</div><div className="stat-sub up">This intake</div></div>
          <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]"><div className="stat-lbl">Awaiting Payment</div><div className="stat-num text-clr-amber">9</div><div className="stat-sub warn">In temp table</div></div>
          <div className="stat-card [--b700:var(--purple)] [--b400:#a78bfa]"><div className="stat-lbl">Paid — Pending Recon.</div><div className="stat-num text-clr-purple">4</div><div className="stat-sub warn">Accounts action needed</div></div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Reconciled → Moved</div><div className="stat-num text-clr-green">18</div><div className="stat-sub up">In regular application</div></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-world"></i></span> ODL Applicants — Temporary Table</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by ref no., name or email…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.ref, primary: r.ref, secondary: r.name }))}
              />
              <SearchSelect className="w-auto text-[var(--fs-sm)]" options={['All Statuses', 'Awaiting Payment', 'Paid — Pending Recon.', 'Reconciled']} />
              <button className="btn btn-neu btn-sm"><i className="lni lni-upload"></i> Export</button>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>ODL Ref No.</th><th>Applicant Name</th><th>Email</th>{fth('Programme', 'programme', ['MBA ODL', 'BSc. IT ODL', 'Diploma Bus. ODL'])}<th>Applied Date</th>{fth('Payment', 'payment', ['Paid (DPO)', 'Paid', 'Not Paid'])}<th>DPO Token</th>{fth('Status', 'status', ['Pending Recon.', 'Awaiting Payment', 'Reconciled'])}</tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i} className={r.rowClass}>
                    <td>
                      <ActionMenu>
                        {r.variant === 'reconcile' && <button className="btn btn-primary btn-sm" onClick={() => nav('odl-reconciliation')}>Reconcile →</button>}
                        {r.variant === 'view-app' && <button className="btn btn-neu btn-sm">View App →</button>}
                        {r.variant === 'view' && <button className="btn btn-neu btn-sm">View →</button>}
                      </ActionMenu>
                    </td>
                    <td className={`font-mono text-[var(--fs-xs)] ${r.strong ? 'text-b700' : 'text-g400'}`}>{r.ref}</td>
                    <td>{r.strong ? <strong>{r.name}</strong> : r.name}</td>
                    <td className="text-[var(--fs-xs)]">{r.email}</td>
                    <td>{r.programme}</td>
                    <td>{r.appliedDate}</td>
                    <td>
                      <span className={`badge ${r.paymentBadge}`}>
                        {r.paymentIcon && <i className={`lni ${r.paymentIcon}`}></i>} {r.payment}
                      </span>
                    </td>
                    <td className="font-mono text-[var(--fs-2xs)]">{r.dpoToken}</td>
                    <td>
                      <span className={`badge ${r.statusBadge}`}>
                        {r.status === 'Reconciled' && <i className="lni lni-checkmark"></i>} {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="ODL applications" onPageChange={setPage} />
        </div>

        <div className="card border-2 border-dashed border-[var(--cyan)] bg-[var(--cyan-bg)]">
          <div className="card-hdr border-[rgba(2,132,199,.2)]">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-world"></i></span> Candidate-Facing ODL Application Form</div>
            <span className="badge badge-cyan">Online Portal Preview</span>
          </div>
          <div className="info-box mb-[14px]">
            <i className="lni lni-information"></i> This is the online form accessible at <span className="font-mono bg-[var(--b100)] py-0.5 px-[6px] rounded text-[var(--fs-xs)]">ERP.../online.ASP</span>. No login required — candidates access via Reference Number + Email.
          </div>
          <div className="g3">
            <div className="fg"><div className="lbl">Full Name <span className="req">*</span></div><input className="ctrl" type="text" placeholder="Full legal name" /></div>
            <div className="fg"><div className="lbl">Email Address <span className="req">*</span></div><input className="ctrl" type="email" placeholder="Your email (used for ref. number)" /></div>
            <div className="fg"><div className="lbl">Phone Number <span className="req">*</span></div><input className="ctrl" type="tel" placeholder="+256 700 000 000" /></div>
            <div className="fg"><div className="lbl">Programme of Interest <span className="req">*</span></div>
              <SearchSelect placeholder="-- Select ODL Programme --" options={['MBA Business Admin (ODL)', 'BSc. IT (ODL)', 'Diploma in Business (ODL)']} />
            </div>
            <div className="fg"><div className="lbl">Highest Qualification</div>
              <SearchSelect placeholder="-- Select --" options={['A-Level', 'Diploma', "Bachelor's Degree"]} />
            </div>
            <div className="fg"><div className="lbl">Photo Upload <span className="req">*</span></div>
              <div className="file-zone p-3"><input type="file" accept="image/*" /><div className="file-zone-icon text-[var(--fs-2xl)]"><i className="lni lni-image"></i></div><p>Passport photo</p></div>
            </div>
          </div>
          <div className="sec-divider">Payment Option</div>
          <div className="tgl-group mb-[14px]">
            <button className="tgl-btn tgl-active"><i className="lni lni-credit-cards"></i> Pay Online via DPO</button>
            <button className="tgl-btn"><i className="lni lni-apartment"></i> Pay Manually at Office</button>
          </div>
          <div className="success-box mb-[14px]"><i className="lni lni-checkmark"></i> <span>No fee exemptions apply to ODL applications. Application fee must be paid to complete the process.</span></div>
          <div className="flex gap-[10px] justify-end">
            <button className="btn btn-neu" onClick={() => showToast('Application saved. Reference number sent to email.', 'success')}><i className="lni lni-save"></i> Save &amp; Get Reference No.</button>
            <button className="btn btn-primary" onClick={() => showToast('Redirecting to DPO payment gateway...', 'success')}><i className="lni lni-credit-cards"></i> Proceed to Payment →</button>
          </div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
