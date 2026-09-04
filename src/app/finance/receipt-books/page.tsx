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
import { ReceiptBookFormModal } from '@/components/modals/finance/ReceiptBookFormModal'
import { ViewReceiptBookModal } from '@/components/modals/finance/ViewReceiptBookModal'
import { useReceiptBooks, useCreateReceiptBook, useUpdateReceiptBook, useDeleteReceiptBook, ReceiptBook } from '@/hooks/finance/useReceiptBooks'
import { STATUS_LABELS, CATEGORY_LABELS, BOOK_CATEGORY_LABELS } from '@/lib/api/finance/receiptBook'
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
  const [editingBook, setEditingBook] = useState<ReceiptBook | null>(null)
  const [viewingBook, setViewingBook] = useState<ReceiptBook | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReceiptBook | null>(null)
  const [search, setSearch] = useState('')

  const { data: rows = [], isLoading } = useReceiptBooks()
  const createReceiptBook = useCreateReceiptBook()
  const updateReceiptBook = useUpdateReceiptBook()
  const deleteReceiptBook = useDeleteReceiptBook()

  function nav(id: string) { router.push('/finance/' + id) }
  function openModal(id: string)  { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  function openEditModal(book: ReceiptBook) {
    setEditingBook(book)
    openModal('edit-receipt-book-modal')
  }

  function openViewModal(book: ReceiptBook) {
    setViewingBook(book)
    openModal('view-receipt-book-modal')
    setSearch('')
  }

  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    searchTrimmed.length < MIN_SEARCH_CHARS || `${r.bookCode} ${r.prefix ?? ''}`.toLowerCase().includes(searchTrimmed.toLowerCase())
  )

  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? rows.filter(r => `${r.bookCode} ${r.prefix ?? ''}`.toLowerCase().includes(searchTrimmed.toLowerCase())).slice(0, 8)
    : []

  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function confirmDeleteReceiptBook() {
    if (!deleteTarget) return
    deleteReceiptBook.mutate(deleteTarget.receiptBookGuid, {
      onSuccess: () => { setDeleteTarget(null); showToast('Receipt book deleted successfully') },
      onError: (error: Error) => showToast(error.message || 'Failed to delete receipt book', 'error'),
    })
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Receipt Book Master</div>
            <div className="pg-sub">Manage numbered receipt books used for cash, bank, and online payments</div>
          </div>
          {permissions.add && (
            <button className="btn btn-primary" onClick={() => openModal('new-receipt-book-modal')}>
              <i className="lni lni-plus"></i> Add Receipt Book
            </button>
          )}
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-ticket"></i></span> Receipt Books</div>
            <TableSearch
              className="w-56"
              placeholder="Search by code or prefix…"
              value={search}
              onChange={setSearch}
              results={searchMatches.map(r => ({ id: r.receiptBookGuid, primary: r.bookCode, secondary: r.prefix || undefined }))}
              minChars={MIN_SEARCH_CHARS}
              onSelect={(r) => {
                const row = rows.find(x => x.receiptBookGuid === r.id)
                if (row) openViewModal(row)
              }}
            />
          </div>
          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Book Code</th>
                  <th>Prefix</th>
                  <th>Start — End No.</th>
                  <th>Current Receipt</th>
                  <th>Count</th>
                  <th>Category</th>
                  <th>Book Category</th>
                  <th>Copy</th>
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
                  <tr key={r.receiptBookGuid}>
                    <td>
                      <ActionMenu>
                        <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r)}>
                          <i className="lni lni-eye"></i> View
                        </button>
                        {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openEditModal(r)}>
                          <i className="lni lni-pencil"></i> Edit
                        </button>}
                        {permissions.delete && <button className="btn btn-neu btn-sm" onClick={() => setDeleteTarget(r)}>
                          <i className="lni lni-trash-can"></i> Delete
                        </button>}
                      </ActionMenu>
                    </td>
                    <td className="font-mono font-bold uppercase">{r.bookCode}</td>
                    <td className="font-mono uppercase">{r.prefix || <span className="text-g400">—</span>}</td>
                    <td className="font-mono">{r.startNo} — {r.endNo ?? '—'}</td>
                    <td className="font-mono">{r.receipt ?? <span className="text-g400">—</span>}</td>
                    <td>{r.count ?? <span className="text-g400">—</span>}</td>
                    <td>{CATEGORY_LABELS[r.category] ?? <span className="text-g400">—</span>}</td>
                    <td>{r.bookCategory != null ? BOOK_CATEGORY_LABELS[r.bookCategory] : <span className="text-g400">—</span>}</td>
                    <td>{r.copy ?? <span className="text-g400">—</span>}</td>
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
          <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="receipt books" onPageChange={setPage} />
        </div>
      </div>
      <ReceiptBookFormModal
        mode="new"
        isOpen={openModals.has('new-receipt-book-modal')}
        onClose={() => closeModal('new-receipt-book-modal')}
        showToast={showToast}
        receiptBook={null}
        createReceiptBook={createReceiptBook}
        updateReceiptBook={updateReceiptBook}
      />
      <ReceiptBookFormModal
        mode="edit"
        isOpen={openModals.has('edit-receipt-book-modal')}
        onClose={() => closeModal('edit-receipt-book-modal')}
        showToast={showToast}
        receiptBook={editingBook}
        createReceiptBook={createReceiptBook}
        updateReceiptBook={updateReceiptBook}
      />
      <ViewReceiptBookModal
        isOpen={openModals.has('view-receipt-book-modal')}
        onClose={() => closeModal('view-receipt-book-modal')}
        showToast={showToast}
        receiptBook={viewingBook}
        canEdit={permissions.edit}
        onEdit={(book) => { closeModal('view-receipt-book-modal'); openEditModal(book) }}
      />
      <Toast toast={toast} />

      {deleteTarget && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 500 }} onClick={() => setDeleteTarget(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-trash-can"></i></div>
            <div className="perm-delete-title">Delete {deleteTarget.bookCode}?</div>
            <div className="perm-delete-sub">
              This will permanently delete this receipt book. This can&apos;t be undone.
            </div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleteReceiptBook.isPending} onClick={confirmDeleteReceiptBook}>
                <i className="lni lni-trash-can"></i> {deleteReceiptBook.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
