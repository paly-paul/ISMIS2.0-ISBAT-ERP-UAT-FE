'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { AllocImportModal } from '@/components/modals/academic/AllocImportModal'
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
    { code: 'IT101',  name: 'Introduction to Programming', programme: 'BSc. IT', semester: 'Sem 1', batch: 'BSC-IT-S1-D', allocatedTo: 'Dr. Ssekibuule Ronald', status: 'Allocated', rowClass: '',       toastMsg: 'Editing IT101' },
    { code: 'IT102',  name: 'Computer Organisation',       programme: 'BSc. IT', semester: 'Sem 1', batch: 'BSC-IT-S1-D', allocatedTo: 'Ms. Namutebi Joyce',    status: 'Allocated', rowClass: '',       toastMsg: 'Editing IT102' },
    { code: 'BBA301', name: 'Strategic Management',        programme: 'BBA',     semester: 'Sem 3', batch: 'BBA-S3-D',    allocatedTo: '',                       status: 'Missing',   rowClass: 'flagged', toastMsg: 'Assigning BBA301' },
    { code: 'BBA302', name: 'Business Ethics',             programme: 'BBA',     semester: 'Sem 3', batch: 'BBA-S3-D',    allocatedTo: '',                       status: 'Missing',   rowClass: 'flagged', toastMsg: 'Assigning BBA302' },
    { code: 'BBA303', name: 'Financial Accounting III',    programme: 'BBA',     semester: 'Sem 3', batch: 'BBA-S3-D',    allocatedTo: '',                       status: 'Missing',   rowClass: 'flagged', toastMsg: 'Assigning BBA303' },
    { code: 'MBA101', name: 'Managerial Economics',        programme: 'MBA',     semester: 'Sem 1', batch: 'MBA-S1-E',    allocatedTo: 'Prof. Mukasa Charles',   status: 'Allocated', rowClass: '',       toastMsg: 'Editing MBA101' },
  ]
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.code} ${r.name}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (search.trim() && !`${r.code} ${r.name}`.toLowerCase().includes(search.trim().toLowerCase())) return false
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
          <div><div className="pg-title">Course Unit Allocation</div><div className="pg-sub">Assign course units to faculty · Upload HOD Excel sheet · Preview and confirm allocation</div></div>
          <div className="flex gap-2">
            <button className="btn btn-neu btn-sm" onClick={() => openModal('manual-alloc-modal')}><i className="lni lni-plus"></i> Manual Entry</button>
            <button className="btn btn-primary" onClick={() => openModal('alloc-import-modal')}><i className="lni lni-download"></i> Import from Excel</button>
          </div>
        </div>

        <div className="mb-[18px]">
          <div className="info-box">
            <i className="lni lni-information"></i> <span>Allocation data is manually entered by <strong>Support Staff</strong> from the Dean&apos;s pre-approved Excel file. <strong>No system restriction</strong> on subject count per faculty — typical load is <strong>5–6 subjects</strong>. <strong>Project subjects</strong> only require weekly check-ins, not traditional lectures — allocate accordingly.</span>
          </div>
        </div>

        <div className="g4 mb-[18px]">
          <div className="stat-card"><div className="stat-lbl">Total Course Units</div><div className="stat-num">84</div><div className="stat-sub up">Across all programmes</div></div>
          <div className="stat-card [--b700:var(--green)] [--b400:#34d399]"><div className="stat-lbl">Allocated</div><div className="stat-num text-clr-green">81</div><div className="stat-sub up">96% complete</div></div>
          <div className="stat-card [--b700:var(--amber)] [--b400:#fbbf24]"><div className="stat-lbl">Unallocated</div><div className="stat-num text-clr-amber">3</div><div className="stat-sub warn">Action required</div></div>
          <div className="stat-card [--b700:var(--purple)] [--b400:#a78bfa]"><div className="stat-lbl">Faculty Members</div><div className="stat-num text-clr-purple">28</div><div className="stat-sub up">Teaching this intake</div></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-graduation"></i></span> Current Allocations — Spring 2026</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by course code or unit name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.code, primary: r.code, secondary: r.name }))}
              />
              <select className="ctrl w-auto text-[var(--fs-sm)]"><option>All Programmes</option><option>BSc. IT</option><option>BBA</option><option>BEng. Civil</option></select>
              <select className="ctrl w-auto text-[var(--fs-sm)]"><option>All Statuses</option><option>Allocated</option><option>Unallocated</option></select>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Course Code</th><th>Unit Name</th>{fth('Programme', 'programme', ['BSc. IT', 'BBA', 'MBA'])}{fth('Semester', 'semester', ['Sem 1', 'Sem 3'])}{fth('Batch', 'batch', ['BSC-IT-S1-D', 'BBA-S3-D', 'MBA-S1-E'])}<th>Allocated To</th>{fth('Status', 'status', ['Allocated', 'Missing'])}</tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i} className={r.rowClass}>
                    <td>
                      <ActionMenu>
                        {r.status === 'Allocated'
                          ? <button className="btn btn-neu btn-sm" onClick={() => showToast(r.toastMsg, 'info')}><i className="lni lni-pencil"></i> Edit</button>
                          : <button className="btn btn-amber btn-sm" onClick={() => showToast(r.toastMsg, 'info')}>Assign →</button>
                        }
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-[var(--fs-xs)] text-b700">{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.programme}</td>
                    <td>{r.semester}</td>
                    <td>{r.batch}</td>
                    <td>
                      {r.allocatedTo
                        ? <span className="font-bold">{r.allocatedTo}</span>
                        : <span className="text-muted">— Unallocated —</span>
                      }
                    </td>
                    <td>
                      {r.status === 'Allocated'
                        ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Allocated</span>
                        : <span className="badge badge-red"><i className="lni lni-close"></i> Missing</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="allocations" onPageChange={setPage} />
        </div>
      </div>
      <AllocImportModal isOpen={openModals.has('alloc-import-modal')} onClose={() => closeModal('alloc-import-modal')} showToast={showToast} />
      <Toast toast={toast} />
    </>
  )
}
