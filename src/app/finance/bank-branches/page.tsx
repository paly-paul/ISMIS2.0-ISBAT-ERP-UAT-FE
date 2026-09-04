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
import { BankBranchFormModal } from '@/components/modals/finance/BankBranchFormModal'
import { ViewBankBranchModal } from '@/components/modals/finance/ViewBankBranchModal'
import { useBankBranches, useCreateBankBranch, useUpdateBankBranch, useDeleteBankBranch, BankBranch } from '@/hooks/finance/useBankBranches'
import { useBanks } from '@/hooks/finance/useBanks'
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
  const [editingBranchGuid, setEditingBranchGuid] = useState<string | null>(null)
  const [viewingBranchGuid, setViewingBranchGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BankBranch | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useBankBranches()
  const { data: banks = [] } = useBanks()
  const createBankBranch = useCreateBankBranch()
  const updateBankBranch = useUpdateBankBranch()
  const deleteBankBranch = useDeleteBankBranch()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function bankName(guid: string) {
    return banks.find(b => b.bankGuid === guid)?.bankName ?? guid
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.shortCode} ${r.branchName} ${bankName(r.bankGuid)}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.shortCode} ${r.branchName} ${bankName(r.bankGuid)}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function openEditModal(guid: string) {
    setEditingBranchGuid(guid)
    openModal('edit-bank-branch-modal')
  }

  function openViewModal(guid: string) {
    setViewingBranchGuid(guid)
    openModal('view-bank-branch-modal')
    setSearch('')
  }

  function confirmDeleteBankBranch() {
    if (!deleteTarget) return
    deleteBankBranch.mutate(deleteTarget.bankBranchGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Bank branch deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete bank branch', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Bank Branch Master</div>
            <div className="pg-sub">Manage branches under each bank</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-bank-branch-modal')}>
              <i className="lni lni-plus"></i> Add Bank Branch
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-map-marker"></i></span> Bank Branches</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.bankBranchGuid, primary: r.shortCode, secondary: r.branchName }))}
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
                  <th>Branch Name</th>
                  <th>Bank</th>
                  <th>Sort Code</th>
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
                  <tr key={r.bankBranchGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.bankBranchGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.bankBranchGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.shortCode}</td>
                    <td><strong>{r.branchName}</strong></td>
                    <td>{bankName(r.bankGuid)}</td>
                    <td className="font-mono">{r.sortCode}</td>
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
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="bank branches" onPageChange={setPage} />
        </div>
      </div>
      <BankBranchFormModal
        mode="new"
        isOpen={openModals.has('new-bank-branch-modal')}
        onClose={() => closeModal('new-bank-branch-modal')}
        showToast={showToast}
        bankBranchGuid={null}
        createBankBranch={createBankBranch}
        updateBankBranch={updateBankBranch}
      />
      <BankBranchFormModal
        mode="edit"
        isOpen={openModals.has('edit-bank-branch-modal')}
        onClose={() => closeModal('edit-bank-branch-modal')}
        showToast={showToast}
        bankBranchGuid={editingBranchGuid}
        createBankBranch={createBankBranch}
        updateBankBranch={updateBankBranch}
      />
      <ViewBankBranchModal
        isOpen={openModals.has('view-bank-branch-modal')}
        onClose={() => closeModal('view-bank-branch-modal')}
        showToast={showToast}
        bankBranchGuid={viewingBranchGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-bank-branch-modal'); if (viewingBranchGuid) openEditModal(viewingBranchGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.branchName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this bank branch. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteBankBranch.isPending} onClick={confirmDeleteBankBranch}>
                <i className="lni lni-trash-can"></i> {deleteBankBranch.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
