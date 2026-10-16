'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { ProgrammeGroupFormModal } from '@/components/modals/academic/ProgrammeGroupFormModal'
import { ViewProgrammeGroupModal } from '@/components/modals/academic/ViewProgrammeGroupModal'
import { Toast } from '@/components/Toast'
import { TableSearch } from '@/components/TableSearch'
import { FilterTh } from '@/components/FilterTh'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useCreateProgramGroup, useDeleteProgramGroup, useProgramGroupsPaged, useUpdateProgramGroup, ProgramGroup } from '@/hooks/academic/useProgramGroups'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as Intake/Skill/
// Batch/Repetition Tag/Programme Level's search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [editingProgramGroupGuid, setEditingProgramGroupGuid] = useState<string | null>(null)
  const [viewingProgramGroupGuid, setViewingProgramGroupGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProgramGroup | null>(null)
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

  // Real server-side pagination (2026-09-09) — only PAGE_SIZE rows are ever
  // requested for the page on screen (see useProgramGroupsPaged), not the
  // whole table in one 1000-row shot. Trade-off: the Programme Level column
  // filter below can now only narrow the rows already on the current page.
  const [page, setPage] = useState(1)
  const searchTrimmed = search.trim()
  const activeSearch = searchTrimmed.length >= MIN_SEARCH_CHARS ? searchTrimmed : ''
  const { data, isLoading, isFetching } = useProgramGroupsPaged(page, PAGE_SIZE, activeSearch)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && isFetching

  const createProgramGroup = useCreateProgramGroup()
  const updateProgramGroup = useUpdateProgramGroup()
  const deleteProgramGroup = useDeleteProgramGroup()

  // Search already happened server-side (see useProgramGroupsPaged above) —
  // this only applies the column filter on top of the current page's rows.
  const filteredRows = rows.filter(r =>
    Object.entries(filters).every(([k, v]) => !v.length || v.includes(String((r as unknown as Record<string, unknown>)[k])))
  )
  const pageItems = filteredRows

  // Live preview shown in the search dropdown as the user types — rows are
  // already server-filtered by activeSearch, so this just previews up to 8
  // of what's already loaded.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? filteredRows.slice(0, 8) : []

  function openEditModal(guid: string) {
    setEditingProgramGroupGuid(guid)
    openModal('edit-proggroup-modal')
  }

  function openViewModal(guid: string) {
    setViewingProgramGroupGuid(guid)
    openModal('view-proggroup-modal')
    setSearch('')
  }

  function confirmDeleteProgramGroup() {
    if (!deleteTarget) return
    deleteProgramGroup.mutate(deleteTarget.programGroupGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Programme Group deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete programme group', 'error'),
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
          <div><div className="pg-title">Programme Group Master</div><div className="pg-sub">Generic programme names for reporting · Groups all curriculum versions under one umbrella</div></div>
          {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-proggroup-modal')}><i className="lni lni-plus"></i> Add Programme Group</button>}
        </div>

        <Breadcrumb items={[
          { label: 'Programme Level', icon: 'lni lni-graduation', id: 'programme-level' },
          { label: 'Programme Group', icon: 'lni lni-folder' },
          { label: 'Programme Master', icon: 'lni lni-graduation', id: 'programme-master' },
          { label: 'Programme Approval', icon: 'lni lni-check-box', id: 'programme-approval' },
          { label: 'Course Units', icon: 'lni lni-book', id: 'course-units' },
        ]} />

        {/* <div className="info-box mb-[18px]">
          <i className="lni lni-information"></i> Programme Groups are used for <strong>high-level reporting</strong> — e.g. searching &quot;BCA&quot; returns all students across BCA 2026 <em>and</em> BCA 2031 versions. This ensures a single generic name links all curriculum versions for aggregate analytics.
        </div> */}

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> Programme Groups</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by group code or name…"
                value={search}
                onChange={v => { setSearch(v); setPage(1) }}
                results={searchMatches.map(r => ({ id: r.programGroupGuid, primary: r.groupCode, secondary: r.groupName }))}
                loading={searchPending}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(r) => openViewModal(r.id)}
              />
              <button className="btn btn-neu btn-sm"><i className="lni lni-upload"></i> Export</button>
            </div>
          </div>
          <ScrollTable filters={filters} onResetFilters={() => setFilters({})}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Group Code</th>
                  <th>Group Name</th>
                  {fth('Programme Level', 'programLevelName', Array.from(new Set(rows.map(r => r.programLevelName).filter(Boolean) as string[])))}
                  {/* Not part of the confirmed GET /api/v1/academic/program-groups
                  response — kept for reference until/unless the backend adds them.
                  <th>Active Versions</th>
                  <th>Inactive Versions</th>
                  <th>Total Students</th>
                  */}
                </tr>
              </thead>
              <tbody>
                {(isLoading || searchPending)
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={Object.values(filters).some(v => v.length > 0)} onClearFilters={() => setFilters({})} />
                    : null}
                {!(isLoading || searchPending) && pageItems.map((r) => (
                  <tr key={r.programGroupGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.programGroupGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.programGroupGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono text-b700">{r.groupCode}</td>
                    <td><strong>{r.groupName}</strong></td>
                    <td>{r.programLevelName}</td>
                    {/* Not part of the confirmed GET /api/v1/academic/program-groups
                    response — kept for reference until/unless the backend adds them.
                    <td><span className="badge badge-green">{r.activeVersions}</span></td>
                    <td>{r.inactiveVersions === '—' ? '—' : <span className="badge badge-grey">{r.inactiveVersions}</span>}</td>
                    <td>{r.students}</td>
                    */}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="programme groups" onPageChange={setPage} />
        </div>
      </div>
      <ViewProgrammeGroupModal canEdit={permissions.edit} onEdit={() => { closeModal('view-proggroup-modal'); openEditModal(viewingProgramGroupGuid || '') }}
        isOpen={openModals.has('view-proggroup-modal')}
        onClose={() => closeModal('view-proggroup-modal')}
        showToast={showToast}
        programGroupGuid={viewingProgramGroupGuid}
      />
      <ProgrammeGroupFormModal
        mode="new"
        isOpen={openModals.has('new-proggroup-modal')}
        onClose={() => closeModal('new-proggroup-modal')}
        showToast={showToast}
        programGroupGuid={null}
        createProgramGroup={createProgramGroup}
        updateProgramGroup={updateProgramGroup}
      />
      <ProgrammeGroupFormModal
        mode="edit"
        isOpen={openModals.has('edit-proggroup-modal')}
        onClose={() => closeModal('edit-proggroup-modal')}
        showToast={showToast}
        programGroupGuid={editingProgramGroupGuid}
        createProgramGroup={createProgramGroup}
        updateProgramGroup={updateProgramGroup}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.groupName}?</div>
            <div className="perm-delete-sub">
              This will delete this programme group. Programmes in this group are not checked first and will keep pointing to it, so reassign them before deleting.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteProgramGroup.isPending} onClick={confirmDeleteProgramGroup}>
                <i className="lni lni-trash-can"></i> {deleteProgramGroup.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
