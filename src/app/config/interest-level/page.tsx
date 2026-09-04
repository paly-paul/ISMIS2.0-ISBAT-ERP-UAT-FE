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
import { InterestLevelFormModal } from '@/components/modals/config/InterestLevelFormModal'
import { ViewInterestLevelModal } from '@/components/modals/config/ViewInterestLevelModal'
import { useInterestLevels, useCreateInterestLevel, useUpdateInterestLevel, useDeleteInterestLevel, InterestLevel } from '@/hooks/admission/useInterestLevels'
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
  const [editingLevelGuid, setEditingLevelGuid] = useState<string | null>(null)
  const [viewingLevelGuid, setViewingLevelGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InterestLevel | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useInterestLevels()
  const createInterestLevel = useCreateInterestLevel()
  const updateInterestLevel = useUpdateInterestLevel()
  const deleteInterestLevel = useDeleteInterestLevel()

  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => r.interestLevelName.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || r.interestLevelName.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingLevelGuid(guid)
    openModal('edit-interest-level-modal')
  }

  function openViewModal(guid: string) {
    setViewingLevelGuid(guid)
    openModal('view-interest-level-modal')
    setSearch('')
  }

  function confirmDeleteInterestLevel() {
    if (!deleteTarget) return
    deleteInterestLevel.mutate(deleteTarget.interestLevelGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Interest level deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete interest level', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Interest Level Master</div>
            <div className="pg-sub">Manage the levels used to rate an applicant's interest during admissions</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-interest-level-modal')}>
              <i className="lni lni-plus"></i> Add Interest Level
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-signal"></i></span> Interest Levels</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.interestLevelGuid, primary: r.interestLevelName }))}
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
                  <th>Interest Level Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.interestLevelGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.interestLevelGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.interestLevelGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td><strong>{r.interestLevelName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="interest levels" onPageChange={setPage} />
        </div>
      </div>
      <InterestLevelFormModal
        mode="new"
        isOpen={openModals.has('new-interest-level-modal')}
        onClose={() => closeModal('new-interest-level-modal')}
        showToast={showToast}
        interestLevelGuid={null}
        createInterestLevel={createInterestLevel}
        updateInterestLevel={updateInterestLevel}
      />
      <InterestLevelFormModal
        mode="edit"
        isOpen={openModals.has('edit-interest-level-modal')}
        onClose={() => closeModal('edit-interest-level-modal')}
        showToast={showToast}
        interestLevelGuid={editingLevelGuid}
        createInterestLevel={createInterestLevel}
        updateInterestLevel={updateInterestLevel}
      />
      <ViewInterestLevelModal
        isOpen={openModals.has('view-interest-level-modal')}
        onClose={() => closeModal('view-interest-level-modal')}
        showToast={showToast}
        interestLevelGuid={viewingLevelGuid}
        onEdit={() => {
          closeModal('view-interest-level-modal')
          openEditModal(viewingLevelGuid!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.interestLevelName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this interest level. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteInterestLevel.isPending} onClick={confirmDeleteInterestLevel}>
                <i className="lni lni-trash-can"></i> {deleteInterestLevel.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
