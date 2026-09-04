'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'

// Reference: a legacy ISMS screen ("Payment Console Adjustments" —
// frmPaymentConsoleAdjustments.aspx-style) for correcting a payment already
// on record — its date, method, bank, and remarks — as opposed to Payment
// Console itself, which only ever records a brand-new payment.
//
// UI-first per request (2026-09-02) — nothing on this page is wired to any
// real API yet, including student search/profile. Everything below (demo
// students, their ledgers, their payment history) is local mock data, same
// "no backing endpoint, log a toast instead of a real save" treatment
// Ledger Adjustments' own AdjustLedgerModal already uses on this same
// page's neighbour. Swap the mock arrays/handlers for real hooks once
// there's something to call — the layout/markup is meant to carry over
// as-is (it already matches Payment Console/Discount Allocation's own
// pc-hero/pc-ledger-item/pc-body conventions).

interface DemoStudent {
  name: string
  number: string
  programme: string
  semester: string
  campus: string
  batch: string
  phone: string
}

interface DemoLedgerLine {
  name: string
  currency: string
  outstanding: number
  paid: number
}

interface DemoPayment {
  guid: string
  code: string
  amount: number
  currency: string
  bookCode: string
  receipt: string
  date: string
  type: string
  scope: 'current' | 'previous'
}

const DEMO_STUDENTS: DemoStudent[] = [
  {
    name: 'Meghraj Rathod', number: '022200938',
    programme: 'Diploma in Networking and Cyber Security', semester: 'Year Two - Semester Two',
    campus: 'ISBAT University - Main Campus', batch: 'DPNCS23DA', phone: '256701234567',
  },
  {
    name: 'Tumukunde Alice Grace', number: '022200921',
    programme: 'Bachelor of Business Administration', semester: 'Year One - Semester One',
    campus: 'ISBAT University - Main Campus', batch: 'BBA26DA', phone: '256701234568',
  },
  {
    name: 'Okello James Patrick', number: '022200922',
    programme: 'Bachelor of Science in Accounting and Finance', semester: 'Year Three - Semester Two',
    campus: 'ISBAT University - Main Campus', batch: 'BSCAF24DA', phone: '256701234569',
  },
]

const DEMO_LEDGERS: Record<string, DemoLedgerLine[]> = {
  '022200938': [
    { name: 'Tuition Fee', currency: 'UGX', outstanding: 450000, paid: 0 },
    { name: 'Library Deposit', currency: 'UGX', outstanding: 0, paid: 50000 },
  ],
  '022200921': [
    { name: 'Tuition Fee', currency: 'UGX', outstanding: 1200000, paid: 800000 },
  ],
  '022200922': [],
}

