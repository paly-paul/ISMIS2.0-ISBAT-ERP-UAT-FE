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
    { unit: 'IT101 – Intro to Programming', batch: 'BSC-IT-S1-D', date: '20 Mar 2026', time: '10:00 AM', duration: '60 min', outOf: 50, attempted: '40/42', attemptedClass: 'text-green', cleared: 42, status: 'Completed',     statusBadge: 'badge-green', statusIcon: 'lni-checkmark', rowClass: '', variant: 'view' },
    { unit: 'IT102 – Computer Org.',         batch: 'BSC-IT-S1-D', date: '22 Mar 2026', time: '02:00 PM', duration: '60 min', outOf: 50, attempted: '—',      attemptedClass: '',           cleared: 38, status: 'Upcoming',      statusBadge: 'badge-blue',  statusIcon: '',              rowClass: '', variant: 'manage' },
    { unit: 'MBA101 – Managerial Econ.',     batch: 'MBA-S1-E',    date: '—',           time: '—',         duration: '60 min', outOf: 50, attempted: '—',      attemptedClass: '',           cleared: 24, status: 'Not Scheduled', statusBadge: 'badge-grey',  statusIcon: '',              rowClass: '', variant: 'schedule' },
  ]
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.unit} ${r.batch}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (search.trim() && !`${r.unit} ${r.batch}`.toLowerCase().includes(search.trim().toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes((r as unknown as Record<string, string>)[k]))
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
          <div><div className="pg-title">Class Test (CBT)</div><div className="pg-sub">Computer-based timed assessments · 60-minute server-side timer · 50% fee clearance for submission</div></div>
          <button className="btn btn-primary" onClick={() => openModal('new-cbt-modal')}><i className="lni lni-plus"></i> Schedule Class Test</button>
        </div>

        <div className="mb-[18px]">
          <div className="info-box"><i className="lni lni-ruler-alt"></i> <span><strong>Proration:</strong> CBT is marked out of <strong>50</strong> and prorated to <strong>15</strong> marks. Each test runs for <strong>60 minutes</strong> with server-side timing — students cannot extend or pause.</span></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-display"></i></span> Scheduled Class Tests — Term 1</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by course unit or batch…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.unit, primary: r.unit, secondary: r.batch }))}
              />
              <select className="ctrl w-auto text-[var(--fs-sm)]"><option>All Batches</option><option>BSC-IT-S1-D</option><option>MBA-S1-E</option></select>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Course Unit</th>{fth('Batch', 'batch', ['BSC-IT-S1-D', 'MBA-S1-E'])}<th>Date</th><th>Time</th><th>Duration</th><th>Out Of</th><th>Attempted</th><th>Cleared (≥50%)</th>{fth('Status', 'status', ['Completed', 'Upcoming', 'Not Scheduled'])}</tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i} className={r.rowClass}>
                    <td>
                      <ActionMenu>
                        {r.variant === 'view' && <button className="btn btn-neu btn-sm">View Marks</button>}
                        {r.variant === 'manage' && <button className="btn btn-neu btn-sm">Manage</button>}
                        {r.variant === 'schedule' && <button className="btn btn-primary btn-sm" onClick={() => openModal('new-cbt-modal')}>Schedule →</button>}
                      </ActionMenu>
                    </td>
                    <td><strong>{r.unit}</strong></td>
                    <td>{r.batch}</td>
                    <td>{r.date}</td>
                    <td>{r.time}</td>
                    <td>{r.duration}</td>
                    <td>{r.outOf}</td>
                    <td>
                      {r.attempted === '—'
                        ? '—'
                        : <span className={`${r.attemptedClass} font-bold`}>{r.attempted}</span>
                      }
                    </td>
                    <td>{r.cleared}</td>
                    <td>
                      <span className={`badge ${r.statusBadge}`}>
                        {r.statusIcon && <i className={`lni ${r.statusIcon}`}></i>} {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="class tests" onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
