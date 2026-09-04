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
import { ProcGlAccountFormModal } from '@/components/modals/finance/ProcGlAccountFormModal'
import { ViewProcGlAccountModal } from '@/components/modals/finance/ViewProcGlAccountModal'
import { useProcGlAccounts, useCreateProcGlAccount, useUpdateProcGlAccount, useDeleteProcGlAccount, ProcGlAccount } from '@/hooks/finance/useProcGlAccounts'
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/api/finance/procGlAccount'
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
  const [editingAccountGuid, setEditingAccountGuid] = useState<string | null>(null)
  const [viewingAccountGuid, setViewingAccountGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcGlAccount | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useProcGlAccounts()
  const createProcGlAccount = useCreateProcGlAccount()
  const updateProcGlAccount = useUpdateProcGlAccount()
  const deleteProcGlAccount = useDeleteProcGlAccount()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingAccountGuid(guid)
    openModal('edit-proc-gl-account-modal')
  }

  function openViewModal(guid: string) {
    setViewingAccountGuid(guid)
    openModal('view-proc-gl-account-modal')
    setSearch('')
  }

  // Live preview shown in the search dropdown as the user types — matches
  // the same code/name test as the table's own search filter below, capped
  // to a handful of rows.
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.shortCode} ${r.accName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.shortCode} ${r.accName}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return true
  })

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteProcGlAccount() {
    if (!deleteTarget) return
    deleteProcGlAccount.mutate(deleteTarget.procGlAccountGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('GL account deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete GL account', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Proc GL Account Master</div>
            <div className="pg-sub">Manage the general ledger accounts used for procurement postings</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-proc-gl-account-modal')}>
              <i className="lni lni-plus"></i> Add GL Account
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-calculator"></i></span> GL Accounts</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.procGlAccountGuid, primary: r.shortCode, secondary: r.accName }))}
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
                  <th>Short Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Blocked</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.procGlAccountGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.procGlAccountGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.procGlAccountGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold">{r.shortCode}</td>
                    <td><strong>{r.accName}</strong></td>
                    <td>{TYPE_LABELS[r.type] ?? <span className="text-g400">—</span>}</td>
                    <td>
                      {STATUS_LABELS[r.status] === 'Active'
                        ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Active</span>
                        : <span className="badge badge-grey">Inactive</span>
                      }
                    </td>
                    <td>
                      {r.blocked
                        ? <span className="badge badge-red">Blocked</span>
                        : <span className="badge badge-grey">No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="GL accounts" onPageChange={setPage} />
        </div>
      </div>
      <ProcGlAccountFormModal
        mode="new"
        isOpen={openModals.has('new-proc-gl-account-modal')}
        onClose={() => closeModal('new-proc-gl-account-modal')}
        showToast={showToast}
        procGlAccountGuid={null}
        createProcGlAccount={createProcGlAccount}
        updateProcGlAccount={updateProcGlAccount}
      />
      <ProcGlAccountFormModal
        mode="edit"
        isOpen={openModals.has('edit-proc-gl-account-modal')}
        onClose={() => closeModal('edit-proc-gl-account-modal')}
        showToast={showToast}
        procGlAccountGuid={editingAccountGuid}
        createProcGlAccount={createProcGlAccount}
        updateProcGlAccount={updateProcGlAccount}
      />
      <ViewProcGlAccountModal
        isOpen={openModals.has('view-proc-gl-account-modal')}
        onClose={() => closeModal('view-proc-gl-account-modal')}
        showToast={showToast}
        procGlAccountGuid={viewingAccountGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-proc-gl-account-modal'); if (viewingAccountGuid) openEditModal(viewingAccountGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.accName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this GL account. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteProcGlAccount.isPending} onClick={confirmDeleteProcGlAccount}>
                <i className="lni lni-trash-can"></i> {deleteProcGlAccount.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