const DEMO_PAYMENTS: Record<string, DemoPayment[]> = {
  '022200938': [
    { guid: 'p1', code: 'PAY2023211611', amount: 150000, currency: 'Uganda Shillings', bookCode: 'CO39', receipt: '1493', date: '2023-07-20', type: 'Cash', scope: 'current' },
    { guid: 'p2', code: 'PAY2023211991', amount: 150000, currency: 'Uganda Shillings', bookCode: 'CO39', receipt: '1741', date: '2023-07-31', type: 'Cash', scope: 'current' },
    { guid: 'p3', code: 'PAY2023211593', amount: 150000, currency: 'Uganda Shillings', bookCode: 'CO39', receipt: '1315', date: '2023-06-19', type: 'Cheque', scope: 'current' },
    { guid: 'p4', code: 'PAY2023211508', amount: 1800000, currency: 'Uganda Shillings', bookCode: 'CO39', receipt: '1233', date: '2023-05-24', type: 'Bank Transfer', scope: 'current' },
    { guid: 'p5', code: 'PAY2022200843', amount: 800000, currency: 'Uganda Shillings', bookCode: 'CO40', receipt: '789', date: '2022-11-15', type: 'Cash', scope: 'previous' },
    { guid: 'p6', code: 'PAY2022200712', amount: 900000, currency: 'Uganda Shillings', bookCode: 'CO40', receipt: '664', date: '2022-08-02', type: 'Cheque', scope: 'previous' },
    { guid: 'p7', code: 'PAY2022200558', amount: 300000, currency: 'Uganda Shillings', bookCode: 'CO40', receipt: '512', date: '2022-05-18', type: 'Card', scope: 'previous' },
    { guid: 'p8', code: 'PAY2022200410', amount: 950000, currency: 'Uganda Shillings', bookCode: 'CO40', receipt: '388', date: '2022-02-09', type: 'Bank Transfer', scope: 'previous' },
    { guid: 'p9', code: 'PAY2021900312', amount: 400000, currency: 'Uganda Shillings', bookCode: 'CO38', receipt: '277', date: '2021-11-27', type: 'Cash', scope: 'previous' },
    { guid: 'p10', code: 'PAY2021900201', amount: 1100000, currency: 'Uganda Shillings', bookCode: 'CO38', receipt: '150', date: '2021-08-14', type: 'Cash', scope: 'previous' },
  ],
  '022200921': [
    { guid: 'p11', code: 'PAY2024300112', amount: 800000, currency: 'Uganda Shillings', bookCode: 'CO41', receipt: '2210', date: '2026-01-14', type: 'Cash', scope: 'current' },
  ],
  '022200922': [
    { guid: 'p12', code: 'PAY2023450220', amount: 500000, currency: 'US Dollars', bookCode: 'CO42', receipt: '3105', date: '2025-09-02', type: 'Card', scope: 'current' },
    { guid: 'p13', code: 'PAY2022400119', amount: 600000, currency: 'US Dollars', bookCode: 'CO37', receipt: '1980', date: '2023-06-30', type: 'Bank Transfer', scope: 'previous' },
  ],
}

