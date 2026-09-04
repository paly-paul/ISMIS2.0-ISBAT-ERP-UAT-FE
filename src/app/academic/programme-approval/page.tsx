'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { SearchSelect } from '@/components/SearchSelect'
import { TableSearch } from '@/components/TableSearch'
import { ViewProgrammeModal } from '@/components/modals/academic/ViewProgrammeModal'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useProgramApprovals, useUpdateProgramApproval } from '@/hooks/academic/useProgramApproval'
import { useDeleteProgramMasterComplete } from '@/hooks/academic/useProgramMaster'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { formatDate } from '@/lib/date'
import { useStreams } from '@/hooks/config/useStreams'

const PAGE_SIZE = 10
// Don't hit the search endpoint (or open the search dropdown) until the
// user's typed at least this many characters — same convention as the
// other academic master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  
  const [levelFilter, setLevelFilter] = useState('')
  const [search, setSearch] = useState('')
  
  const [viewingProgramGuid, setViewingProgramGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ programGuid: string; progName: string } | null>(null)

  // Debounced so the backend's ?search= isn't hit on every keystroke, and
  // held at '' (falling back to the unfiltered list) until MIN_SEARCH_CHARS
  // is met — this page already had a real server-side search wired up
  // (get-program-master-not-approved.md), it just wasn't debounced yet.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: approvalsData, isLoading, isFetching } = useProgramApprovals(1, 1000, debouncedSearch)
  const programs = approvalsData?.items || []
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isFetching)

  const updateProgramApproval = useUpdateProgramApproval()
  const deleteProgramMasterComplete = useDeleteProgramMasterComplete()
  const { data: streams = [] } = useStreams()

  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openViewModal(guid: string) {
    setViewingProgramGuid(guid)
    openModal('view-prog-modal')
    setSearch('')
  }

  function handleApprove(programGuid: string, isApproved: boolean) {
    updateProgramApproval.mutate({ programGuid, isApproved }, {
      onSuccess: () => showToast(`Programme ${isApproved ? 'approved' : 'rejected'} successfully`),
      onError: (error: Error) => showToast(error.message || 'Failed to update approval', 'error'),
    })
  }

  function confirmDeleteProgram() {
    if (!deleteTarget) return
    deleteProgramMasterComplete.mutate(deleteTarget.programGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Programme deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete programme', 'error'),
    })
  }

  useEffect(() => {
    function closeFilter(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('th')) setOpenFilter(null)
    }
    document.addEventListener('click', closeFilter)
    return () => document.removeEventListener('click', closeFilter)
  }, [])

  const rows = programs.map(p => {
    const specializationNames = ((p as any).streamGuids || [])
      .map((guid: string) => streams.find(s => s.streamGuid === guid)?.streamName)
      .filter((name: any): name is string => !!name)

    return {
      programGuid: p.programGuid,
      progCode: p.programCode,
      progName: p.programName,
      group: p.programGroupName || '—',
      level: p.programLevelName ? `${p.programLevelName} · ${p.yearCount}yr / ${p.semCount}sem` : `${p.yearCount}yr / ${p.semCount}sem`,
      faculty: p.facultyName || '—',
      dateAccRaw: p.dateAcc,
      accredDate: p.dateAcc ? formatDate(p.dateAcc) : '—',
      noIA: p.noIa ? 'Yes' : 'No',
      specializations: specializationNames.length > 0 ? specializationNames.join(', ') : '—',
      admissionStatus: 'Not Approved'
    }
  }).sort((a, b) => new Date(b.dateAccRaw || 0).getTime() - new Date(a.dateAccRaw || 0).getTime())

  const groupFilterOpts = Array.from(new Set(rows.map(r => r.group)))
  const levelFilterOpts = Array.from(new Set(rows.map(r => r.level)))
  const levelDropdownOpts = Array.from(new Set(rows.map(r => r.level.split(' ·')[0])))

  // Empty below MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on
  // when the dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.progCode} ${r.progName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (levelFilter && !r.level.startsWith(levelFilter)) return false
    // Re-filter client-side on top of whatever the server sent back — rows
    // is already search-scoped via debouncedSearch, but this keeps results
    // correct even if the backend doesn't actually honor ?search=.
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.progCode} ${r.progName}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as Record<string, unknown>)[k])))
  })

  const [page, setPage] = useState(1)

  // Reset back to page 1 whenever the (debounced) search term or level
  // filter changes — the previous page offset almost never lands on a valid
  // page of the newly-filtered result set.
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, levelFilter])

  const totalCount = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageItems = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
          <div><div className="pg-title">Programme Approval</div><div className="pg-sub">Approve or delete pending programmes</div></div>
        </div>

        <Breadcrumb items={[
          { label: 'Programme Level', icon: 'lni lni-graduation', id: 'programme-level' },
          { label: 'Programme Group', icon: 'lni lni-folder', id: 'programme-group' },
          { label: 'Programme Master', icon: 'lni lni-graduation', id: 'programme-master' },
          { label: 'Programme Approval', icon: 'lni lni-check-box' },
          { label: 'Course Units', icon: 'lni lni-book', id: 'course-units' },
        ]} />

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-check-box"></i></span> Pending Approvals</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.programGuid, primary: r.progCode, secondary: r.progName }))}
                loading={searchPending}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(r) => openViewModal(r.id)}
              />
              <SearchSelect
                className="w-auto text-[var(--fs-sm)]"
                placeholder="All Levels"
                options={levelDropdownOpts}
                value={levelFilter}
                onChange={setLevelFilter}
              />
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead><tr><th style={{ width: 48 }}></th><th>Prog. Code</th><th>Programme Name</th>{fth('Group', 'group', groupFilterOpts)}{fth('Programme Level', 'level', levelFilterOpts)}<th>Faculty → Campus</th><th>Accreditation Date</th><th>No IA</th></tr></thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0) || !!search || !!levelFilter} onClearFilters={() => { setFilters({}); setSearch(''); setLevelFilter('') }} />
                    : null}
                {!(isLoading || searchPending) && pageItems.map(r => (
                  <tr key={r.programGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.programGuid)}><i className="lni lni-eye"></i> View</button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" style={{ color: 'var(--green, #10b981)' }} onClick={() => handleApprove(r.programGuid, true)}><i className="lni lni-checkmark"></i> Approve</button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" style={{ color: 'var(--danger, #ef4444)' }} onClick={() => setDeleteTarget({ programGuid: r.programGuid, progName: r.progName })}><i className="lni lni-trash-can"></i> Delete</button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-[var(--fs-xs)] text-b700">{r.progCode}</td>
                    <td><strong>{r.progName}</strong></td>
                    <td>{r.group}</td>
                    <td>{r.level}</td>
                    <td>{r.faculty}</td>
                    <td>{r.accredDate}</td>
                    <td>
                      {r.noIA === 'Yes'
                        ? <span className="badge badge-amber"><i className="lni lni-checkmark"></i> No Internal Assessment</span>
                        : <span className="badge badge-grey">No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="programmes" onPageChange={setPage} />
        </div>
      </div>

      <ViewProgrammeModal
        isOpen={openModals.has('view-prog-modal')}
        onClose={() => closeModal('view-prog-modal')}
        showToast={showToast}
        programGuid={viewingProgramGuid}
      />

      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.progName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this programme version and all its course units and fee structures. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteProgramMasterComplete.isPending} onClick={confirmDeleteProgram}>
                <i className="lni lni-trash-can"></i> {deleteProgramMasterComplete.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
