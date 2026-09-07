'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import DatePicker from '@/components/DatePicker'
import { useUpdateRegulatoryPayment, PaymentCategory, RegulatoryPaymentHistoryEntry } from '@/hooks/finance/useNcheGuildPayment'

interface EditRegulatoryPaymentModalProps extends ModalProps {
  target: RegulatoryPaymentHistoryEntry | null
  category: PaymentCategory
  applicationGuid: string | null
  studentGuid: string | null
}

const CATEGORY_LABEL: Record<PaymentCategory, string> = { nche: 'NCHE', guild: 'Guild' }

function isoToYmd(iso: string) {
  return iso.slice(0, 10)
}

// Correct a recorded NCHE/Guild payment (put-payment-nche.md /
// put-payment-guild.md) — reached from the history table's own Edit
// action, replacing the page's old "populate the create form, scroll down,
// Save routes through a confirm dialog" flow with a direct modal edit, same
// convention as Payment Console's own EditPaymentModal. No confirm step
// here (unlike this page's own Delete, which still confirms first) —
// correcting an amount/date/remark isn't the irreversible, cascading
// operation Payment Console's tuition edit is, so a plain Save is enough.
export function EditRegulatoryPaymentModal({ isOpen, onClose, showToast, target, category, applicationGuid, studentGuid }: EditRegulatoryPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [pnrNumber, setPnrNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [bankDeposit, setBankDeposit] = useState('')

  useEffect(() => {
    if (isOpen && target) {
      setAmount(String(target.amount))
      setPayDate(isoToYmd(target.payDate))
      setPnrNumber(target.pnrNumber ?? '')
      setRemarks(target.remarks ?? '')
      setBankDeposit(target.bankDeposit ?? '')
    }
  }, [isOpen, target])

  const updatePayment = useUpdateRegulatoryPayment(category)

  if (!isOpen || !target || !applicationGuid) return null

  function handleClose() {
    onClose()
  }

  function handleSave() {
    if (!target || !applicationGuid) return
    const amt = parseFloat(amount)
    if (!amount.trim() || isNaN(amt) || amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!payDate) { showToast('Please select a payment date.', 'warn'); return }

    const categoryFields = category === 'nche'
      ? { pnrNumber: pnrNumber.trim() || null, remarks: remarks.trim() || null }
      : { bankDeposit: bankDeposit.trim() || null }

    updatePayment.mutate(
      { paymentGuid: target.paymentGuid, input: { amount: amt, payDate, ...categoryFields }, applicationGuid, studentGuid },
      {
        onSuccess: result => {
          showToast(`${CATEGORY_LABEL[category]} payment updated — remaining balance ${result.remainingBalance.toLocaleString()}.`, 'success')
          handleClose()
        },
        onError: (error: Error) => {
          // Same "not a multiple of the configured rate"/"exceeds
          // outstanding balance" business errors post/put-payment-{category}.md
          // describe — surfaced as-is.
          showToast(error.message || `Failed to update ${CATEGORY_LABEL[category]} payment. Please try again.`, 'error')
        },
      },
    )
  }

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-pencil-alt"></i> Edit {CATEGORY_LABEL[category]} Payment</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div>
          <div className="g2 mb-[14px]">
            <div className="fg">
              <div className="lbl">Amount <span className="req">*</span></div>
              <input className="ctrl" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
              <div className="text-g400 mt-1" style={{ fontSize: 11 }}>Must be a multiple of the configured {CATEGORY_LABEL[category]} rate — enforced server-side.</div>
            </div>
            <div className="fg">
              <div className="lbl">Payment Date <span className="req">*</span></div>
              <DatePicker value={payDate} onChange={setPayDate} />
            </div>
          </div>
          {category === 'nche' ? (
            <>
              <div className="fg mb-[14px]">
                <div className="lbl">PNR Number</div>
                <input className="ctrl" type="text" placeholder="Optional reference number" value={pnrNumber} onChange={e => setPnrNumber(e.target.value)} />
              </div>
              <div className="fg mb-[14px]">
                <div className="lbl">Remarks</div>
                <textarea className="ctrl" rows={2} placeholder="Optional notes" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="fg mb-[14px]">
              <div className="lbl">Bank Deposit</div>
              <input className="ctrl" type="text" placeholder="Optional bank deposit reference" value={bankDeposit} onChange={e => setBankDeposit(e.target.value)} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={updatePayment.isPending} onClick={handleSave}>
            <i className="lni lni-checkmark"></i> {updatePayment.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
