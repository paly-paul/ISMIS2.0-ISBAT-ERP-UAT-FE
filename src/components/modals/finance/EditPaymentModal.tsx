'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { useReceiptBooks } from '@/hooks/finance/useReceiptBooks'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import {
  useUpdatePayment,
  PAY_TYPE_LABELS,
  PAY_TYPE_TO_RECEIPT_CATEGORY,
} from '@/hooks/finance/usePaymentConsole'
import { AuthError } from '@/lib/api/client'

// Deliberately narrower than either PaymentHistoryEntry (Payment Console's
// own Tuition history table) or PaymentHistoryListEntry (the standalone
// Payment History page's register) — both call sites carry this shape
// structurally, so either row type can be passed straight through without
// a mapping step. `label` is whichever human-readable identifier the
// caller's row has on hand (paymentCode, receipt number, …), shown in the
// modal title and the success toast.
export interface EditablePaymentTarget {
  paymentGuid: string
  amount: number
  payDate: string
  payType: { value: number; name: string } | null
  label: string
}

interface EditPaymentModalProps extends ModalProps {
  target: EditablePaymentTarget | null
  // Lets Payment Console (which already knows which student/application is
  // loaded) also refresh its own per-application history/outstanding-
  // ledgers queries on a successful edit — see useUpdatePayment's own
  // comment. The standalone Payment History page has no applicationGuid on
  // its row to offer, so this stays optional.
  applicationGuid?: string
}

function isoToYmd(iso: string) {
  return iso.slice(0, 10)
}

