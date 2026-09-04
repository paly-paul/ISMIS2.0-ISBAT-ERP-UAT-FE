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
import { BankFormModal } from '@/components/modals/finance/BankFormModal'
import { ViewBankModal } from '@/components/modals/finance/ViewBankModal'
import { useBanks, useCreateBank, useUpdateBank, useDeleteBank, Bank } from '@/hooks/finance/useBanks'
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
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useBanks()
  const createBank = useCreateBank()
  const updateBank = useUpdateBank()
  const deleteBank = useDeleteBank()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingBankGuid(guid)
    openModal('edit-bank-modal')
  }

  function openViewModal(guid: string) {
    setViewingBankGuid(guid)
    openModal('view-bank-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.shortCode} ${r.bankName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.shortCode} ${r.bankName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteBank() {
    if (!deleteTarget) return
    deleteBank.mutate(deleteTarget.bankGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Bank deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete bank', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Bank Master</div>
            <div className="pg-sub">Manage the banks available for reference across Finance</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-bank-modal')}>
              <i className="lni lni-plus"></i> Add Bank
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-coin"></i></span> Banks</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.bankGuid, primary: r.shortCode, secondary: r.bankName }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.bankGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.bankGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.bankGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.shortCode}</td>
                    <td><strong>{r.bankName}</strong></td>
                    <td>{r.compCode ?? <span className="text-g400">—</span>}</td>
                    <td>{r.branchCode ?? <span className="text-g400">—</span>}</td>
                    <td>
                      {STATUS_LABELS[r.status] === 'Active'
                        ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Active</span>
                        : <span className="badge badge-grey">Inactive</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="banks" onPageChange={setPage} />
        </div>
      </div>
      <BankFormModal
        mode="new"
        isOpen={openModals.has('new-bank-modal')}
        onClose={() => closeModal('new-bank-modal')}
        showToast={showToast}
        bankGuid={null}
        createBank={createBank}
        updateBank={updateBank}
      />
      <BankFormModal
        mode="edit"
        isOpen={openModals.has('edit-bank-modal')}
        onClose={() => closeModal('edit-bank-modal')}
        showToast={showToast}
        bankGuid={editingBankGuid}
        createBank={createBank}
        updateBank={updateBank}
      />
      <ViewBankModal
        isOpen={openModals.has('view-bank-modal')}
        onClose={() => closeModal('view-bank-modal')}
        showToast={showToast}
        bankGuid={viewingBankGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-bank-modal'); if (viewingBankGuid) openEditModal(viewingBankGuid) }}
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
              <button className="btn btn-danger" disabled={deleteBank.isPending} onClick={confirmDeleteBank}>
                <i className="lni lni-trash-can"></i> {deleteBank.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
