'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import { SuccessPopup } from '../shared/SuccessPopup'
import { FailurePopup } from '../shared/FailurePopup'
import { SearchSelect } from '@/components/SearchSelect'
import {
  BOOK_CATEGORY_LABELS, BOOK_CATEGORY_VALUES, CATEGORY_LABELS, CATEGORY_VALUES, CreateReceiptBookInput, ReceiptBook, ReceiptBookCategory,
  ReceiptCategory, ReceiptBookStatus, STATUS_LABELS, STATUS_VALUES, UpdateReceiptBookInput,
} from '@/lib/api/finance/receiptBook'

// Add and Edit share this form. Edit's fields are more limited than Add's —
// bookCode/prefix/startNo/count are immutable once the book exists — and
// there's no GetByGuid endpoint, so Edit prefills from whatever row the
// page already has loaded rather than fetching fresh.
interface ReceiptBookFormModalProps extends ModalProps {
  mode: 'new' | 'edit'
  receiptBook: ReceiptBook | null
  createReceiptBook: {
    mutate: (input: CreateReceiptBookInput, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
  updateReceiptBook: {
    mutate: (variables: { guid: string; input: UpdateReceiptBookInput }, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => void
    isPending: boolean
  }
}

const STATUS_OPTS: ReceiptBookStatus[] = ['Active', 'Inactive']
const CATEGORY_OPTS: ReceiptCategory[] = ['Cash', 'Bank', 'Online']
const BOOK_CATEGORY_OPTS: ReceiptBookCategory[] = ['A', 'B']

export function ReceiptBookFormModal({ isOpen, onClose, showToast, mode, receiptBook, createReceiptBook, updateReceiptBook }: ReceiptBookFormModalProps) {
  const isEdit = mode === 'edit'

  const [saved, setSaved]           = useState(false)
  const [failure, setFailure]       = useState<string | null>(null)
  const [bookCode, setBookCode]     = useState('')
  const [startNo, setStartNo]       = useState('')
  const [prefix, setPrefix]         = useState('')
  const [count, setCount]           = useState('')
  const [status, setStatus]         = useState<ReceiptBookStatus>('Active')
  const [category, setCategory]     = useState<ReceiptCategory>('Cash')
  const [copy, setCopy]             = useState('')
  const [bookCategory, setBookCategory] = useState<ReceiptBookCategory | ''>('')
  const [errors, setErrors]         = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen) return
    if (isEdit && receiptBook) {
      setBookCode(receiptBook.bookCode)
      setPrefix(receiptBook.prefix ?? '')
      setStartNo(String(receiptBook.startNo))
      setCount(receiptBook.count != null ? String(receiptBook.count) : '')
      setStatus(STATUS_LABELS[receiptBook.status] ?? 'Active')
      setCategory(CATEGORY_LABELS[receiptBook.category] ?? 'Cash')
      setCopy(receiptBook.copy != null ? String(receiptBook.copy) : '')
      setBookCategory(receiptBook.bookCategory != null ? BOOK_CATEGORY_LABELS[receiptBook.bookCategory] ?? '' : '')
    } else if (!isEdit) {
      setBookCode(''); setStartNo(''); setPrefix(''); setCount('')
      setStatus('Active'); setCategory('Cash'); setCopy(''); setBookCategory('')
    }
    setErrors({})
  }, [isOpen, isEdit, receiptBook])

  if (!isOpen || (isEdit && !receiptBook)) return null

  function handleClose() { setSaved(false); setFailure(null); setErrors({}); onClose() }

