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
    { name: 'Kabila Jean-Pierre', country: 'DR Congo', qualLevel: 'A-Level Equivalent',  referredTo: 'NCHE',  referredBadge: 'badge-blue',  submittedDate: '01 Mar 2026', status: 'Completed', statusBadge: 'badge-green',  statusIcon: 'lni-checkmark', outcome: 'Equated — 2 Principal Passes', outcomeBadge: 'badge-green',  rowClass: '',       variant: 'view' },
    { name: 'Abubakar Faisal',    country: 'Kenya',    qualLevel: 'O-Level (KCSE)',        referredTo: 'UVTOP', referredBadge: 'badge-amber', submittedDate: '10 Apr 2026', status: 'Pending',   statusBadge: 'badge-amber',  statusIcon: '',              outcome: '—',                           outcomeBadge: '',             rowClass: 'flagged', variant: 'followup' },
    { name: 'Uwase Claudine',     country: 'Rwanda',   qualLevel: "Bachelor's Degree",     referredTo: 'NCHE',  referredBadge: 'badge-blue',  submittedDate: '15 Apr 2026', status: 'In Review', statusBadge: 'badge-purple', statusIcon: '',              outcome: '—',                           outcomeBadge: '',             rowClass: '',       variant: 'view' },
  ]
  const filteredRows = rows.filter(r => {
    const q = search.trim().toLowerCase()
    if (q && !`${r.name} ${r.country}`.toLowerCase().includes(q)) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as Record<string, unknown>)[k])))
  })

  // Live preview shown in the search dropdown as the user types — same
  // applicant name/country test as filteredRows above, capped to a handful of rows.
  const searchMatches = search.trim()
    ? rows.filter(r => `${r.name} ${r.country}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
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
            <div className="pg-title">Qualification Equating</div>
            <div className="pg-sub">Validate foreign educational qualifications against Ugandan standards · NCHE / UVTOP referral</div>
          </div>
          <button className="btn btn-primary" onClick={() => openModal('new-equating-modal')}><i className="lni lni-plus"></i> New Equating Request</button>
        </div>

        <div className="info-box mb-[18px]">
          <i className="lni lni-world"></i> <span>Any foreign qualification must be formally equated with <strong>NCHE</strong> (National Council of Higher Education) or <strong>UVTOP</strong> (Uganda National &amp; Technical Vocational Board) before the applicant can be admitted. O-Level: minimum 5 passes, passing grade ≤ 8. A-Level: assessed on Principal Passes and Subsidiary Passes.</span>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-world"></i></span> Equating Requests</div>
            <TableSearch
              className="w-56"
              placeholder="Search by applicant or country…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map((r, i) => ({ id: `${r.name}-${i}`, primary: r.name, secondary: r.country }))}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Applicant Name</th>{fth('Country of Qualification', 'country', ['DR Congo', 'Kenya', 'Rwanda'])}{fth('Qualification Level', 'qualLevel', ['A-Level Equivalent', 'O-Level (KCSE)', "Bachelor's Degree"])}<th>Referred To</th><th>Submitted Date</th>{fth('Status', 'status', ['Completed', 'Pending', 'In Review'])}{fth('Outcome', 'outcome', ['Equated — 2 Principal Passes', '—'])}</tr></thead>
              <tbody>
                {filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}) }} />
                  : null}
                {pageItems.map((r, i) => (
                  <tr key={i} className={r.rowClass}>
                    <td>
                      <ActionMenu>
                        {r.variant === 'view' && <button className="btn btn-neu btn-sm">View →</button>}
                        {r.variant === 'followup' && <button className="btn btn-amber btn-sm">Follow Up</button>}
                      </ActionMenu>
                    </td>
                    <td><strong>{r.name}</strong></td>
                    <td><i className="lni lni-flag"></i> {r.country}</td>
                    <td>{r.qualLevel}</td>
                    <td><span className={`badge ${r.referredBadge}`}>{r.referredTo}</span></td>
                    <td>{r.submittedDate}</td>
                    <td>
                      <span className={`badge ${r.statusBadge}`}>
                        {r.statusIcon && <i className={`lni ${r.statusIcon}`}></i>} {r.status}
                      </span>
                    </td>
                    <td>
                      {r.outcomeBadge
                        ? <span className={`badge ${r.outcomeBadge}`}>{r.outcome}</span>
                        : r.outcome
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="qualifications" onPageChange={setPage} />
        </div>

        <div className="undefined-box mt-1">
          <div className="text-[var(--fs-xl)] mb-2"><i className="lni lni-world"></i></div>
          <div className="font-bold text-[var(--fs-md)] text-g900 mb-[6px]">Detailed Equating Workflow</div>
          <div className="text-[var(--fs-sm)] text-g500 max-w-[500px] mx-auto">The detailed process for document submission to NCHE/UVTOP, tracking, and outcome recording has <strong>not yet been covered in a KT session</strong>.</div>
          <div className="badge badge-purple mt-[10px]"><i className="lni lni-clipboard"></i> Module Not Yet Defined — Details to be captured in KT Session</div>
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
