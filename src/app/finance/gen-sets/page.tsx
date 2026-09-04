'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { GenSetFormModal } from '@/components/modals/finance/GenSetFormModal'
import { ViewGenSetModal } from '@/components/modals/finance/ViewGenSetModal'
import { useGenSets, useCreateGenSet, useUpdateGenSet, useDeleteGenSet, GenSet } from '@/hooks/finance/useGenSets'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [editingGenSetGuid, setEditingGenSetGuid] = useState<string | null>(null)
  const [viewingGenSetGuid, setViewingGenSetGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GenSet | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useGenSets()
  const createGenSet = useCreateGenSet()
  const updateGenSet = useUpdateGenSet()
  const deleteGenSet = useDeleteGenSet()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingGenSetGuid(guid)
    openModal('edit-genset-modal')
  }

  function openViewModal(guid: string) {
    setViewingGenSetGuid(guid)
    openModal('view-genset-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.type} ${r.condition}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.type} ${r.condition}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteGenSet() {
    if (!deleteTarget) return
    deleteGenSet.mutate(deleteTarget.genSetGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('General setting deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete general setting', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">General Settings (GenSets)</div>
            <div className="pg-sub">Configurable type/condition lookups used as reference data across Finance</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-genset-modal')}>
              <i className="lni lni-plus"></i> Add General Setting
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-cog"></i></span> General Settings</div>
            <TableSearch
              className="w-56"
              placeholder="Search by type or condition…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.genSetGuid, primary: r.type, secondary: r.condition }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Type</th>
                  <th>Condition</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.genSetGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.genSetGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.genSetGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.type}</td>
                    <td>{r.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="general settings" onPageChange={setPage} />
        </div>
      </div>
      <GenSetFormModal
        mode="new"
        isOpen={openModals.has('new-genset-modal')}
        onClose={() => closeModal('new-genset-modal')}
        showToast={showToast}
        genSetGuid={null}
        createGenSet={createGenSet}
        updateGenSet={updateGenSet}
      />
      <GenSetFormModal
        mode="edit"
        isOpen={openModals.has('edit-genset-modal')}
        onClose={() => closeModal('edit-genset-modal')}
        showToast={showToast}
        genSetGuid={editingGenSetGuid}
        createGenSet={createGenSet}
        updateGenSet={updateGenSet}
      />
      <ViewGenSetModal
        isOpen={openModals.has('view-genset-modal')}
        onClose={() => closeModal('view-genset-modal')}
        showToast={showToast}
        genSetGuid={viewingGenSetGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-genset-modal'); if (viewingGenSetGuid) openEditModal(viewingGenSetGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.type} — {deleteTarget.condition}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this general setting. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteGenSet.isPending} onClick={confirmDeleteGenSet}>
                <i className="lni lni-trash-can"></i> {deleteGenSet.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
