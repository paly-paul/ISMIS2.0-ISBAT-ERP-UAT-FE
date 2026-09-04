'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { ProgrammeLevelFormModal } from '@/components/modals/academic/ProgrammeLevelFormModal'
import { ViewProgrammeLevelModal } from '@/components/modals/academic/ViewProgrammeLevelModal'
import { Toast } from '@/components/Toast'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { useCreateProgramLevel, useDeleteProgramLevel, useProgramLevels, useProgramLevelSearch, useUpdateProgramLevel, ProgramLevel } from '@/hooks/academic/useProgramLevels'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as Intake/Skill/
// Batch/Repetition Tag's search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingProgramLevelGuid, setEditingProgramLevelGuid] = useState<string | null>(null)
  const [viewingProgramLevelGuid, setViewingProgramLevelGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProgramLevel | null>(null)

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

  const { data: rows = [], isLoading } = useProgramLevels()

  // Debounced so the backend's ?search= isn't hit on every keystroke, and
  // held at '' (falling back to the unfiltered list) until MIN_SEARCH_CHARS
  // is met — same convention as Intake/Skill/Repetition Tag's search boxes.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchResults, isFetching: isSearching } = useProgramLevelSearch(debouncedSearch)
  const baseRows = debouncedSearch ? (searchResults ?? []) : rows
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isSearching)

  const createProgramLevel = useCreateProgramLevel()
  const updateProgramLevel = useUpdateProgramLevel()
  const deleteProgramLevel = useDeleteProgramLevel()

  // Re-filter client-side on top of whatever the server sent back (this
  // endpoint's ?search= support was already in place before this page's
  // search box was wired up to it, but pairing it with a client-side
  // re-filter — same as Repetition Tag/Batch Management — keeps results
  // correct even if it turns out not to actually filter server-side), then
  // apply the column filters on top.
  const filteredRows = baseRows.filter(r => {
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.levelCode} ${r.levelName}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as unknown as Record<string, unknown>)[k])))
  })

  // Live preview shown in the search dropdown as the user types — same
  // code/name test as filteredRows above, ignoring the column filters and
  // capped to a handful of rows. Empty below MIN_SEARCH_CHARS, matching
  // TableSearch's own minChars gate on when the dropdown is even allowed to
  // open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? baseRows.filter(r => `${r.levelCode} ${r.levelName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function openEditModal(guid: string) {
    setEditingProgramLevelGuid(guid)
    openModal('edit-alevel-modal')
  }

  function openViewModal(guid: string) {
    setViewingProgramLevelGuid(guid)
    openModal('view-alevel-modal')
    setSearch('')
  }

  function confirmDeleteProgramLevel() {
    if (!deleteTarget) return
    deleteProgramLevel.mutate(deleteTarget.programLevelGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Programme Level deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete programme level', 'error'),
    })
  }

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
          <div><div className="pg-title">Programme Level Master</div><div className="pg-sub">Define programme levels (Bachelor&apos;s, Master&apos;s, PhD etc.) · Set year count, semester count and minimum credit load</div></div>
          {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-alevel-modal')}><i className="lni lni-plus"></i> Add Level</button>}
        </div>

        <Breadcrumb items={[
          { label: 'Programme Level', icon: 'lni lni-graduation' },
          { label: 'Programme Group', icon: 'lni lni-folder', id: 'programme-group' },
          { label: 'Programme Master', icon: 'lni lni-graduation', id: 'programme-master' },
          { label: 'Programme Approval', icon: 'lni lni-check-box', id: 'programme-approval' },
          { label: 'Course Units', icon: 'lni lni-book', id: 'course-units' },
        ]} />

        {/* <div className="info-box mb-[18px]">
          <i className="lni lni-information"></i> Programme Level defines the <strong>fundamental attributes</strong> of every programme at that level (year count, semester count, minimum credit load). Selecting a level in the Programme Master auto-populates these values — e.g. selecting Bachelor&apos;s defaults to 3 years, 6 semesters.
        </div> */}

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-graduation"></i></span> Defined Programme Levels</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.programLevelGuid, primary: r.levelCode, secondary: r.levelName }))}
              loading={searchPending}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Level Code</th>
                  <th>Level Name</th>
                  <th>Year Count</th>
                  <th>Semester Count</th>
                  <th>Min. Credit Load</th>
                  {/* Not part of the confirmed GET /api/v1/academic/program-levels
                  response — kept for reference until/unless the backend adds it.
                  {fth('No Internal Assessment', 'noIA', ['Yes', 'No'])}
                  <th>Linked Programmes</th>
                  */}
                </tr>
              </thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search || Object.values(filters).some(v => v.length > 0)} onClearFilters={() => { setSearch(''); setFilters({}) }} />
                    : null}
                {!(isLoading || searchPending) && pageItems.map((r) => (
                  <tr key={r.programLevelGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.programLevelGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.programLevelGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-b700">{r.levelCode}</td>
                    <td><strong>{r.levelName}</strong></td>
                    <td>{r.yearCount}</td>
                    <td>{r.semCount}</td>
                    <td>{r.minCreditLoad}</td>
                    {/* Not part of the confirmed GET /api/v1/academic/program-levels
                    response — kept for reference until/unless the backend adds it.
                    <td>
                      {r.noIA === 'Yes'
                        ? <span className="badge badge-amber"><i className="lni lni-checkmark"></i> Yes — No IA</span>
                        : <span className="badge badge-grey">No</span>
                      }
                    </td>
                    <td>{r.linkedProgs}</td>
                    */}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="programme levels" onPageChange={setPage} />
        </div>
      </div>
      <ViewProgrammeLevelModal
        isOpen={openModals.has('view-alevel-modal')}
        onClose={() => closeModal('view-alevel-modal')}
        showToast={showToast}
        programLevelGuid={viewingProgramLevelGuid}
        canEdit={permissions.edit}
        onEdit={() => {
          closeModal('view-alevel-modal')
          if (viewingProgramLevelGuid) openEditModal(viewingProgramLevelGuid)
        }}
      />
      <ProgrammeLevelFormModal
        mode="new"
        isOpen={openModals.has('new-alevel-modal')}
        onClose={() => closeModal('new-alevel-modal')}
        showToast={showToast}
        programLevelGuid={null}
        createProgramLevel={createProgramLevel}
        updateProgramLevel={updateProgramLevel}
      />
      <ProgrammeLevelFormModal
        mode="edit"
        isOpen={openModals.has('edit-alevel-modal')}
        onClose={() => closeModal('edit-alevel-modal')}
        showToast={showToast}
        programLevelGuid={editingProgramLevelGuid}
        createProgramLevel={createProgramLevel}
        updateProgramLevel={updateProgramLevel}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.levelName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this programme level. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteProgramLevel.isPending} onClick={confirmDeleteProgramLevel}>
                <i className="lni lni-trash-can"></i> {deleteProgramLevel.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
