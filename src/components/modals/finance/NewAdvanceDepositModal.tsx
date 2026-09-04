'use client'
import { useEffect, useState } from 'react'
import { ModalProps } from '../types'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { useFinanceCurrencies } from '@/hooks/finance/useFinanceCurrencies'
import { useReceiptBooks } from '@/hooks/finance/useReceiptBooks'
import { useProcBanks } from '@/hooks/finance/useProcBanks'
import {
  useSearchStudents,
  useCreateAdvanceDeposit,
  PAY_TYPE_LABELS,
  PAY_TYPE_TO_RECEIPT_CATEGORY,
} from '@/hooks/finance/usePaymentConsole'

function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Search results come from FinanceStudentSearchDto (PaymentConsoleStudentSearch.bru)
// — no lastName, just a pre-combined studentName (or firstName alone for an
// application that isn't a student yet). Same helper as payment-console/page.tsx.
function applicantName(a: { studentName: string | null; firstName: string | null }) {
  return a.studentName || a.firstName || '—'
}

interface DepositResult {
  code: string
  receipt: string
  balance: number
  currencyCode: string
}

// CreateAdvanceDeposit (payment-console/post-advance-deposit.md) — records
// money paid ahead of any specific fee, held as a credit and later drawn
// down by an "other" payment. Same student-picker pattern as
// payment-console/page.tsx's own Step 1, condensed into a modal since this
// is triggered from advanced-payments' "New Deposit" button rather than a
// dedicated page.
export function NewAdvanceDepositModal({ isOpen, onClose, showToast }: ModalProps) {
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [selectedApplicationGuid, setSelectedApplicationGuid] = useState<string | null>(null)
  const [selectedStudentName, setSelectedStudentName] = useState('')

  const [amount, setAmount] = useState('')
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [payDate, setPayDate] = useState(todayYmd)
  const [payType, setPayType] = useState('1')
  const [receiptBookGuid, setReceiptBookGuid] = useState('')
  const [procBankGuid, setProcBankGuid] = useState('')
  const [remarks, setRemarks] = useState('')

  const [result, setResult] = useState<DepositResult | null>(null)

  const { data: currencies = [] } = useFinanceCurrencies()
  const { data: allReceiptBooks = [] } = useReceiptBooks()
  const activeReceiptBooks = allReceiptBooks.filter(r => r.status === 1)
  const { data: allProcBanks = [] } = useProcBanks()
  const banks = allProcBanks.filter(b => b.status === 2)
  const receiptBooks = activeReceiptBooks.filter(r => r.category === PAY_TYPE_TO_RECEIPT_CATEGORY[Number(payType)])
  const showBankFields = Number(payType) > 1

  // Debounced live search, same convention as payment-console's own Step 1.
  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])
  const searchTermLen = committedSearch.trim().length
  const { data: searchResults, isFetching: isSearching } = useSearchStudents(
    committedSearch, 1, 20, searchTermLen >= 2,
  )
  const matches = searchResults?.items ?? []

  const createAdvanceDeposit = useCreateAdvanceDeposit()
  const selectedCurrency = currencies.find(c => c.currencyGuid === currencyGuid)

  function reset() {
    setSearch('')
    setCommittedSearch('')
    setSelectedApplicationGuid(null)
    setSelectedStudentName('')
    setAmount('')
    setCurrencyGuid('')
    setPayDate(todayYmd())
    setPayType('1')
    setReceiptBookGuid('')
    setProcBankGuid('')
    setRemarks('')
    setResult(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function selectStudent(applicationGuid: string, name: string) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentName(name)
    setSearch(name)
    setCommittedSearch('')
  }

  function handleSave() {
    if (!selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    const amt = parseFloat(amount) || 0
    if (amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!selectedCurrency) { showToast('Please select a currency.', 'warn'); return }
    if (!receiptBookGuid) { showToast('Please select a receipt book.', 'warn'); return }
    if (!payDate) { showToast('Please select a deposit date.', 'warn'); return }
    const payTypeNum = Number(payType)
    if (showBankFields && !procBankGuid) { showToast('Please select a bank.', 'warn'); return }

    createAdvanceDeposit.mutate(
      {
        applicationGuid: selectedApplicationGuid,
        studentGuid: null,
        amount: amt,
        currencyGuid: selectedCurrency.currencyGuid,
        receiptBookGuid,
        payDate,
        payType: payTypeNum,
        procBankGuid: showBankFields ? procBankGuid : null,
        remarks: remarks.trim() || null,
      },
      {
        onSuccess: res => {
          setResult({ code: res.advPaymentCode, receipt: res.receipt, balance: res.balance, currencyCode: selectedCurrency.currencyCode })
          showToast(`Deposit saved! Receipt ${res.receipt} generated.`, 'success')
        },
        onError: (error: Error) => showToast(error.message || 'Failed to save deposit. Please try again.', 'error'),
      },
    )
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay open" onClick={handleClose}>
      <div className="modal modal-md" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr modal-hdr-blue" style={{ flexShrink: 0 }}>
          <div className="modal-title"><i className="lni lni-arrow-up-circle"></i> New Advance Deposit</div>
          <button className="modal-close" onClick={handleClose}><i className="lni lni-close"></i></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {result ? (
            <div>
              <div className="info-box mb-3">
                <i className="lni lni-checkmark-circle"></i> Deposit recorded — receipt <span className="font-mono font-bold">{result.receipt}</span> (code <span className="font-mono">{result.code}</span>). Balance available to draw down: <span className="font-bold">{result.currencyCode} {result.balance.toLocaleString()}</span>.
              </div>
              <button className="btn btn-primary w-full justify-center" onClick={handleClose}>Done</button>
            </div>
          ) : (
            <>
              <div className="fg" style={{ position: 'relative' }}>
                <div className="lbl">Search by Applicant Name, Ref No, Phone, or Email <span className="req">*</span></div>
                <div className="inp-wrap">
                  <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                  <input
                    className="ctrl"
                    type="text"
                    placeholder="e.g. APP20222/667 or Tumukunde Alice"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setSelectedApplicationGuid(null) }}
                  />
                </div>
                {!selectedApplicationGuid && committedSearch.trim().length >= 2 && (
                  <div
                    className="mt-1"
                    style={{
                      position: 'relative', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                      maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--neu-out)',
                    }}
                  >
                    {isSearching && <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>Searching…</div>}
                    {!isSearching && matches.length === 0 && (
                      <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>No matching applications found.</div>
                    )}
                    {matches.map(a => (
                      <div
                        key={a.applicationGuid}
                        className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                        onClick={() => selectStudent(a.applicationGuid, applicantName(a))}
                      >
                        <div className="font-bold">{applicantName(a)}</div>
                        <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo} · {a.phone ?? '—'} · {a.emailId ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedApplicationGuid && (
                  <div className="mt-1 text-green" style={{ fontSize: 12 }}>
                    <i className="lni lni-checkmark-circle"></i> Selected: {selectedStudentName}
                  </div>
                )}
              </div>

              {selectedApplicationGuid && (
                <>
                  <div className="g2 mb-[14px] mt-[14px]">
                    <div className="fg">
                      <div className="lbl">Amount <span className="req">*</span></div>
                      <input type="number" min={0} step={0.01} className="ctrl" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    <div className="fg">
                      <div className="lbl">Currency <span className="req">*</span></div>
                      <SearchSelect
                        placeholder="— Select Currency —"
                        options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                        value={currencyGuid}
                        onChange={setCurrencyGuid}
                      />
                    </div>
                  </div>

                  <div className="g2 mb-[14px]">
                    <div className="fg">
                      <div className="lbl">Deposit Date <span className="req">*</span></div>
                      <DatePicker value={payDate} onChange={setPayDate} maxYmd={todayYmd()} />
                    </div>
                    <div className="fg">
                      <div className="lbl">Payment Method <span className="req">*</span></div>
                      <SearchSelect
                        options={Object.entries(PAY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                        value={payType}
                        onChange={val => { setPayType(val); setReceiptBookGuid('') }}
                      />
                    </div>
                  </div>

                  <div className="fg mb-[14px]">
                    <div className="lbl">Receipt Book <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select Receipt Book —"
                      options={receiptBooks.map(r => ({ value: r.receiptBookGuid, label: r.bookCode }))}
                      value={receiptBookGuid}
                      onChange={setReceiptBookGuid}
                    />
                  </div>

                  {showBankFields && (
                    <div className="fg mb-[14px]">
                      <div className="lbl">Bank Name <span className="req">*</span></div>
                      <SearchSelect
                        placeholder="— Select Bank —"
                        options={banks.map(b => ({ value: b.procBankGuid, label: b.bankName }))}
                        value={procBankGuid}
                        onChange={setProcBankGuid}
                      />
                    </div>
                  )}

                  <div className="fg mb-0">
                    <div className="lbl">Remarks</div>
                    <textarea className="ctrl" rows={2} placeholder="Optional notes…" value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {!result && (
          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button className="btn btn-neu" onClick={handleClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!selectedApplicationGuid || createAdvanceDeposit.isPending} onClick={handleSave}>
              <i className="lni lni-save"></i> {createAdvanceDeposit.isPending ? 'Saving…' : 'Save Deposit'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