  function validate() {
    const e: Record<string, string> = {}
    if (!isEdit) {
      if (!bookCode.trim()) e.bookCode = 'Book Code is required'
      if (!startNo || +startNo <= 0) e.startNo = 'Start No. must be greater than 0'
      if (!count || +count <= 0) e.count = 'Count must be greater than 0'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (isEdit && !receiptBook) return
    if (!validate()) return
    const onSuccess = () => { setSaved(true); showToast(isEdit ? 'Receipt book updated successfully' : 'Receipt book added successfully') }
    const onError = (error: Error) => setFailure(error.message || `Failed to ${isEdit ? 'update' : 'add'} receipt book. Please try again.`)

    if (isEdit && receiptBook) {
      const input: UpdateReceiptBookInput = {
        status: STATUS_VALUES[status],
        category: CATEGORY_VALUES[category],
        copy: copy ? +copy : null,
        bookCategory: bookCategory ? BOOK_CATEGORY_VALUES[bookCategory] : null,
      }
      updateReceiptBook.mutate({ guid: receiptBook.receiptBookGuid, input }, { onSuccess, onError })
    } else {
      const input: CreateReceiptBookInput = {
        bookCode,
        startNo: +startNo,
        prefix,
        count: +count,
        status: STATUS_VALUES[status],
        category: CATEGORY_VALUES[category],
        copy: copy ? +copy : null,
        bookCategory: bookCategory ? BOOK_CATEGORY_VALUES[bookCategory] : null,
      }
      createReceiptBook.mutate(input, { onSuccess, onError })
    }
  }

  const isPending = isEdit ? updateReceiptBook.isPending : createReceiptBook.isPending

  if (saved) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <SuccessPopup
            title={isEdit ? 'Receipt Book Updated!' : 'Receipt Book Added!'}
            subtitle={isEdit ? 'Your changes have been saved successfully.' : 'The new receipt book has been saved successfully.'}
            onClose={handleClose}
          />
        </div>
      </div>
    )
  }

  if (failure) {
    return (
      <div className="modal-overlay open">
        <div className="modal" style={{ maxWidth: 400 }}>
          <FailurePopup title={isEdit ? "Couldn't Update Receipt Book" : "Couldn't Add Receipt Book"} subtitle={failure} onClose={() => setFailure(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay open" id={isEdit ? 'edit-receipt-book-modal' : 'new-receipt-book-modal'}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title">
            <i className={`lni ${isEdit ? 'lni-pencil' : 'lni-ticket'}`}></i> {isEdit ? 'Edit Receipt Book' : 'Add Receipt Book'}
            {isEdit && receiptBook && <> — <span className="font-mono">{receiptBook.bookCode}</span></>}
          </div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div className="g2">
          <div className="fg">
            <div className="lbl">Book Code {!isEdit && <span className="req">*</span>}</div>
            {isEdit ? (
              <input className="ctrl font-mono uppercase" type="text" value={bookCode} disabled />
            ) : (
              <input
                className="ctrl font-mono uppercase"
                type="text"
                placeholder="e.g. RB-2026-001"
                maxLength={50}
                value={bookCode}
                onChange={e => { setBookCode(e.target.value.toUpperCase()); if (errors.bookCode) setErrors(p => ({ ...p, bookCode: '' })) }}
                style={errors.bookCode ? { borderColor: 'var(--red)' } : undefined}
              />
            )}
            {errors.bookCode && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.bookCode}</p>}
          </div>
          <div className="fg">
            <div className="lbl">Prefix</div>
            {isEdit ? (
              <input className="ctrl font-mono uppercase" type="text" value={prefix} disabled />
            ) : (
              <input
                className="ctrl font-mono uppercase"
                type="text"
                placeholder="e.g. RC"
                maxLength={10}
                value={prefix}
                onChange={e => setPrefix(e.target.value.toUpperCase())}
              />
            )}
          </div>
          {isEdit ? (
            <>
              <div className="fg">
                <div className="lbl">Start No. — End No.</div>
                <input className="ctrl" type="text" value={`${startNo} — ${receiptBook?.endNo ?? '—'}`} disabled />
              </div>
              <div className="fg">
                <div className="lbl">Count</div>
                <input className="ctrl" type="text" value={count || '—'} disabled />
              </div>
            </>
          ) : (
            <>
              <div className="fg">
                <div className="lbl">Start No. <span className="req">*</span></div>
                <input
                  className="ctrl"
                  type="number"
                  placeholder="e.g. 1"
                  min={1}
                  value={startNo}
                  onChange={e => { setStartNo(e.target.value); if (errors.startNo) setErrors(p => ({ ...p, startNo: '' })) }}
                  style={errors.startNo ? { borderColor: 'var(--red)' } : undefined}
                />
                {errors.startNo && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.startNo}</p>}
              </div>
              <div className="fg">
                <div className="lbl">Count <span className="req">*</span></div>
                <input
                  className="ctrl"
                  type="number"
                  placeholder="e.g. 100"
                  min={1}
                  value={count}
                  onChange={e => { setCount(e.target.value); if (errors.count) setErrors(p => ({ ...p, count: '' })) }}
                  style={errors.count ? { borderColor: 'var(--red)' } : undefined}
                />
                {errors.count && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.count}</p>}
              </div>
            </>
          )}
          <div className="fg">
            <div className="lbl">Status</div>
            <SearchSelect options={STATUS_OPTS} value={status} onChange={val => setStatus(val as ReceiptBookStatus)} />
          </div>
          <div className="fg">
            <div className="lbl">Category</div>
            <SearchSelect options={CATEGORY_OPTS} value={category} onChange={val => setCategory(val as ReceiptCategory)} />
          </div>
          <div className="fg">
            <div className="lbl">Copy</div>
            <input
              className="ctrl"
              type="number"
              placeholder="e.g. 1"
              min={0}
              value={copy}
              onChange={e => setCopy(e.target.value)}
            />
          </div>
          <div className="fg">
            <div className="lbl">Book Category</div>
            <SearchSelect
              placeholder="— Select —"
              options={BOOK_CATEGORY_OPTS}
              value={bookCategory}
              onChange={val => setBookCategory(val as ReceiptBookCategory)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={isPending} onClick={handleSubmit}>
            <i className="lni lni-checkmark"></i> {isPending ? (isEdit ? 'Updating…' : 'Adding…') : (isEdit ? 'Update Receipt Book' : 'Add Receipt Book')}
          </button>
        </div>
      </div>
    </div>
  )
}
