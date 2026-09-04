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
import { DiscountFormModal } from '@/components/modals/finance/DiscountFormModal'
import { ViewDiscountModal } from '@/components/modals/finance/ViewDiscountModal'
import { useDiscounts, useCreateDiscount, useUpdateDiscount, useDeleteDiscount, Discount } from '@/hooks/finance/useDiscounts'
import { CALC_TYPE_LABELS, CALC_TYPE_VALUES } from '@/lib/api/finance/discount'
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
  const [editingDiscountGuid, setEditingDiscountGuid] = useState<string | null>(null)
  const [viewingDiscountGuid, setViewingDiscountGuid] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useDiscounts()
  const createDiscount = useCreateDiscount()
  const updateDiscount = useUpdateDiscount()
  const deleteDiscount = useDeleteDiscount()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(guid: string) {
    setEditingDiscountGuid(guid)
    openModal('edit-discount-modal')
  }

  function openViewModal(guid: string) {
    setViewingDiscountGuid(guid)
    openModal('view-discount-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.discountCode} ${r.discountName}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.discountCode} ${r.discountName}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteDiscount() {
    if (!deleteTarget) return
    deleteDiscount.mutate(deleteTarget.discountGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Discount deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete discount', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Discount Master</div>
            <div className="pg-sub">Manage discounts applied to student fee structures</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-discount-modal')}>
              <i className="lni lni-plus"></i> Add Discount
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-tag"></i></span> Discounts</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.discountGuid, primary: r.discountCode, secondary: r.discountName }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => openViewModal(r.id)}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Discount Code</th>
                  <th>Discount Name</th>
                  <th>Calculation Type</th>
                  <th>Amount / Percentage</th>
                  <th>Carry Forward</th>
                  <th>COP</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? <TableLoadingState colSpan={999} />
                  : filteredRows.length === 0
                    ? <EmptyState colSpan={999} hasFilters={!!search} onClearFilters={() => setSearch('')} />
                    : null}
                {pageItems.map((r) => (
                  <tr key={r.discountGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.discountGuid)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r.discountGuid)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.discountCode}</td>
                    <td><strong>{r.discountName}</strong></td>
                    <td>{r.calcType != null ? CALC_TYPE_LABELS[r.calcType] : <span className="text-g400">—</span>}</td>
                    <td>
                      {r.amtPer != null
                        ? r.calcType === CALC_TYPE_VALUES.Percentage ? `${r.amtPer}%` : r.amtPer
                        : <span className="text-g400">—</span>}
                    </td>
                    <td>
                      {r.carry === 1
                        ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Yes</span>
                        : <span className="badge badge-grey">No</span>
                      }
                    </td>
                    <td>{r.cop ?? <span className="text-g400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="discounts" onPageChange={setPage} />
        </div>
      </div>
      <DiscountFormModal
        mode="new"
        isOpen={openModals.has('new-discount-modal')}
        onClose={() => closeModal('new-discount-modal')}
        showToast={showToast}
        discountGuid={null}
        createDiscount={createDiscount}
        updateDiscount={updateDiscount}
      />
      <DiscountFormModal
        mode="edit"
        isOpen={openModals.has('edit-discount-modal')}
        onClose={() => closeModal('edit-discount-modal')}
        showToast={showToast}
        discountGuid={editingDiscountGuid}
        createDiscount={createDiscount}
        updateDiscount={updateDiscount}
      />
      <ViewDiscountModal
        isOpen={openModals.has('view-discount-modal')}
        onClose={() => closeModal('view-discount-modal')}
        showToast={showToast}
        discountGuid={viewingDiscountGuid}
        canEdit={permissions.edit}
        onEdit={() => { closeModal('view-discount-modal'); if (viewingDiscountGuid) openEditModal(viewingDiscountGuid) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.discountName}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this discount. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteDiscount.isPending} onClick={confirmDeleteDiscount}>
                <i className="lni lni-trash-can"></i> {deleteDiscount.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
