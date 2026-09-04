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
import { CooperateFormModal } from '@/components/modals/finance/CooperateFormModal'
import { ViewCooperateModal } from '@/components/modals/finance/ViewCooperateModal'
import { useCooperates, useCreateCooperate, useUpdateCooperate, useDeleteCooperate, Cooperate } from '@/hooks/finance/useCooperates'
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
  const [editingCooperateGuid, setEditingCooperateGuid] = useState<string | null>(null)
  const [viewingCooperateGuid, setViewingCooperateGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cooperate | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useCooperates()
  const createCooperate = useCreateCooperate()
  const updateCooperate = useUpdateCooperate()
  const deleteCooperate = useDeleteCooperate()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingCooperateGuid(guid)
    openModal('edit-cooperate-modal')
  }

  function openViewModal(guid: string) {
    setViewingCooperateGuid(guid)
    openModal('view-cooperate-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.cooperateCode} ${r.cooperateName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.cooperateCode} ${r.cooperateName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteCooperate() {
    if (!deleteTarget) return
    deleteCooperate.mutate(deleteTarget.cooperateGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Cooperate deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete cooperate', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Cooperate Master</div>
            <div className="pg-sub">Manage corporate partners linked to student fee accounts</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-cooperate-modal')}>
              <i className="lni lni-plus"></i> Add Cooperate
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-handshake"></i></span> Cooperates</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.cooperateGuid, primary: r.cooperateCode, secondary: r.cooperateName }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Cooperate Code</th>
                  <th>Cooperate Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.cooperateGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.cooperateGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.cooperateGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.cooperateCode}</td>
                    <td><strong>{r.cooperateName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="cooperates" onPageChange={setPage} />
        </div>
      </div>
      <CooperateFormModal
        mode="new"
        isOpen={openModals.has('new-cooperate-modal')}
        onClose={() => closeModal('new-cooperate-modal')}
        showToast={showToast}
        cooperateGuid={null}
        createCooperate={createCooperate}
        updateCooperate={updateCooperate}
      />
      <CooperateFormModal
        mode="edit"
        isOpen={openModals.has('edit-cooperate-modal')}
        onClose={() => closeModal('edit-cooperate-modal')}
        showToast={showToast}
        cooperateGuid={editingCooperateGuid}
        createCooperate={createCooperate}
        updateCooperate={updateCooperate}
      />
      <ViewCooperateModal
        isOpen={openModals.has('view-cooperate-modal')}
        onClose={() => closeModal('view-cooperate-modal')}
        showToast={showToast}
        cooperateGuid={viewingCooperateGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-cooperate-modal'); if (viewingCooperateGuid) openEditModal(viewingCooperateGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.cooperateName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this cooperate. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteCooperate.isPending} onClick={confirmDeleteCooperate}>
                <i className="lni lni-trash-can"></i> {deleteCooperate.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
