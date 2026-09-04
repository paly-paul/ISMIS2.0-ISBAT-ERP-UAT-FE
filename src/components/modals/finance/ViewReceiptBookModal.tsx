'use client'
import { ModalProps } from '../types'
import { ReceiptBook, STATUS_LABELS, CATEGORY_LABELS, BOOK_CATEGORY_LABELS } from '@/lib/api/finance/receiptBook'

interface ViewReceiptBookModalProps extends ModalProps {
  receiptBook: ReceiptBook | null
  onEdit?: (receiptBook: ReceiptBook) => void
  canEdit?: boolean
}

function Field({ label, value, mono, wide }: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g500)', marginBottom: '4px' }}>{label}</div>
      <div className={mono ? 'font-mono' : undefined} style={{ fontSize: mono ? '13px' : '14px', color: 'var(--g900)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

// No GetByGuid endpoint exists for receipt books (see ReceiptBookFormModal's
// own note) — this reads straight off the row the page already has in its
// list, same as Edit mode does, rather than fetching fresh.
export function ViewReceiptBookModal({ isOpen, onClose, receiptBook, onEdit, canEdit }: ViewReceiptBookModalProps) {
  if (!isOpen || !receiptBook) return null

  return (
    <div className="modal-overlay open" id="view-receipt-book-modal">
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-eye"></i> View Receipt Book — <span className="font-mono">{receiptBook.bookCode}</span></div>
          <button className="modal-close" onClick={onClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: '20px clamp(14px, 4vw, 22px)' }}>
          <div className="view-detail-grid">
            <Field label="Book Code" value={receiptBook.bookCode} mono />
            <Field label="Prefix" value={receiptBook.prefix || '—'} mono />
            <Field label="Start — End No." value={`${receiptBook.startNo} — ${receiptBook.endNo ?? '—'}`} mono />
            <Field label="Current Receipt" value={receiptBook.receipt ?? '—'} mono />
            <Field label="Count" value={receiptBook.count ?? '—'} />
            <Field label="Category" value={CATEGORY_LABELS[receiptBook.category] ?? '—'} />
            <Field label="Book Category" value={receiptBook.bookCategory != null ? BOOK_CATEGORY_LABELS[receiptBook.bookCategory] : '—'} />
            <Field label="Copy" value={receiptBook.copy ?? '—'} />
            <Field label="Status" value={
              STATUS_LABELS[receiptBook.status] === 'Active'
                ? <span className="badge badge-green"><i className="lni lni-checkmark"></i> Active</span>
                : <span className="badge badge-grey">Inactive</span>
            } />
          </div>
        </div>

        <div className="modal-footer">
          <span className="flex-1"></span>
          {canEdit && onEdit && (
            <button className="btn btn-neu" onClick={() => onEdit(receiptBook)}>
              <i className="lni lni-pencil"></i> Edit
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
