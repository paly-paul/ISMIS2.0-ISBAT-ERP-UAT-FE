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
import { FollowUpModeFormModal } from '@/components/modals/config/FollowUpModeFormModal'
import { ViewFollowUpModeModal } from '@/components/modals/config/ViewFollowUpModeModal'
import { useFollowUpModes, useCreateFollowUpMode, useUpdateFollowUpMode, useDeleteFollowUpMode, FollowUpMode } from '@/hooks/admission/useFollowUpModes'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// TEMPORARY BOOTSTRAP OVERRIDE: after a DB reset there is no permission
// group yet, so /me/menu correctly comes back with add:false/edit:false for
// this page - nobody has been granted the right to create one yet. Force
// both on here, same convention as src/app/config/permission-master/page.tsx
// and the "TEMPORARY" overrides in src/lib/api/users/menu.ts. Remove once
// real permission groups exist and normal /me/menu-driven gating can take
// back over.
const BOOTSTRAP_FORCE_PERMISSIONS = true

export default function Page() {
  const router = useRouter()
  const realPermissions = usePagePermissions()
  const permissions = BOOTSTRAP_FORCE_PERMISSIONS
    ? { ...realPermissions, add: true, edit: true }
    : realPermissions
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [editingModeGuid, setEditingModeGuid] = useState<string | null>(null)
  const [viewingModeGuid, setViewingModeGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FollowUpMode | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useFollowUpModes()
  const createFollowUpMode = useCreateFollowUpMode()
  const updateFollowUpMode = useUpdateFollowUpMode()
  const deleteFollowUpMode = useDeleteFollowUpMode()

  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => r.followUpModeName.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || r.followUpModeName.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingModeGuid(guid)
    openModal('edit-followup-mode-modal')
  }

  function openViewModal(guid: string) {
    setViewingModeGuid(guid)
    openModal('view-followup-mode-modal')
    setSearch('')
  }

  function confirmDeleteFollowUpMode() {
    if (!deleteTarget) return
    deleteFollowUpMode.mutate(deleteTarget.followUpModeGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Followup mode deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete followup mode', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Followup Mode Master</div>
            <div className="pg-sub">Manage the channels used to follow up with admission enquiries</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-followup-mode-modal')}>
              <i className="lni lni-plus"></i> Add Followup Mode
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-comments"></i></span> Followup Modes</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.followUpModeGuid, primary: r.followUpModeName }))}
                minChars={MIN_SEARCH_CHARS}
                onSelect={(r) => openViewModal(r.id)}
              />
            </div>
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Followup Mode Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.followUpModeGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.followUpModeGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.followUpModeGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td><strong>{r.followUpModeName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="followup modes" onPageChange={setPage} />
        </div>
      </div>
      <FollowUpModeFormModal
        mode="new"
        isOpen={openModals.has('new-followup-mode-modal')}
        onClose={() => closeModal('new-followup-mode-modal')}
        showToast={showToast}
        followUpModeGuid={null}
        createFollowUpMode={createFollowUpMode}
        updateFollowUpMode={updateFollowUpMode}
      />
      <FollowUpModeFormModal
        mode="edit"
        isOpen={openModals.has('edit-followup-mode-modal')}
        onClose={() => closeModal('edit-followup-mode-modal')}
        showToast={showToast}
        followUpModeGuid={editingModeGuid}
        createFollowUpMode={createFollowUpMode}
        updateFollowUpMode={updateFollowUpMode}
      />
      <ViewFollowUpModeModal
        isOpen={openModals.has('view-followup-mode-modal')}
        onClose={() => closeModal('view-followup-mode-modal')}
        showToast={showToast}
        followUpModeGuid={viewingModeGuid}
        onEdit={() => {
          closeModal('view-followup-mode-modal')
          openEditModal(viewingModeGuid!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.followUpModeName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this followup mode. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteFollowUpMode.isPending} onClick={confirmDeleteFollowUpMode}>
                <i className="lni lni-trash-can"></i> {deleteFollowUpMode.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
