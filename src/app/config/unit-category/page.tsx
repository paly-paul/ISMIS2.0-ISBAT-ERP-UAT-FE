'use client'
import { useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { UnitCategoryFormModal } from '@/components/modals/config/UnitCategoryFormModal'
import { ViewUnitCategoryModal } from '@/components/modals/config/ViewUnitCategoryModal'
import { useUnitCategories, useCreateUnitCategory, useUpdateUnitCategory, useDeleteUnitCategory, UnitCategory } from '@/hooks/config/useUnitCategories'
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
  const realPermissions = usePagePermissions()
  const permissions = BOOTSTRAP_FORCE_PERMISSIONS
    ? { ...realPermissions, add: true, edit: true }
    : realPermissions
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [editingUnitCatGuid, setEditingUnitCatGuid] = useState<string | null>(null)
  const [viewingUnitCatGuid, setViewingUnitCatGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UnitCategory | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useUnitCategories()
  const createUnitCategory = useCreateUnitCategory()
  const updateUnitCategory = useUpdateUnitCategory()
  const deleteUnitCategory = useDeleteUnitCategory()

  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => r.unitCatName.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || r.unitCatName.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingUnitCatGuid(guid)
    openModal('edit-unit-category-modal')
  }

  function openViewModal(guid: string) {
    setViewingUnitCatGuid(guid)
    openModal('view-unit-category-modal')
    setSearch('')
  }

  function confirmDeleteUnitCategory() {
    if (!deleteTarget) return
    deleteUnitCategory.mutate(deleteTarget.unitCatGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Unit category deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete unit category', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Unit Category Master</div>
            <div className="pg-sub">Manage the unit categories used when allocating course units to a programme</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-unit-category-modal')}>
              <i className="lni lni-plus"></i> Add Unit Category
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-tag"></i></span> Unit Categories</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.unitCatGuid, primary: r.unitCatName }))}
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
                  <th>Unit Category Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.unitCatGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.unitCatGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.unitCatGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td><strong>{r.unitCatName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="unit categories" onPageChange={setPage} />
        </div>
      </div>
      <UnitCategoryFormModal
        mode="new"
        isOpen={openModals.has('new-unit-category-modal')}
        onClose={() => closeModal('new-unit-category-modal')}
        showToast={showToast}
        unitCatGuid={null}
        createUnitCategory={createUnitCategory}
        updateUnitCategory={updateUnitCategory}
      />
      <UnitCategoryFormModal
        mode="edit"
        isOpen={openModals.has('edit-unit-category-modal')}
        onClose={() => closeModal('edit-unit-category-modal')}
        showToast={showToast}
        unitCatGuid={editingUnitCatGuid}
        createUnitCategory={createUnitCategory}
        updateUnitCategory={updateUnitCategory}
      />
      <ViewUnitCategoryModal
        isOpen={openModals.has('view-unit-category-modal')}
        onClose={() => closeModal('view-unit-category-modal')}
        showToast={showToast}
        unitCatGuid={viewingUnitCatGuid}
        onEdit={() => {
          closeModal('view-unit-category-modal')
          openEditModal(viewingUnitCatGuid!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.unitCatName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this unit category. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteUnitCategory.isPending} onClick={confirmDeleteUnitCategory}>
                <i className="lni lni-trash-can"></i> {deleteUnitCategory.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
