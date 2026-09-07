'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import { useUpdatePaymentOther } from '@/hooks/finance/usePaymentConsole'
import { AuthError } from '@/lib/api/client'

// Deliberately much narrower than EditPaymentModal (tuition's own edit) —
// put-payment-other.md's request body is just amount/payDate/bankGuid/
// remarks; the fee type (ledgerOthersGuid) and currency aren't on this
// request at all and can't be changed here (reverse + re-enter instead, per
// the doc). No payType/receiptBookGuid concept either, so there's nothing
// resembling that modal's "Also change payment type / bank / receipt book"
// toggle — Bank is just its own plain optional field.
export interface EditablePaymentOtherTarget {
  paymentOtherGuid: string
  amount: number
  payDate: string
  bankGuid: string | null
  label: string
}

interface EditPaymentOtherModalProps extends ModalProps {
  target: EditablePaymentOtherTarget | null
}

function isoToYmd(iso: string) {
  return iso.slice(0, 10)
}

// Correct a recorded OTHER payment (put-payment-other.md) — reached from the
// Edit action on the Other Payment tab's history table ActionMenu. A row
// funded from an advance deposit (PaymentOtherDto.advance === 1) is
// pre-blocked by the caller (Edit disabled + tooltip, same convention as
// EditPaymentModal's own isAdvanceFunded check) rather than here, since this
// modal only ever receives target for rows the caller already decided are
// editable — a rejection would still surface as the server's own message if
// that ever turns out wrong.
export function EditPaymentOtherModal({ isOpen, onClose, showToast, target }: EditPaymentOtherModalProps) {
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [bankGuid, setBankGuid] = useState('')
  const [remarks, setRemarks] = useState('')

  const { data: allProcBanks = [] } = useProcBanks()
  const banks = allProcBanks.filter(b => b.status === 2)

  useEffect(() => {
    if (isOpen && target) {
      setAmount(String(target.amount))
      setPayDate(isoToYmd(target.payDate))
      setBankGuid(target.bankGuid ?? '')
      setRemarks('')
    }
  }, [isOpen, target])

  const updatePaymentOther = useUpdatePaymentOther()

  if (!isOpen || !target) return null

  function handleClose() {
    onClose()
  }

  function handleSave() {
    if (!target) return
    const amt = parseFloat(amount)
    // Mirrors UpdatePaymentOtherCommandValidator — amount must be > 0 (not
    // "0 or greater" like tuition's own edit; see put-payment-other.md).
    if (!amount.trim() || isNaN(amt) || amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!payDate) { showToast('Please select a payment date.', 'warn'); return }

    updatePaymentOther.mutate(
      {
        paymentOtherGuid: target.paymentOtherGuid,
        input: {
          amount: amt,
          payDate,
          bankGuid: bankGuid || null,
          remarks: remarks.trim() || null,
        },
      },
      {
        onSuccess: () => {
          showToast(`Payment ${target.label} updated.`, 'success')
          handleClose()
        },
        onError: (error: Error) => {
          // Business-rule rejections (advance-funded, bank not found,
          // receipt book no longer active, …) all come back as a plain
          // message on the generic-failure branch — surface it as-is.
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to update payment. Please try again.'), 'error')
        },
      },
    )
  }

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      <div className="modal modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue">
          <div className="modal-title"><i className="lni lni-pencil-alt"></i> Edit Payment — {target.label}</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>
        <div>
          <div className="g2 mb-[14px]">
            <div className="fg">
              <div className="lbl">Amount <span className="req">*</span></div>
              <input className="ctrl" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="fg">
              <div className="lbl">Payment Date <span className="req">*</span></div>
              <DatePicker value={payDate} onChange={setPayDate} />
            </div>
          </div>

          <div className="fg mb-[14px]">
            <div className="lbl">Bank <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
            <SearchSelect
              placeholder="— Select Bank —"
              options={banks.map(b => ({ value: b.procBankGuid, label: `${b.bankName} — ${b.accountCode}` }))}
              value={bankGuid}
              onChange={setBankGuid}
            />
          </div>

          <div className="fg mb-[14px]">
            <div className="lbl">Remarks <span className="text-g400" style={{ fontWeight: 500 }}>(blank clears it)</span></div>
            <textarea className="ctrl" rows={2} placeholder="Reason for this correction" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" disabled={updatePaymentOther.isPending} onClick={handleSave}>
            <i className="lni lni-checkmark"></i> {updatePaymentOther.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
