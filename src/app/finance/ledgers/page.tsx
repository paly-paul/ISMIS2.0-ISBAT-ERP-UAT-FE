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
import { LedgerFormModal } from '@/components/modals/finance/LedgerFormModal'
import { ViewLedgerModal } from '@/components/modals/finance/ViewLedgerModal'
import { useLedgers, useCreateLedger, useUpdateLedger, useDeleteLedger, Ledger } from '@/hooks/finance/useLedgers'
import { useProcGlAccounts } from '@/hooks/finance/useProcGlAccounts'
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
  const [editingLedgerGuid, setEditingLedgerGuid] = useState<string | null>(null)
  const [viewingLedgerGuid, setViewingLedgerGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Ledger | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useLedgers()
  const { data: glAccounts = [] } = useProcGlAccounts()
  const createLedger = useCreateLedger()
  const updateLedger = useUpdateLedger()
  const deleteLedger = useDeleteLedger()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // procGlAccountGuid isn't confirmed present on the read shape (only
  // intGlAccount is documented) — resolve a name via the already-loaded GL
  // account list when it is, otherwise fall back to the raw legacy int since
  // ProcGlAccounts has no names-by-id lookup to resolve it properly.
  function glAccountLabel(ledger: Ledger) {
    if (ledger.procGlAccountGuid) {
      const acc = glAccounts.find(a => a.procGlAccountGuid === ledger.procGlAccountGuid)
      if (acc) return `${acc.shortCode} — ${acc.accName}`
    }
    if (ledger.intGlAccount != null) return `GL #${ledger.intGlAccount}`
    return null
  }

  function openEditModal(guid: string) {
    setEditingLedgerGuid(guid)
    openModal('edit-ledger-modal')
  }

  function openViewModal(guid: string) {
    setViewingLedgerGuid(guid)
    openModal('view-ledger-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.ledgerCode} ${r.ledgerName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.ledgerCode} ${r.ledgerName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteLedger() {
    if (!deleteTarget) return
    deleteLedger.mutate(deleteTarget.ledgerGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Ledger deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete ledger', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Ledger Master</div>
            <div className="pg-sub">Define ledger codes used across fee structures and financial records</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-ledger-modal')}>
              <i className="lni lni-plus"></i> Add Ledger
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-book"></i></span> Ledgers</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.ledgerGuid, primary: r.ledgerCode, secondary: r.ledgerName }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Ledger Code</th>
                  <th>Ledger Name</th>
                  <th>GL Account</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.ledgerGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.ledgerGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.ledgerGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold">{r.ledgerCode}</td>
                    <td><strong>{r.ledgerName}</strong></td>
                    <td>{glAccountLabel(r) ?? <span className="text-g400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="ledgers" onPageChange={setPage} />
        </div>
      </div>
      <LedgerFormModal
        mode="new"
        isOpen={openModals.has('new-ledger-modal')}
        onClose={() => closeModal('new-ledger-modal')}
        showToast={showToast}
        ledgerGuid={null}
        createLedger={createLedger}
        updateLedger={updateLedger}
      />
      <LedgerFormModal
        mode="edit"
        isOpen={openModals.has('edit-ledger-modal')}
        onClose={() => closeModal('edit-ledger-modal')}
        showToast={showToast}
        ledgerGuid={editingLedgerGuid}
        createLedger={createLedger}
        updateLedger={updateLedger}
      />
      <ViewLedgerModal
        isOpen={openModals.has('view-ledger-modal')}
        onClose={() => closeModal('view-ledger-modal')}
        showToast={showToast}
        ledgerGuid={viewingLedgerGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-ledger-modal'); if (viewingLedgerGuid) openEditModal(viewingLedgerGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.ledgerName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this ledger. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteLedger.isPending} onClick={confirmDeleteLedger}>
                <i className="lni lni-trash-can"></i> {deleteLedger.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