const MOCK_PAY_TYPES = ['Cash', 'Cheque', 'Bank Transfer', 'Card']
const MOCK_BANKS = ['Stanbic Bank — Main Branch', 'Centenary Bank — Kampala Branch', 'DFCU Bank — Nakawa Branch']

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PaymentConsoleAdjustmentsPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ── Student search — local mock lookup (no API), same UI shell as the
  // rest of Finance's search bars. ──
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [student, setStudent] = useState<DemoStudent | null>(null)

  const searchTrimmed = search.trim().toLowerCase()
  const matches = searchTrimmed.length >= 2
    ? DEMO_STUDENTS.filter(s => `${s.name} ${s.number}`.toLowerCase().includes(searchTrimmed)).slice(0, 8)
    : searchFocused ? DEMO_STUDENTS : []

  const ledgers = student ? (DEMO_LEDGERS[student.number] ?? []) : []
  const payments = student ? (DEMO_PAYMENTS[student.number] ?? []) : []

  const [editPreviousSemester, setEditPreviousSemester] = useState(false)
  const adjustablePayments = editPreviousSemester ? payments : payments.filter(p => p.scope === 'current')

  // The reference screen picks a payment from a popup table (Payment Code/
  // Amount/Currency/Book Code/Receipt/Payment Date columns), not a plain
  // dropdown — same picker-modal convention as AdvanceDepositPickerModal
  // elsewhere in Finance, built inline here since it's specific to this page.
  const [showPaymentPicker, setShowPaymentPicker] = useState(false)
  const [paymentGuid, setPaymentGuid] = useState('')
  const [payDate, setPayDate] = useState('')
  const [payType, setPayType] = useState('')
  const [range, setRange] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [remarks, setRemarks] = useState('')

  const selectedPayment = adjustablePayments.find(p => p.guid === paymentGuid)

  function resetAdjustmentFields() {
    setPayDate('')
    setPayType('')
    setRange('')
    setBankAccount('')
    setRemarks('')
  }

  function resetAll() {
    setPaymentGuid('')
    setEditPreviousSemester(false)
    resetAdjustmentFields()
  }

  // Seeds the editable fields from whichever payment is picked — same
  // trigger-on-select pattern the rest of this module uses (e.g. Discount
  // Allocation's startEdit).
  function selectPayment(guid: string) {
    setPaymentGuid(guid)
    const p = adjustablePayments.find(x => x.guid === guid)
    setPayDate(p?.date ?? '')
    setPayType(p?.type ?? '')
    setRange('')
    setBankAccount('')
    setRemarks('')
    setShowPaymentPicker(false)
  }

  function selectStudent(found: DemoStudent) {
    setStudent(found)
    setSearch(found.name)
    setSearchFocused(false)
    resetAll()
    showToast(`Loaded: ${found.name}`, 'success')
  }

  function handleClear() {
    setStudent(null)
    setSearch('')
    resetAll()
    showToast('Form cleared.', 'warn')
  }

  // No backing "update payment" endpoint — UI-first per request, same
  // mock-save convention as Ledger Adjustments' AdjustLedgerModal.
  function handleSave() {
    if (!selectedPayment) { showToast('Please select a payment to adjust.', 'warn'); return }
    if (!payDate) { showToast('Please select a payment date.', 'warn'); return }
    if (!payType) { showToast('Please select a payment type.', 'warn'); return }
    showToast(`Adjustment saved for ${selectedPayment.code}.`, 'warn')
  }

  return (
    <>
      <div className="page active" id="page-payment-console-adjustments">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Payment Console Adjustments</div>
            <div className="pg-sub">Search student → pick a recorded payment → correct its date, method, bank, or remarks</div>
          </div>
          <button className="btn btn-neu" onClick={() => router.push('/finance/dashboard')}><i className="lni lni-arrow-left"></i> Back</button>
        </div>

        {/* Student Search — same bar/dropdown shell as Payment Console, backed
            by the local demo list above instead of a live search. */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Student Search</div>
          </div>
          <div className="fg" style={{ marginBottom: 0, position: 'relative' }}>
            <div className="lbl">Search by Student Name or Number <span className="req">*</span></div>
            <div className="flex gap-2 flex-wrap">
              <div className="inp-wrap" style={{ flex: 1, minWidth: 180 }}>
                <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                <input
                  className="ctrl"
                  type="text"
                  placeholder="e.g. 022200938 or Meghraj Rathod"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                />
              </div>
              {student && (
                <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-close"></i> Clear</button>
              )}
            </div>

            {searchFocused && matches.length > 0 && (
              <div
                className="mt-1"
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                  boxShadow: 'var(--neu-out)', maxHeight: 260, overflowY: 'auto',
                }}
              >
                {matches.map(s => (
                  <div
                    key={s.number}
                    className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                    onMouseDown={() => selectStudent(s)}
                  >
                    <div className="font-bold">{s.name}</div>
                    <div className="text-g500" style={{ fontSize: 11 }}>{s.number} · {s.programme}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {student && (
          <div className="pc-body">
            {/* LEFT: profile hero on its own — matches Payment Console's own
                column split, where Outstanding Balance travels with the
                Payment Detail form on the right, not with the profile
                card. */}
            <div className="flex flex-col gap-5 min-w-0">
              <div className="card p-0 overflow-hidden">
                <div className="pc-hero">
                  <div className="pc-hero-top">
                    <div className="pc-hero-avatar">{initialsFor(student.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="pc-hero-name truncate">{student.name}</div>
                      <div className="pc-hero-sub truncate">{student.programme}</div>
                      <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {student.number}</span>
                    </div>
                  </div>
                  <div className="pc-hero-facts">
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val" title={student.campus}>{student.campus}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={student.semester}>{student.semester}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={student.batch}>{student.batch}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Phone</span><span className="pc-hero-fact-val" title={student.phone}>{student.phone}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Outstanding Balance + Payment Details merged into one
                card, same as Payment Console's own Outstanding Balance +
                Payment Detail card — a plain sec-divider between them, not
                a second card-hdr. Paid Fee Details stays its own full-width
                card below (see that card's own comment on why). */}
            <div className="flex flex-col gap-5 min-w-0">
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-dollar"></i></span> Outstanding Balance</div>
                </div>
                {/* Same gating as Payment Console's own Outstanding
                    Balance: "fully settled" means the ledger list itself
                    is empty (nothing to bill this semester at all), not
                    "every line happens to already be paid" — an
                    already-paid line (Library Deposit here) still lists
                    with its green checkmark/"Paid" treatment rather than
                    collapsing the whole card to the empty state. */}
                {ledgers.length === 0 ? (
                  <div className="text-center" style={{ padding: 24 }}>
                    <div className="pc-receipt-check" style={{ fontSize: 22 }}><i className="lni lni-checkmark-circle"></i></div>
                    <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Fully settled</div>
                    <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>No outstanding tuition ledgers for this application.</div>
                  </div>
                ) : (
                  <div>
                    {ledgers.map((l, i) => {
                      const isPaid = l.outstanding === 0
                      return (
                        <div className={`pc-ledger-item${isPaid ? ' paid' : ''}`} key={`${l.name}-${i}`}>
                          <span className="pc-ledger-icon"><i className={isPaid ? 'lni lni-checkmark-circle' : 'lni lni-invoice'}></i></span>
                          <div className="flex-1 min-w-0">
                            <div className="pc-ledger-name truncate">{l.name}</div>
                            {isPaid && <div className="pc-ledger-sub">Paid</div>}
                          </div>
                          <span className="flex items-baseline gap-1.5 justify-end flex-shrink-0">
                            <span className="text-g400 font-semibold" style={{ fontSize: 11 }}>{l.currency}</span>
                            <span className={isPaid ? 'font-bold text-green' : 'font-bold text-amber'}>
                              {fmtAmt(isPaid ? l.paid : l.outstanding)}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                    {/* Grouped per currency, same as Payment Console's own
                        ledgerTotals — matters once a student carries
                        ledgers in more than one currency. */}
                    {Object.entries(
                      ledgers.reduce<Record<string, number>>((acc, l) => {
                        if (l.outstanding > 0) acc[l.currency] = (acc[l.currency] ?? 0) + l.outstanding
                        return acc
                      }, {}),
                    ).map(([currency, total]) => (
                      <div className="pc-total-due" key={currency}>
                        <span className="text-muted" style={{ fontSize: 12 }}>Total Due ({currency})</span>
                        <span className="font-bold text-amber" style={{ fontSize: 15 }}>{fmtAmt(total)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Text/icon color matched to the Outstanding Balance
                    card-title above (var(--g900), the same ctitle-icon
                    wrapper) instead of .sec-divider's own default blue —
                    per request, so the two section headers stacked in this
                    one card read as the same color language. */}
                <div className="sec-divider" style={{ color: 'var(--g900)' }}>
                  <span className="ctitle-icon"><i className="lni lni-pencil-alt"></i></span> Payment Detail
                </div>

                <div className="fg mb-[14px]">
                  <label className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={editPreviousSemester} onChange={e => { setEditPreviousSemester(e.target.checked); resetAll() }} />
                    Edit Previous Semester Payments
                  </label>
                  <div className="text-g400 mt-1" style={{ fontSize: 11 }}>
                    {editPreviousSemester ? 'Showing every recorded payment.' : 'Showing this semester’s payments only.'}
                  </div>
                </div>

                <div className="fg mb-[14px]">
                  <div className="lbl">Payment Code <span className="req">*</span></div>
                  <div
                    className="inp-wrap"
                    style={{ cursor: adjustablePayments.length === 0 ? 'not-allowed' : 'pointer' }}
                    onClick={() => adjustablePayments.length > 0 && setShowPaymentPicker(true)}
                  >
                    <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                    <input
                      className="ctrl"
                      readOnly
                      style={{ cursor: 'inherit' }}
                      placeholder="— Click to select a payment —"
                      value={selectedPayment ? `${selectedPayment.code} — ${selectedPayment.currency} ${fmtAmt(selectedPayment.amount)}` : ''}
                    />
                  </div>
                  {adjustablePayments.length === 0 && (
                    <div className="text-g400 mt-1" style={{ fontSize: 11 }}>No payments recorded for this scope yet.</div>
                  )}
                </div>

                {selectedPayment && (
                  <>
                    {/* Live summary strip — same gradient "billing app"
                        card-mockup treatment Payment Console uses for its
                        own Amount to Collect preview, adapted here to show
                        what's actually being adjusted. */}
                    <div className="pc-pay-summary">
                      <div>
                        <div className="pc-pay-lbl">Adjusting Payment</div>
                        <div className="pc-pay-amt" style={{ fontSize: 18 }}>{selectedPayment.code}</div>
                      </div>
                      <div className="pc-pay-meta">
                        <div><span>Amount</span><b>{selectedPayment.currency} {fmtAmt(selectedPayment.amount)}</b></div>
                        <div><span>Original Date</span><b>{selectedPayment.date}</b></div>
                      </div>
                    </div>
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Payment Date <span className="req">*</span></div>
                        <DatePicker value={payDate} onChange={setPayDate} />
                      </div>
                      <div className="fg">
                        <div className="lbl">Payment Type <span className="req">*</span></div>
                        <SearchSelect options={MOCK_PAY_TYPES} value={payType} onChange={setPayType} />
                      </div>
                    </div>
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Range <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
                        <input className="ctrl" type="text" placeholder="e.g. Receipt range" value={range} onChange={e => setRange(e.target.value)} />
                      </div>
                      {payType !== 'Cash' && (
                        <div className="fg">
                          <div className="lbl">Bank Account</div>
                          <SearchSelect
                            placeholder="— Select Bank —"
                            options={MOCK_BANKS}
                            value={bankAccount}
                            onChange={setBankAccount}
                          />
                        </div>
                      )}
                    </div>
                    <div className="fg mb-4">
                      <div className="lbl">Remarks</div>
                      <textarea className="ctrl" rows={2} placeholder="Reason for this adjustment" value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>

                    <div className="flex gap-[10px] justify-end flex-wrap">
                      <button className="btn btn-neu" onClick={() => selectPayment(paymentGuid)}><i className="lni lni-reload"></i> Refresh</button>
                      <button className="btn btn-neu" onClick={resetAll}><i className="lni lni-close"></i> Cancel</button>
                      <button className="btn btn-primary btn-lg" onClick={handleSave}><i className="lni lni-checkmark"></i> OK</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Paid Fee Details — full width below the 2-column body rather than
            squeezed into the (narrower) right column: a 6-column table next
            to a much shorter left column (hero + a handful of ledger rows)
            left an awkward empty gap under the left column once this table
            ran on past it. Full width also just gives a wide table more
            room. */}
        {student && (
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> Paid Fee Details</div>
            </div>
            {payments.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No payment history for this application.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th>Payment Code</th><th>Amount</th><th>Currency</th><th>Book Code</th><th>Receipt</th><th>Payment Date</th></tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.guid} className={p.guid === paymentGuid ? 'bg-b50' : undefined}>
                        <td className="font-mono">{p.code}</td>
                        <td className="text-green font-bold">{fmtAmt(p.amount)}</td>
                        <td>{p.currency}</td>
                        <td>{p.bookCode}</td>
                        <td className="font-mono text-blue">{p.receipt}</td>
                        <td>{p.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </div>
        )}
      </div>

      {/* Payment Code picker — matches the reference screen's own popup
          table (Payment Code/Amount/Currency/Book Code/Receipt/Payment
          Date columns), scoped by the same Edit Previous Semester Payments
          toggle as the field it backs. */}
      {showPaymentPicker && (
        <div className="modal-overlay open" onClick={() => setShowPaymentPicker(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title"><i className="lni lni-search-alt"></i> Select Payment</div>
              <button className="modal-close" onClick={() => setShowPaymentPicker(false)}>✕</button>
            </div>
            <ScrollTable className="no-sticky-col">
              <table>
                <thead><tr><th>Payment Code</th><th>Amount</th><th>Currency</th><th>Book Code</th><th>Receipt</th><th>Payment Date</th></tr></thead>
                <tbody>
                  {adjustablePayments.map(p => (
                    <tr
                      key={p.guid}
                      className="cursor-pointer hover:bg-b50"
                      style={{ background: p.guid === paymentGuid ? 'var(--b50)' : undefined }}
                      onClick={() => selectPayment(p.guid)}
                    >
                      <td className="font-mono text-blue">{p.code}</td>
                      <td className="font-bold">{fmtAmt(p.amount)}</td>
                      <td>{p.currency}</td>
                      <td>{p.bookCode}</td>
                      <td className="font-mono">{p.receipt}</td>
                      <td>{p.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setShowPaymentPicker(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
