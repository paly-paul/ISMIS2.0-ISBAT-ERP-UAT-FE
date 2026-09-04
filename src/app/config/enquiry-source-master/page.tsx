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
import { EnquirySourceMasterFormModal } from '@/components/modals/config/EnquirySourceMasterFormModal'
import { ViewEnquirySourceMasterModal } from '@/components/modals/config/ViewEnquirySourceMasterModal'
import { useEnquirySourceMasters, useCreateEnquirySourceMaster, useUpdateEnquirySourceMaster, useDeleteEnquirySourceMaster, EnquirySourceMaster } from '@/hooks/admission/useEnquirySourceMasters'
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
  const [editingSourceGuid, setEditingSourceGuid] = useState<string | null>(null)
  const [viewingSourceGuid, setViewingSourceGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnquirySourceMaster | null>(null)
  const [search, setSearch] = useState('')

  // No created-date field on this record (just guid + name) — approximate
  // "newest first" by reversing the list, assuming the backend returns rows
  // in insertion order. .slice() first so react-query's cached array (rows)
  // isn't mutated in place by reverse().
  const { data: rows = [], isLoading } = useEnquirySourceMasters()
  const rowsNewestFirst = rows.slice().reverse()
  const createEnquirySourceMaster = useCreateEnquirySourceMaster()
  const updateEnquirySourceMaster = useUpdateEnquirySourceMaster()
  const deleteEnquirySourceMaster = useDeleteEnquirySourceMaster()

  // Live preview shown in the search dropdown as the user types — matches
  // the same source-name test as the table's own search filter below.
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rowsNewestFirst.filter(r => r.enquirySourceName.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rowsNewestFirst.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || r.enquirySourceName.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingSourceGuid(guid)
    openModal('edit-enquiry-source-master-modal')
  }

  function openViewModal(guid: string) {
    setViewingSourceGuid(guid)
    openModal('view-enquiry-source-master-modal')
    setSearch('')
  }

  function confirmDeleteEnquirySourceMaster() {
    if (!deleteTarget) return
    deleteEnquirySourceMaster.mutate(deleteTarget.enquirySourceGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Enquiry source deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete enquiry source', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Enquiry Source Master</div>
            <div className="pg-sub">Manage the channels through which admission enquiries originate</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-enquiry-source-master-modal')}>
              <i className="lni lni-plus"></i> Add Enquiry Source
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-volume"></i></span> Enquiry Sources</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.enquirySourceGuid, primary: r.enquirySourceName }))}
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
                  <th>Source Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.enquirySourceGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.enquirySourceGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.enquirySourceGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td><strong>{r.enquirySourceName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="enquiry sources" onPageChange={setPage} />
        </div>
      </div>
      <EnquirySourceMasterFormModal
        mode="new"
        isOpen={openModals.has('new-enquiry-source-master-modal')}
        onClose={() => closeModal('new-enquiry-source-master-modal')}
        showToast={showToast}
        enquirySourceGuid={null}
        createEnquirySourceMaster={createEnquirySourceMaster}
        updateEnquirySourceMaster={updateEnquirySourceMaster}
      />
      <EnquirySourceMasterFormModal
        mode="edit"
        isOpen={openModals.has('edit-enquiry-source-master-modal')}
        onClose={() => closeModal('edit-enquiry-source-master-modal')}
        showToast={showToast}
        enquirySourceGuid={editingSourceGuid}
        createEnquirySourceMaster={createEnquirySourceMaster}
        updateEnquirySourceMaster={updateEnquirySourceMaster}
      />
      <ViewEnquirySourceMasterModal
        isOpen={openModals.has('view-enquiry-source-master-modal')}
        onClose={() => closeModal('view-enquiry-source-master-modal')}
        showToast={showToast}
        enquirySourceGuid={viewingSourceGuid}
        onEdit={() => {
          closeModal('view-enquiry-source-master-modal')
          openEditModal(viewingSourceGuid!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.enquirySourceName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this enquiry source. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteEnquirySourceMaster.isPending} onClick={confirmDeleteEnquirySourceMaster}>
                <i className="lni lni-trash-can"></i> {deleteEnquirySourceMaster.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
