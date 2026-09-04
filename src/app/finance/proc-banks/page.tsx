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
import { ProcBankFormModal } from '@/components/modals/finance/ProcBankFormModal'
import { ViewProcBankModal } from '@/components/modals/finance/ViewProcBankModal'
import { useProcBanks, useCreateProcBank, useUpdateProcBank, useDeleteProcBank, ProcBank } from '@/hooks/finance/useProcBanks'
import { STATUS_LABELS } from '@/lib/api/finance/procBank'
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
  const [editingBankGuid, setEditingBankGuid] = useState<string | null>(null)
  const [viewingBankGuid, setViewingBankGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProcBank | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useProcBanks()
  const createProcBank = useCreateProcBank()
  const updateProcBank = useUpdateProcBank()
  const deleteProcBank = useDeleteProcBank()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingBankGuid(guid)
    openModal('edit-proc-bank-modal')
  }

  function openViewModal(guid: string) {
    setViewingBankGuid(guid)
    openModal('view-proc-bank-modal')
    setSearch('')
  }

  // Live preview shown in the search dropdown as the user types — matches
  // the same code/name test as the table's own search filter below, capped
  // to a handful of rows.
  const searchTrimmed = search.trim()
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.shortCode} ${r.bankName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const filteredRows = rows.filter(r => {
    if (searchTrimmed.length >= MIN_SEARCH_CHARS && !`${r.shortCode} ${r.bankName}`.toLowerCase().includes(searchTrimmed.toLowerCase())) return false
    return true
  })

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteProcBank() {
    if (!deleteTarget) return
    deleteProcBank.mutate(deleteTarget.procBankGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Bank deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete bank', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Proc Bank Master</div>
            <div className="pg-sub">Manage the banks used for procurement payments and reconciliation</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-proc-bank-modal')}>
              <i className="lni lni-plus"></i> Add Bank
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-wallet"></i></span> Banks</div>
            <div className="flex gap-2">
              <TableSearch
                className="w-56"
                placeholder="Search by code or name…"
                value={search}
                onChange={setSearch}
                results={searchMatches.map(r => ({ id: r.procBankGuid, primary: r.shortCode, secondary: r.bankName }))}
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
                  <th>Bank Name</th>
                  <th>Company Code</th>
                  <th>Branch Code</th>
                  <th>Account Code</th>
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
                  <tr key={r.procBankGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.procBankGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.procBankGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.shortCode}</td>
                    <td><strong>{r.bankName}</strong></td>
                    <td>{r.compCode}</td>
                    <td>{r.branchCode}</td>
                    <td className="font-mono">{r.accountCode}</td>
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
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="procurement banks" onPageChange={setPage} />
        </div>
      </div>
      <ProcBankFormModal
        mode="new"
        isOpen={openModals.has('new-proc-bank-modal')}
        onClose={() => closeModal('new-proc-bank-modal')}
        showToast={showToast}
        procBankGuid={null}
        createProcBank={createProcBank}
        updateProcBank={updateProcBank}
      />
      <ProcBankFormModal
        mode="edit"
        isOpen={openModals.has('edit-proc-bank-modal')}
        onClose={() => closeModal('edit-proc-bank-modal')}
        showToast={showToast}
        procBankGuid={editingBankGuid}
        createProcBank={createProcBank}
        updateProcBank={updateProcBank}
      />
      <ViewProcBankModal
        isOpen={openModals.has('view-proc-bank-modal')}
        onClose={() => closeModal('view-proc-bank-modal')}
        showToast={showToast}
        procBankGuid={viewingBankGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-proc-bank-modal'); if (viewingBankGuid) openEditModal(viewingBankGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.bankName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this bank. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteProcBank.isPending} onClick={confirmDeleteProcBank}>
                <i className="lni lni-trash-can"></i> {deleteProcBank.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
