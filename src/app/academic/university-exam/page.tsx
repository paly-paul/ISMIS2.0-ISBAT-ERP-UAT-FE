'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
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
    { unit: 'IT101 – Intro to Programming', programme: 'BSc. IT', examDate: '15 May 2026', uploadedBy: 'Dr. Ssekibuule', uploadDate: '01 Apr 2026', vettingStatus: 'Under Vetting', vettingBadge: 'badge-amber', vettingIcon: '',              examStatus: 'Pending', examBadge: 'badge-grey',  examIcon: '',            rowClass: '',       variant: 'vet' },
    { unit: 'IT102 – Computer Org.',         programme: 'BSc. IT', examDate: '17 May 2026', uploadedBy: 'Ms. Namutebi',   uploadDate: '02 Apr 2026', vettingStatus: 'Approved',      vettingBadge: 'badge-green', vettingIcon: 'lni-checkmark', examStatus: 'Pending', examBadge: 'badge-grey',  examIcon: '',            rowClass: '',       variant: 'view' },
    { unit: 'BBA301 – Strategic Mgmt',       programme: 'BBA',     examDate: '16 May 2026', uploadedBy: '—',              uploadDate: '—',           vettingStatus: 'Not Uploaded',  vettingBadge: 'badge-red',   vettingIcon: '',              examStatus: 'Blocked', examBadge: 'badge-red',   examIcon: '',            rowClass: 'flagged', variant: 'upload' },
  ]
  const filteredRows = rows.filter(r => {
    const q = search.trim().toLowerCase()
    if (q && !`${r.unit} ${r.programme}`.toLowerCase().includes(q)) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as Record<string, unknown>)[k])))
  })

  // Live preview shown in the search dropdown as the user types — same
  // course unit/programme test as filteredRows above, capped to a handful of rows.
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.unit} ${r.programme}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : []

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
            <div className="pg-title">University Examination</div>
            <div className="pg-sub">End-of-semester offline exams · QP upload → Manual vetting → Exam execution · 100 marks prorated to 70</div>
          </div>
          <button className="btn btn-primary" onClick={() => openModal('new-qp-modal')}><i className="lni lni-files"></i> Upload Question Paper</button>
        </div>

        <div className="info-box mb-[18px]">
          <i className="lni lni-clipboard"></i> <span>Question Papers must be uploaded by faculty and sent for <strong>manual vetting</strong> by the QP Vetting Committee before the offline exam. The committee checks against the approved syllabus. University Exam is marked out of <strong>100</strong> and prorated to <strong>70</strong>.</span>
        </div>

        <div className="pipeline">
          <div className="pip-step done"><div className="pip-circle"><i className="lni lni-checkmark"></i></div><div className="pip-info"><div className="pip-label">QP Uploaded</div><div className="pip-desc">By faculty</div></div></div>
          <div className="pip-line done"></div>
          <div className="pip-step active"><div className="pip-circle">2</div><div className="pip-info"><div className="pip-label">Vetting</div><div className="pip-desc">Committee review</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">3</div><div className="pip-info"><div className="pip-label">QP Approved</div><div className="pip-desc">Cleared for print</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">4</div><div className="pip-info"><div className="pip-label">Exam Day</div><div className="pip-desc">Offline execution</div></div></div>
          <div className="pip-line"></div>
          <div className="pip-step"><div className="pip-circle">5</div><div className="pip-info"><div className="pip-label">Mark Entry</div><div className="pip-desc">Post exam</div></div></div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-clipboard"></i></span> Question Papers — Spring 2026</div>
            <TableSearch
              className="w-56"
              placeholder="Search by course unit or programme…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.unit, primary: r.unit, secondary: r.programme }))}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Course Unit</th>{fth('Programme', 'programme', ['BSc. IT', 'BBA'])}<th>Exam Date</th><th>Uploaded By</th><th>Upload Date</th>{fth('Vetting Status', 'vettingStatus', ['Under Vetting', 'Approved', 'Not Uploaded'])}{fth('Exam Status', 'examStatus', ['Pending', 'Blocked'])}</tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}) }} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i} className={r.rowClass}>
                    <td>
                      <ActionMenu>
                        {r.variant === 'vet' && <button className="btn btn-amber btn-sm">Vet QP →</button>}
                        {r.variant === 'view' && <button className="btn btn-neu btn-sm">View QP</button>}
                        {r.variant === 'upload' && <button className="btn btn-primary btn-sm" onClick={() => openModal('new-qp-modal')}>Upload QP</button>}
                      </ActionMenu>
                    </td>
                    <td><strong>{r.unit}</strong></td>
                    <td>{r.programme}</td>
                    <td>{r.examDate}</td>
                    <td>{r.uploadedBy}</td>
                    <td>{r.uploadDate}</td>
                    <td>
                      <span className={`badge ${r.vettingBadge}`}>
                        {r.vettingIcon && <i className={`lni ${r.vettingIcon}`}></i>} {r.vettingStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${r.examBadge}`}>
                        {r.examIcon && <i className={`lni ${r.examIcon}`}></i>} {r.examStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="exam entries" onPageChange={setPage} />
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