// Correct a recorded TUITION payment (put-payment.md) — reached from the
// Edit action on a payments table's ActionMenu (Tuition rows only; NCHE/
// Guild/Other have no matching endpoint): Payment Console's own Tuition
// history table, and the standalone Payment History register. Both rows
// are fee-line-level views, not the raw payment record — neither carries
// `advance` (funded-from-a-deposit) nor per-ledger refund status, both of
// which make a payment permanently uneditable per the doc, so this doesn't
// pre-block on either; a rejection just surfaces as the server's own
// message.
//
// currencyGuid/receiptBookGuid/payType are genuinely optional on this
// endpoint (nullable; omit to leave unchanged) — kept behind their own
// "Also change…" toggles here so a plain amount/date correction doesn't
// have to touch them at all. Bank carries no such "leave unchanged" note in
// the doc, so it's only ever sent alongside a deliberate payment-type
// change, never on its own.
export function EditPaymentModal({ isOpen, onClose, showToast, target, applicationGuid }: EditPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [changeAllSemesters, setChangeAllSemesters] = useState(false)

  const [changeCurrency, setChangeCurrency] = useState(false)
  const [currencyGuid, setCurrencyGuid] = useState('')

  const [changeMethod, setChangeMethod] = useState(false)
  const [payType, setPayType] = useState('1')
  const [receiptBookGuid, setReceiptBookGuid] = useState('')
  const [procBankGuid, setProcBankGuid] = useState('')

  const { data: currencies = [] } = useFinanceCurrencies()
  const { data: allReceiptBooks = [] } = useReceiptBooks()
  const activeReceiptBooks = allReceiptBooks.filter(r => r.status === 1)
  const receiptBooks = activeReceiptBooks.filter(r => r.category === PAY_TYPE_TO_RECEIPT_CATEGORY[Number(payType)])
  const { data: allProcBanks = [] } = useProcBanks()
  const banks = allProcBanks.filter(b => b.status === 2)
  const showBankField = Number(payType) > 1

  useEffect(() => {
    if (isOpen && target) {
      setAmount(String(target.amount))
      setPayDate(isoToYmd(target.payDate))
      setRemarks('')
      setChangeAllSemesters(false)
      setChangeCurrency(false)
      setCurrencyGuid('')
      setChangeMethod(false)
      setPayType(String(target.payType?.value ?? 1))
      setReceiptBookGuid('')
      setProcBankGuid('')
    }
  }, [isOpen, target])

  const updatePayment = useUpdatePayment()

  if (!isOpen || !target) return null

  function handleClose() {
    onClose()
  }

  function handleSave() {
    if (!target) return
    const amt = parseFloat(amount)
    if (!amount.trim() || isNaN(amt) || amt < 0) { showToast('Amount must be 0 or greater.', 'warn'); return }
    if (!payDate) { showToast('Please select a payment date.', 'warn'); return }
    if (changeCurrency && !currencyGuid) { showToast('Please select a currency, or turn off “Also change currency”.', 'warn'); return }
    if (changeMethod) {
      if (!receiptBookGuid) { showToast('Please select a receipt book for the new payment type.', 'warn'); return }
      if (showBankField && !procBankGuid) { showToast('Please select a bank for the new payment type.', 'warn'); return }
    }

    updatePayment.mutate(
      {
        paymentGuid: target.paymentGuid,
        applicationGuid,
        input: {
          amount: amt,
          payDate,
          // Bank only ever accompanies a deliberate payment-type change —
          // sending it unprompted risks clearing a bank the cashier never
          // meant to touch (see this file's own header comment).
          bankGuid: changeMethod && showBankField ? procBankGuid : null,
          remarks: remarks.trim() || null,
          currencyGuid: changeCurrency ? currencyGuid : null,
          receiptBookGuid: changeMethod ? receiptBookGuid : null,
          payType: changeMethod ? Number(payType) : null,
          changeAllSemesters,
        },
      },
      {
        onSuccess: () => {
          showToast(`Payment ${target.label} updated.`, 'success')
          handleClose()
        },
        onError: (error: Error) => {
          // Business-rule rejections (advance-funded, refunded ledger,
          // previous-semester guard, missing exchange rate, …) all come
          // back as a plain message on the generic-failure branch —
          // surface it as-is rather than a generic "failed" toast.
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
            <div className="lbl">Remarks <span className="text-g400" style={{ fontWeight: 500 }}>(blank clears it)</span></div>
            <textarea className="ctrl" rows={2} placeholder="Reason for this correction" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>

          <div className="fg mb-[14px]">
            <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={changeAllSemesters} onChange={e => setChangeAllSemesters(e.target.checked)} />
              Change All Semesters
            </label>
            <div className="text-g400 mt-1" style={{ fontSize: 11 }}>
              Leave off to only allow this edit when every allocation line is in the student&apos;s current semester or later.
            </div>
          </div>

          <div className="fg mb-[14px]">
            <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={changeCurrency} onChange={e => { setChangeCurrency(e.target.checked); setCurrencyGuid('') }} />
              Also change currency
            </label>
            {changeCurrency && (
              <>
                <div className="text-g400 mt-1 mb-1" style={{ fontSize: 11 }}>
                  Re-runs allocation at the new currency — an exchange rate for the payment date must already exist.
                </div>
                <SearchSelect
                  placeholder="— Select currency —"
                  options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                  value={currencyGuid}
                  onChange={setCurrencyGuid}
                />
              </>
            )}
          </div>

          <div className="fg mb-[14px]">
            <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={changeMethod} onChange={e => { setChangeMethod(e.target.checked); setReceiptBookGuid(''); setProcBankGuid('') }} />
              Also change payment type / bank / receipt book
            </label>
            {changeMethod && (
              <div className="g2 mt-2">
                <div className="fg">
                  <div className="lbl">Payment Type <span className="req">*</span></div>
                  <SearchSelect
                    options={Object.entries(PAY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    value={payType}
                    onChange={v => { setPayType(v); setReceiptBookGuid(''); setProcBankGuid('') }}
                  />
                </div>
                <div className="fg">
                  <div className="lbl">Receipt Book <span className="req">*</span></div>
                  <SearchSelect
                    placeholder="— Select Receipt Book —"
                    options={receiptBooks.map(r => ({ value: r.receiptBookGuid, label: r.bookCode }))}
                    value={receiptBookGuid}
                    onChange={setReceiptBookGuid}
                  />
                </div>
                {showBankField && (
                  <div className="fg span2">
                    <div className="lbl">Bank <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select Bank —"
                      options={banks.map(b => ({ value: b.procBankGuid, label: `${b.bankName} — ${b.accountCode}` }))}
                      value={procBankGuid}
                      onChange={setProcBankGuid}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
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
