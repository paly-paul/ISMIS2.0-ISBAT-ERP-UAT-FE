'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'

const PAGE_SIZE = 10

export default function Page() {
  const router = useRouter()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
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
    { batchCode: 'BSC-IT-S1-D',   programme: 'BSc. Information Technology', semester: 'Semester 1', students: 42, allocation: 'Done',      allocationBadge: 'badge-green', allocationIcon: true,  timetable: 'Live',      timetableBadge: 'badge-green', timetableIcon: true,  cwStatus: 'In Progress',  cwBadge: 'badge-amber', actionBtn: 'btn-neu',   actionLabel: 'View →',     actionNav: 'timetable' },
    { batchCode: 'BBA-S3-D',      programme: 'BBA Business Administration', semester: 'Semester 3', students: 38, allocation: '3 Pending', allocationBadge: 'badge-amber', allocationIcon: false, timetable: 'Draft',     timetableBadge: 'badge-amber', timetableIcon: false, cwStatus: 'Not Started',  cwBadge: 'badge-grey',  actionBtn: 'btn-amber', actionLabel: 'Fix →',      actionNav: 'allocation' },
    { batchCode: 'MBA-S1-E',      programme: 'MBA Business Admin',          semester: 'Semester 1', students: 24, allocation: 'Done',      allocationBadge: 'badge-green', allocationIcon: true,  timetable: 'Live',      timetableBadge: 'badge-green', timetableIcon: true,  cwStatus: 'Active',       cwBadge: 'badge-green', actionBtn: 'btn-neu',   actionLabel: 'View →',     actionNav: 'coursework' },
    { batchCode: 'BENG-CIV-S2-D', programme: 'BEng. Civil Engineering',     semester: 'Semester 2', students: 31, allocation: 'Done',      allocationBadge: 'badge-green', allocationIcon: true,  timetable: 'Pending',   timetableBadge: 'badge-blue',  timetableIcon: false, cwStatus: 'Not Started',  cwBadge: 'badge-grey',  actionBtn: 'btn-neu',   actionLabel: 'Schedule →', actionNav: 'timetable' },
  ]
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.batchCode} ${r.programme}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (search.trim() && !`${r.batchCode} ${r.programme}`.toLowerCase().includes(search.trim().toLowerCase())) return false
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
            <div className="pg-title">Academic Dashboard</div>
            <div className="pg-sub">Spring 2026 (20261) · Semester cycle overview · Real-time academic pipeline status</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-neu" onClick={() => nav('intake-master')}><i className="lni lni-cog"></i> Intake Settings</button>
            <button className="btn btn-primary" onClick={() => nav('session-movement')}><i className="lni lni-reload"></i> Run Session Movement</button>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[var(--fs-xs)] font-bold uppercase tracking-[.08em] text-g400">Setup Hierarchy — must be completed in sequence</span>
          <span className="badge badge-blue text-[var(--fs-2xs)]">Modules 1 → 2 → 3</span>
        </div>
        <div className="pipeline mb-3">
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Programme Level</div><div className="pip-desc">M1 · Done</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Programme</div><div className="pip-desc">M1 · Done</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Curriculum</div><div className="pip-desc">M1 · Done</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step active"><div className="pip-circle">4</div><div className="pip-info"><div className="pip-label">Batches</div><div className="pip-desc">M2 · In progress</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">5</div><div className="pip-info"><div className="pip-label">Fee Structure</div><div className="pip-desc">M2 · Pending</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">6</div><div className="pip-info"><div className="pip-label">Skills + Allocation</div><div className="pip-desc">M3 · Pending</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">7</div><div className="pip-info"><div className="pip-label">Session Movement</div><div className="pip-desc">M3 · 3–4 wks before start</div></div></div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-[var(--fs-xs)] font-bold uppercase tracking-[.08em] text-g400">Current Semester Cycle — Spring 2026</span>
          <span className="badge badge-blue text-[var(--fs-2xs)]">Modules 3 → 4 → 5</span>
        </div>
        <div className="pipeline">
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Session Movement</div><div className="pip-desc">M3 · Completed</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">Allocation</div><div className="pip-desc">M3 · 3 pending</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step active"><div className="pip-circle">3</div><div className="pip-info"><div className="pip-label">Timetable</div><div className="pip-desc">M4 · In progress</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">4</div><div className="pip-info"><div className="pip-label">CW / CBT</div><div className="pip-desc">M5 · Term 1</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">5</div><div className="pip-info"><div className="pip-label">Uni. Exam</div><div className="pip-desc">M5 · QP vetting</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">6</div><div className="pip-info"><div className="pip-label">Results</div><div className="pip-desc">M5 · End of Sem</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">7</div><div className="pip-info"><div className="pip-label">Grievance</div><div className="pip-desc">M5 · Post-result</div></div></div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-lbl">Active Students</div>
            <div className="stat-num">1,284</div>
            <div className="stat-sub up">↑ 8% vs last intake</div>
          </div>
          <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]">
            <div className="stat-lbl">Allocation Pending</div>
            <div className="stat-num text-clr-amber">3</div>
            <div className="stat-sub warn">Batches unallocated</div>
          </div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]">
            <div className="stat-lbl">Timetables Active</div>
            <div className="stat-num text-clr-green">14</div>
            <div className="stat-sub up">Across all batches</div>
          </div>
          <div className="stat-card [--b700:var(--purple)] [--b400:#a78bfa]">
            <div className="stat-lbl">ODL Pending Recon.</div>
            <div className="stat-num text-clr-purple">4</div>
            <div className="stat-sub warn">Awaiting accounts</div>
          </div>
        </div>

        <div className="g2">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calendar"></i></span> Active Intakes</div>
              <button className="btn btn-neu btn-sm" onClick={() => nav('intake-master')}>Manage →</button>
            </div>
            <div className="flex flex-col gap-[10px]">
              <div className="p-3 bg-b50 border border-[1.5px] border-b100 rounded-[var(--rsm)]">
                <div className="flex justify-between items-center mb-[6px]">
                  <span className="text-[var(--fs-sm)] font-bold text-b800"><i className="lni lni-book"></i> Current Academic Intake</span>
                  <span className="badge badge-blue">Spring 2026 (20261)</span>
                </div>
                <div className="text-[var(--fs-xs)] text-g500 flex gap-4 flex-wrap">
                  <span>Semester Start: <strong>01 Feb 2026</strong></span>
                  <span>Term 1 End: <strong>30 Mar 2026</strong></span>
                  <span>Semester End: <strong>31 May 2026</strong></span>
                </div>
              </div>
              <div className="p-3 bg-[var(--green-bg)] border border-[1.5px] border-[var(--green-bd)] rounded-[var(--rsm)]">
                <div className="flex justify-between items-center mb-[6px]">
                  <span className="text-[var(--fs-sm)] font-bold text-[#065f46]"><i className="lni lni-graduation"></i> Current Admission Intake</span>
                  <span className="badge badge-green">Fall 2026 (20262)</span>
                </div>
                <div className="text-[var(--fs-xs)] text-[#065f46] flex gap-4 flex-wrap">
                  <span>Admission Open: <strong>01 Mar 2026</strong></span>
                  <span>Closes: <strong>15 Jul 2026</strong></span>
                </div>
              </div>
              {/* <div className="info-box text-[var(--fs-xs)]">
                <i className="lni lni-information"></i> Academic Intake and Admission Intake must always be <strong>different</strong> — only one of each can be active at a time.
              </div> */}
            </div>
          </div>

          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-bolt"></i></span> Recent Activity</div>
              <span className="badge badge-blue">Live</span>
            </div>
            <div className="timeline">
              <div className="tl-item"><div className="tl-dot done"><i className="lni lni-checkmark"></i></div><div className="tl-content"><div className="tl-label">Session Movement Complete</div><div className="tl-meta">1,284 students promoted · 12 marked dropout · 2h ago</div></div></div>
              <div className="tl-item"><div className="tl-dot active"><i className="lni lni-warning"></i></div><div className="tl-content"><div className="tl-label">Allocation Gap — BBA Sem 3</div><div className="tl-meta">3 course units unallocated · HOD action needed · 3h ago</div></div></div>
              <div className="tl-item"><div className="tl-dot active"><i className="lni lni-warning"></i></div><div className="tl-content"><div className="tl-label">ODL Payments Pending Recon.</div><div className="tl-meta">4 applications awaiting accounts · 5h ago</div></div></div>
              <div className="tl-item"><div className="tl-dot pending"></div><div className="tl-content"><div className="tl-label">Timetable — IT Sem 1 Draft</div><div className="tl-meta">Awaiting final approval · 6h ago</div></div></div>
              <div className="tl-item"><div className="tl-dot done"><i className="lni lni-checkmark"></i></div><div className="tl-content"><div className="tl-label">Course Units Updated</div><div className="tl-meta">BBA programme — 18 units confirmed · Yesterday</div></div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> Active Batches — Spring 2026</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by batch code or programme…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.batchCode, primary: r.batchCode, secondary: r.programme }))}
              />
              <select className="ctrl w-auto text-[var(--fs-sm)]"><option>All Programmes</option><option>BSc. IT</option><option>BBA</option><option>BEng. Civil</option><option>MBA</option></select>
              <button className="btn btn-neu btn-sm"><i className="lni lni-upload"></i> Export</button>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Batch Code</th>{fth('Programme', 'programme', ['BSc. Information Technology', 'BBA Business Administration', 'MBA Business Admin', 'BEng. Civil Engineering'])}{fth('Semester', 'semester', ['Semester 1', 'Semester 2', 'Semester 3'])}<th>Students</th>{fth('Allocation', 'allocation', ['Done', '3 Pending'])}{fth('Timetable', 'timetable', ['Live', 'Draft', 'Pending'])}{fth('CW Status', 'cwStatus', ['In Progress', 'Not Started', 'Active'])}</tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <ActionMenu>
                        <button className={`btn ${r.actionBtn} btn-sm`} onClick={() => nav(r.actionNav)}>{r.actionLabel}</button>
                      </ActionMenu>
                    </td>
                    <td><span className="font-bold text-blue font-mono">{r.batchCode}</span></td>
                    <td>{r.programme}</td>
                    <td><span className="pill pill-blue">{r.semester}</span></td>
                    <td>{r.students}</td>
                    <td>
                      <span className={`badge ${r.allocationBadge}`}>
                        {r.allocationIcon && <i className="lni lni-checkmark"></i>}
                        {!r.allocationIcon && r.allocation === '3 Pending' && <i className="lni lni-warning"></i>}
                        {' '}{r.allocation}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.timetableBadge}`}>
                        {r.timetableIcon && <i className="lni lni-checkmark"></i>} {r.timetable}
                      </span>
                    </td>
                    <td><span className={`badge ${r.cwBadge}`}>{r.cwStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="applications" onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
