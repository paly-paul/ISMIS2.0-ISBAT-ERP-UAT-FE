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
import { EnquiryStatusFormModal } from '@/components/modals/config/EnquiryStatusFormModal'
import { ViewEnquiryStatusModal } from '@/components/modals/config/ViewEnquiryStatusModal'
import { useEnquiryStatuses, useCreateEnquiryStatus, useUpdateEnquiryStatus, useDeleteEnquiryStatus, EnquiryStatus } from '@/hooks/config/useEnquiryStatuses'
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
  const [editingEnquiryStatusGuid, setEditingEnquiryStatusGuid] = useState<string | null>(null)
  const [viewingEnquiryStatusGuid, setViewingEnquiryStatusGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnquiryStatus | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useEnquiryStatuses()
  const createEnquiryStatus = useCreateEnquiryStatus()
  const updateEnquiryStatus = useUpdateEnquiryStatus()
  const deleteEnquiryStatus = useDeleteEnquiryStatus()

  // Live preview shown in the search dropdown as the user types — matches
  // the same code/name test as the table's own search filter below.
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.enquiryStatusCode} ${r.enquiryStatusName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.enquiryStatusCode} ${r.enquiryStatusName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingEnquiryStatusGuid(guid)
    openModal('edit-enquiry-status-modal')
  }

  function openViewModal(guid: string) {
    setViewingEnquiryStatusGuid(guid)
    openModal('view-enquiry-status-modal')
    setSearch('')
  }

  function confirmDeleteEnquiryStatus() {
    if (!deleteTarget) return
    deleteEnquiryStatus.mutate(deleteTarget.enquiryStatusGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Enquiry status deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete enquiry status', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Enquiry Status Master</div>
            <div className="pg-sub">Manage the statuses used to track admission enquiry follow-ups</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-enquiry-status-modal')}>
              <i className="lni lni-plus"></i> Add Enquiry Status
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-flag"></i></span> Enquiry Statuses</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.enquiryStatusGuid, primary: r.enquiryStatusCode, secondary: r.enquiryStatusName }))}
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
                  <th>Status Code</th>
                  <th>Status Name</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={false} onClearFilters={() => {}} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.enquiryStatusGuid}>
                    <td>
                      {(true) && (
                        <ActionMenu>
                          <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.enquiryStatusGuid)}><i className="lni lni-eye"></i> View</button>
                          {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.enquiryStatusGuid)}>
                            <i className="lni lni-pencil"></i> Edit
                          </button>}
                          {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                            <i className="lni lni-trash-can"></i> Delete
                          </button>}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="font-mono font-bold">{r.enquiryStatusCode}</td>
                    <td><strong>{r.enquiryStatusName}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="enquiry statuses" onPageChange={setPage} />
        </div>
      </div>
      <EnquiryStatusFormModal
        mode="new"
        isOpen={openModals.has('new-enquiry-status-modal')}
        onClose={() => closeModal('new-enquiry-status-modal')}
        showToast={showToast}
        enquiryStatusGuid={null}
        createEnquiryStatus={createEnquiryStatus}
        updateEnquiryStatus={updateEnquiryStatus}
      />
      <EnquiryStatusFormModal
        mode="edit"
        isOpen={openModals.has('edit-enquiry-status-modal')}
        onClose={() => closeModal('edit-enquiry-status-modal')}
        showToast={showToast}
        enquiryStatusGuid={editingEnquiryStatusGuid}
        createEnquiryStatus={createEnquiryStatus}
        updateEnquiryStatus={updateEnquiryStatus}
      />
      <ViewEnquiryStatusModal
        isOpen={openModals.has('view-enquiry-status-modal')}
        onClose={() => closeModal('view-enquiry-status-modal')}
        showToast={showToast}
        enquiryStatusGuid={viewingEnquiryStatusGuid}
        onEdit={() => {
          closeModal('view-enquiry-status-modal')
          openEditModal(viewingEnquiryStatusGuid!)
        }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.enquiryStatusName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this enquiry status. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteEnquiryStatus.isPending} onClick={confirmDeleteEnquiryStatus}>
                <i className="lni lni-trash-can"></i> {deleteEnquiryStatus.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
