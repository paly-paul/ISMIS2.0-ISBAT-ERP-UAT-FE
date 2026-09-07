'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { LedgerOtherFormModal } from '@/components/modals/finance/LedgerOtherFormModal'
import { ViewLedgerOtherModal } from '@/components/modals/finance/ViewLedgerOtherModal'
import { useLedgerOthersList, useCreateLedgerOther, useUpdateLedgerOther, useDeleteLedgerOther, LedgerOther } from '@/hooks/finance/useLedgerOthersMaster'
import { useProcGlAccounts } from '@/hooks/finance/useProcGlAccounts'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// The other-fees catalogue (ID replacement, transcript, lateral-entry fee,
// …) — ledger-others/*.md, a separate table from tuition ledgers
// (/finance/ledgers). Structured identically to that page (and to
// gen-sets/page.tsx): fetch-everything-once + client-side search/paginate,
// same ActionMenu/View-Edit-Delete convention as every other Finance
// master list.
export default function Page() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [toast, setToast]           = useState<{ msg: string; type: string } | null>(null)
  const [editingGuid, setEditingGuid] = useState<string | null>(null)
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LedgerOther | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useLedgerOthersList()
  // Newest first. LedgerOtherDto carries no createdDate/timestamp at all
  // (per get-ledger-others.md's own response shape) and the list endpoint
  // documents no ordering guarantee — this assumes the backend returns rows
  // in creation order (the common default for an unordered query) and just
  // reverses that, same "last one back is the newest" approximation used
  // where this app has no real timestamp to sort by. If the backend ever
  // starts sorting some other way, this will need revisiting.
  const sortedRows = useMemo(() => [...rows].reverse(), [rows])
  const { data: glAccounts = [] } = useProcGlAccounts()
  const createLedgerOther = useCreateLedgerOther()
  const updateLedgerOther = useUpdateLedgerOther()
  const deleteLedgerOther = useDeleteLedgerOther()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // procGlAccountGuid isn't confirmed present on the read shape (only
  // intGlAccount is documented) — resolve a name via the already-loaded GL
  // account list when it is, otherwise fall back to the raw legacy int
  // since ProcGlAccounts has no names-by-id lookup to resolve it properly.
  // Same fallback ledgers/page.tsx's own glAccountLabel() uses.
  function glAccountLabel(row: LedgerOther) {
    if (row.procGlAccountGuid) {
      const acc = glAccounts.find(a => a.procGlAccountGuid === row.procGlAccountGuid)
      if (acc) return `${acc.shortCode} — ${acc.accName}`
    }
    if (row.intGlAccount != null) return `GL #${row.intGlAccount}`
    return null
  }

  function openEditModal(guid: string) {
    setEditingGuid(guid)
    openModal('edit-ledger-other-modal')
  }

  function openViewModal(guid: string) {
    setViewingGuid(guid)
    openModal('view-ledger-other-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = sortedRows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.ledgerCode} ${r.ledgerName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? sortedRows.filter(r => `${r.ledgerCode} ${r.ledgerName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteLedgerOther() {
    if (!deleteTarget) return
    deleteLedgerOther.mutate(deleteTarget.ledgerOthersGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Other ledger deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete other ledger', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Other Ledgers</div>
            <div className="pg-sub">The other-fees catalogue (ID replacement, transcripts, lateral-entry fee, …) used by Other Payment</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-ledger-other-modal')}>
              <i className="lni lni-plus"></i> Add Other Ledger
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-book"></i></span> Other Ledgers</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.ledgerOthersGuid, primary: r.ledgerCode, secondary: r.ledgerName }))}
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
                  <tr key={r.ledgerOthersGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.ledgerOthersGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.ledgerOthersGuid)}>
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
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="other ledgers" onPageChange={setPage} />
        </div>
      </div>
      <LedgerOtherFormModal
        mode="new"
        isOpen={openModals.has('new-ledger-other-modal')}
        onClose={() => closeModal('new-ledger-other-modal')}
        showToast={showToast}
        ledgerOthersGuid={null}
        createLedgerOther={createLedgerOther}
        updateLedgerOther={updateLedgerOther}
      />
      <LedgerOtherFormModal
        mode="edit"
        isOpen={openModals.has('edit-ledger-other-modal')}
        onClose={() => closeModal('edit-ledger-other-modal')}
        showToast={showToast}
        ledgerOthersGuid={editingGuid}
        createLedgerOther={createLedgerOther}
        updateLedgerOther={updateLedgerOther}
      />
      <ViewLedgerOtherModal
        isOpen={openModals.has('view-ledger-other-modal')}
        onClose={() => closeModal('view-ledger-other-modal')}
        showToast={showToast}
        ledgerOthersGuid={viewingGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-ledger-other-modal'); if (viewingGuid) openEditModal(viewingGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.ledgerName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this other ledger. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteLedgerOther.isPending} onClick={confirmDeleteLedgerOther}>
                <i className="lni lni-trash-can"></i> {deleteLedgerOther.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
