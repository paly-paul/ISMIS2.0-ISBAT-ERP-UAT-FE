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
import { CurrencyFormModal } from '@/components/modals/finance/CurrencyFormModal'
import { ViewCurrencyModal } from '@/components/modals/finance/ViewCurrencyModal'
import { useCurrencies, useCreateCurrency, useUpdateCurrency, useDeleteCurrency, Currency } from '@/hooks/finance/useCurrencies'
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
  const [editingCurrencyGuid, setEditingCurrencyGuid] = useState<string | null>(null)
  const [viewingCurrencyGuid, setViewingCurrencyGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useCurrencies()
  const createCurrency = useCreateCurrency()
  const updateCurrency = useUpdateCurrency()
  const deleteCurrency = useDeleteCurrency()

  function nav(id: string) { router.push('/config/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingCurrencyGuid(guid)
    openModal('edit-currency-modal')
  }

  function openViewModal(guid: string) {
    setViewingCurrencyGuid(guid)
    openModal('view-currency-modal')
    setSearch('')
  }

  function confirmDeleteCurrency() {
    if (!deleteTarget?.currencyGuid) return
    deleteCurrency.mutate(deleteTarget.currencyGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Currency deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete currency', 'error'),
    })
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.currencyCode} ${r.currencyName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.currencyCode} ${r.currencyName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Currency Master</div>
            <div className="pg-sub">Configure system currencies and set the default</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-currency-modal')}>
              <i className="lni lni-plus"></i> Add Currency
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-dollar"></i></span> Currencies</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: String(r.intCurrency), primary: r.currencyCode, secondary: r.currencyName }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => {
                const row = rows.find(x => String(x.intCurrency) === r.id)
                if (row?.currencyGuid) openViewModal(row.currencyGuid)
              }}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Currency Code</th>
                  <th>Currency Name</th>
                  <th>Default</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.intCurrency}>
                    <td>
                      {(permissions.edit || permissions.delete || true) && (
                        <ActionMenu>
                          <button
                            className="btn btn-neu btn-sm"
                            disabled={!r.currencyGuid}
                            title={r.currencyGuid ? undefined : 'This row has no currencyGuid to view by'}
                            onClick={() => r.currencyGuid && openViewModal(r.currencyGuid)}
                          >
                            <i className="lni lni-eye"></i> View
                          </button>
                          {permissions.edit && (
                            <button
                              className="btn btn-neu btn-sm"
                              disabled={!r.currencyGuid}
                              title={r.currencyGuid ? undefined : 'This row has no currencyGuid to edit by'}
                              onClick={() => r.currencyGuid && openEditModal(r.currencyGuid)}
                            >
                              <i className="lni lni-pencil"></i> Edit
                            </button>
                          )}
                          {permissions.delete && (
                            <button
                              className="btn btn-neu btn-sm"
                              disabled={!r.currencyGuid}
                              title={r.currencyGuid ? undefined : 'This row has no currencyGuid to delete by'}
                              onClick={() => r.currencyGuid && setDeleteTarget(r)}
                            >
                              <i className="lni lni-trash-can"></i> Delete
                            </button>
                          )}
                        </ActionMenu>
                      )}
                    </td>
                    <td className="font-mono font-bold">{r.currencyCode}</td>
                    <td><strong>{r.currencyName}</strong></td>
                    <td>
                      {r.isDefault === 1
                        ? <span className="badge badge-green">Default</span>
                        : <span className="badge-grey">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="currencies" onPageChange={setPage} />
        </div>
      </div>
      <CurrencyFormModal
        mode="new"
        isOpen={openModals.has('new-currency-modal')}
        onClose={() => closeModal('new-currency-modal')}
        showToast={showToast}
        currencyGuid={null}
        createCurrency={createCurrency}
        updateCurrency={updateCurrency}
      />
      <CurrencyFormModal
        mode="edit"
        isOpen={openModals.has('edit-currency-modal')}
        onClose={() => closeModal('edit-currency-modal')}
        showToast={showToast}
        currencyGuid={editingCurrencyGuid}
        createCurrency={createCurrency}
        updateCurrency={updateCurrency}
      />
      <ViewCurrencyModal
        isOpen={openModals.has('view-currency-modal')}
        onClose={() => closeModal('view-currency-modal')}
        showToast={showToast}
        currencyGuid={viewingCurrencyGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-currency-modal'); if (viewingCurrencyGuid) openEditModal(viewingCurrencyGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.currencyCode}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this currency. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteCurrency.isPending} onClick={confirmDeleteCurrency}>
                <i className="lni lni-trash-can"></i> {deleteCurrency.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
