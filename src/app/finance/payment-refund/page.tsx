'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { PaymentSuccessModal } from '@/components/modals/finance/PaymentSuccessModal'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useBatches } from '@/hooks/academic/useBatches'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import {
  useSearchStudentsInfinite,
  useStudentProfile,
} from '@/hooks/finance/usePaymentConsole'
import {
  useLedgerOptions,
  useTotalPaid,
  useRefundsByApplication,
  useCreateRefund,
} from '@/hooks/finance/usePaymentRefund'
import { useFinanceCurrencies, getDefaultFinanceCurrencyGuid } from '@/hooks/finance/useFinanceCurrencies'
import { formatDate } from '@/lib/date'
import { AuthError } from '@/lib/api/client'

// Reference: a legacy ISMS screen ("Payment Console - Refund" —
// frmPaymentConsoleRefund.aspx) for issuing a refund against a payment a
// student has already made. Rebuilt 2026-09-05 against the refund/ doc set
// (repo root) — the backend was ported 1:1 from the legacy
// T_InsertPaymentConsole_Refund stored procedure and the model changed from
// "refund a specific tuition payment" to "refund a (applicationGuid,
// ledgerGuid) pair": pick a LEDGER (from this application's own paid
// ledgers), not a payment — a refund here doesn't reverse any ledger line,
// isn't linked to any payment, and an application can be refunded at most
// once per ledger, ever. Student search and the profile summary still reuse
// Payment Console's own real hooks/components (useSearchStudentsInfinite/
// useStudentProfile, the pc-hero card), same 50/50 pc-body split as that
// page's own Profile Details + payment form.

function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function applicantName(a: { firstName: string | null; lastName: string | null }) {
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || '—'
}

function searchResultName(a: { studentName: string | null; firstName: string | null }) {
  return a.studentName || a.firstName || '—'
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function PaymentRefundPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Success confirmation for a submitted refund — same PaymentSuccessModal
  // Payment Console uses for its own Tuition/Other submits, replacing a
  // plain success toast. Errors still use showToast.
  const [successModal, setSuccessModal] = useState<{ title: string; rows: [string, string][] } | null>(null)

  // ── Student search — same live-typing infinite-scroll dropdown as Payment
  // Console's own Student Search (useSearchStudentsInfinite): opens on focus
  // (browsing everything when the box is empty), narrows as you type,
  // debounced so the real search endpoint isn't hit on every keystroke. ──
  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [selectedApplicationGuid, setSelectedApplicationGuid] = useState<string | null>(null)
  const [selectedStudentGuidHint, setSelectedStudentGuidHint] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setCommittedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!searchFocused) return
    function handle(e: MouseEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [searchFocused])

  const searchTermLen = committedSearch.trim().length
  const {
    data: searchPages, fetchNextPage, hasNextPage, isFetchingNextPage,
    isFetching: isSearching, isError: isSearchError,
  } = useSearchStudentsInfinite(
    committedSearch, 20,
    searchFocused && (searchTermLen === 0 || searchTermLen >= 2),
  )
  const matches = searchPages?.pages.flatMap(p => p.items) ?? []

  function handleSearchResultsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextPage || isFetchingNextPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextPage()
  }

  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useStudentProfile(selectedApplicationGuid, !!selectedApplicationGuid, selectedStudentGuidHint)
  const studentGuid = profile?.studentGuid ?? selectedStudentGuidHint ?? null

  // Client-side name resolution for the profile's guid FKs — same fallback
  // pattern Payment Console uses: prefer the server's own pre-resolved
  // names, fall back to a client-side lookup only when the server sends null.
  const { data: campuses = [] } = useCampuses()
  const { data: programs = [] } = useProgramMasters()
  const { data: allBatchesData } = useBatches(1, 1000)
  const batches = allBatchesData?.items ?? []
  const { data: semesters = [] } = useSemestersForProgram(profile?.programGuid ?? '', !!profile?.programGuid)

  const campusName = campuses.find(c => c.campusGuid === profile?.campusGuid)?.campusName
  const programName = profile?.programName ?? programs.find(p => p.programGuid === profile?.programGuid)?.programName
  const batchCode = profile?.batchCode ?? batches.find(b => b.batchGuid === profile?.batchGuid)?.batchCode
  const semName = profile?.semesterName ?? semesters.find(s => s.semesterGuid === profile?.semesterGuid)?.semName

  // Refund Details — this application's own refund history
  // (get-refunds-by-application.md), unpaged: at most one row per ledger,
  // ever, so there's nothing to page through.
  const {
    data: refundHistory = [], isLoading: isRefundHistoryLoading, isError: isRefundHistoryError,
  } = useRefundsByApplication(selectedApplicationGuid, !!selectedApplicationGuid)
  // Ledgers already refunded are permanently locked out of a second refund
  // (post-refund.md: "at most once per ledger, ever") — excluded from the
  // picker below rather than left to fail on submit.
  const refundedLedgerGuids = new Set(refundHistory.map(r => r.ledgerGuid))

  // Ledger picker — this application's own paid ledgers (get-ledger-options.md).
  const { data: ledgerOptions = [], isLoading: isLedgersLoading, isError: isLedgersError } = useLedgerOptions(selectedApplicationGuid, !!selectedApplicationGuid)
  const [ledgerGuid, setLedgerGuid] = useState('')

  // Total already paid into the picked ledger (get-total-paid.md) — the
  // exact figure the create endpoint validates the refund amount against.
  const { data: totalPaid, isLoading: isTotalPaidLoading } = useTotalPaid(selectedApplicationGuid, ledgerGuid || null, !!ledgerGuid)

  const { data: currencies = [] } = useFinanceCurrencies()
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDate, setRefundDate] = useState(todayYmd)
  const [remarks, setRemarks] = useState('')

  // Default the currency picker to the ledger's own paid currency as soon as
  // it's known — the common case is refunding in the same currency it was
  // paid in; still freely changeable (the create endpoint accepts any
  // currency, only USD/UGX get a cross-check — see post-refund.md). Before
  // a ledger is picked (or if its paid currency can't be resolved), falls
  // back to Finance's own default (UGX) rather than sitting blank.
  useEffect(() => {
    if (totalPaid?.currencyGuid) setCurrencyGuid(totalPaid.currencyGuid)
    else if (!currencyGuid && currencies.length > 0) setCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPaid?.currencyGuid, currencies])

  function resetForm() {
    setLedgerGuid('')
    setCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    setRefundAmount('')
    setRefundDate(todayYmd())
    setRemarks('')
  }

  const createRefund = useCreateRefund()

  function selectStudent(applicationGuid: string, name: string, studentGuidHint: string | null) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentGuidHint(studentGuidHint)
    setSearch(name)
    setCommittedSearch('')
    setSearchFocused(false)
    resetForm()
    setSuccessModal(null)
    showToast(`Loaded: ${name}`, 'success')
  }

  function handleCancel() {
    resetForm()
  }

  function handleClear() {
    setSelectedApplicationGuid(null)
    setSelectedStudentGuidHint(null)
    setSearch('')
    setCommittedSearch('')
    resetForm()
    setSuccessModal(null)
    showToast('Form cleared.', 'warn')
  }

  const selectedLedger = ledgerOptions.find(l => l.ledgerGuid === ledgerGuid)
  const selectedCurrency = currencies.find(c => c.currencyGuid === currencyGuid)

  function handleSubmit() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    if (!selectedLedger) { showToast('Please select a ledger to refund.', 'warn'); return }
    if (!currencyGuid) { showToast('Please select a currency.', 'warn'); return }
    const amt = parseFloat(refundAmount)
    if (!refundAmount.trim() || isNaN(amt) || amt <= 0) { showToast('Refund amount must be greater than 0.', 'warn'); return }
    // Only checked client-side when refunding in the same currency it was
    // paid in — matches post-refund.md's own rule (the amount-vs-total-paid
    // check only runs then; a currency mismatch skips straight to the
    // USD/UGX cross-check server-side, which needs an exchange rate this
    // page doesn't have).
    if (totalPaid && currencyGuid === totalPaid.currencyGuid && amt > totalPaid.amount) {
      showToast(`Refund amount exceeds the total paid into this ledger (${fmtAmt(totalPaid.amount)}).`, 'warn')
      return
    }
    if (!refundDate) { showToast('Please select a refund date.', 'warn'); return }

    createRefund.mutate(
      {
        applicationGuid: selectedApplicationGuid,
        input: {
          ledgerGuid: selectedLedger.ledgerGuid,
          currencyGuid,
          amount: amt,
          refundDate,
          studentGuid,
          remarks: remarks.trim() || null,
        },
      },
      {
        // The response is just { refundGuid } now — an internal id, not
        // something to surface to the user, so the modal below is built
        // entirely from what was submitted rather than the result.
        onSuccess: () => {
          setSuccessModal({
            title: 'Refund Recorded',
            rows: [
              ['Ledger', selectedLedger.ledgerName],
              ['Amount', `${selectedCurrency?.currencyName ?? ''} ${fmtAmt(amt)}`.trim()],
              ['Refund Date', formatDate(refundDate)],
            ],
          })
          resetForm()
        },
        onError: (error: Error) => {
          // Business-rule rejections ("Refund already exists.", over the
          // total-paid amount, missing ledger/currency, …) all come back as
          // a plain message on the generic-failure branch — surface it
          // as-is rather than a generic "failed" toast.
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to record refund. Please try again.'), 'error')
        },
      },
    )
  }

  return (
    <>
      <div className="page active" id="page-payment-refund">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Payment Console - Refund</div>
            <div className="pg-sub">Search student → pick a ledger → record the refund</div>
          </div>
          <button className="btn btn-neu" onClick={() => router.push('/finance/dashboard')}><i className="lni lni-arrow-left"></i> Back</button>
        </div>

        {/* Student Search — same bar/dropdown shell as Payment Console's own
            Student Search card. */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Student Search</div>
          </div>
          <div className="fg" style={{ marginBottom: 0, position: 'relative' }} ref={searchBoxRef}>
            <div className="lbl">Search by Applicant Name, Ref No, Phone, or Email <span className="req">*</span></div>
            <div className="flex gap-2 flex-wrap">
              <div className="inp-wrap" style={{ flex: 1, minWidth: 180 }}>
                <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                <input
                  className="ctrl"
                  type="text"
                  placeholder="e.g. APP20222/667 or Tumukunde Alice"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={e => { if (e.key === 'Enter') setCommittedSearch(search.trim()) }}
                />
              </div>
              {selectedApplicationGuid && (
                <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-close"></i> Clear</button>
              )}
            </div>

            {searchFocused && (
              <div
                className="mt-1"
                style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                  boxShadow: 'var(--neu-out)', maxHeight: 260, overflowY: 'auto',
                }}
                onScroll={handleSearchResultsScroll}
              >
                {isSearching && matches.length === 0 ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Searching…</div>
                ) : isSearchError ? (
                  <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
                ) : matches.length === 0 ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No matching applications found.</div>
                ) : (
                  <>
                    {matches.map(a => (
                      <div
                        key={a.applicationGuid}
                        className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                        onMouseDown={() => selectStudent(a.applicationGuid, searchResultName(a), a.studentGuid)}
                      >
                        <div className="font-bold">{searchResultName(a)}</div>
                        <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo}{a.phone ? ` · ${a.phone}` : ''}{a.emailId ? ` · ${a.emailId}` : ''}</div>
                      </div>
                    ))}
                    {isFetchingNextPage && (
                      <div className="text-g400 text-center" style={{ padding: 10, fontSize: 11.5 }}>Loading more…</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* LEFT: Profile Details (pc-hero) · RIGHT: Refund form — same
            50/50 pc-body split and profile-card treatment as Payment
            Console's own Profile Details + payment form. */}
        {selectedApplicationGuid && (
          <div className="pc-body">
            <div className="flex flex-col gap-5 min-w-0">
              {isProfileLoading ? (
                <div className="card text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Loading profile…</div>
              ) : isProfileError || !profile ? (
                <div className="card text-clr-red text-center" style={{ padding: 24, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load this student&apos;s profile.</div>
              ) : (
                <div className="card p-0 overflow-hidden">
                  <div className="pc-hero">
                    <div className="pc-hero-top">
                      <div className="pc-hero-avatar">{initialsFor(applicantName(profile))}</div>
                      <div className="flex-1 min-w-0">
                        <div className="pc-hero-name truncate">{applicantName(profile)}</div>
                        <div className="pc-hero-sub truncate">{programName ?? '—'}</div>
                        <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {profile.appRefNo}</span>
                      </div>
                    </div>
                    <div className="pc-hero-facts">
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val" title={campusName ?? '—'}>{campusName ?? '—'}</span></div>
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={semName ?? '—'}>{semName ?? '—'}</span></div>
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Fee Code</span><span className="pc-hero-fact-val" title={profile.feeCode ?? '—'}>{profile.feeCode ?? '—'}</span></div>
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={batchCode ?? '—'}>{batchCode ?? '—'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-reload"></i></span> Refund</div>
                </div>

                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Ledger to Refund <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select a ledger —"
                      options={ledgerOptions.map(l => ({
                        value: l.ledgerGuid,
                        label: refundedLedgerGuids.has(l.ledgerGuid) ? `${l.ledgerName} (already refunded)` : l.ledgerName,
                        disabled: refundedLedgerGuids.has(l.ledgerGuid),
                      }))}
                      value={ledgerGuid}
                      onChange={setLedgerGuid}
                      disabled={isLedgersLoading || ledgerOptions.length === 0}
                    />
                    {isLedgersLoading ? (
                      <div className="text-g400 mt-1" style={{ fontSize: 11 }}>Loading paid ledgers…</div>
                    ) : isLedgersError ? (
                      <div className="text-clr-red mt-1" style={{ fontSize: 11 }}><i className="lni lni-warning"></i> Couldn&apos;t load paid ledgers.</div>
                    ) : ledgerOptions.length === 0 ? (
                      <div className="text-g400 mt-1" style={{ fontSize: 11 }}>No paid ledgers found for this application.</div>
                    ) : null}
                  </div>
                  <div className="fg">
                    <div className="lbl">Total Paid</div>
                    <input
                      className="ctrl"
                      readOnly
                      value={isTotalPaidLoading ? 'Loading…' : totalPaid ? `${totalPaid.currencyName} ${fmtAmt(totalPaid.amount)}` : ''}
                      placeholder="—"
                    />
                  </div>
                </div>

                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Refund Amount <span className="req">*</span></div>
                    <input
                      className="ctrl"
                      type="number"
                      placeholder="0.00"
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      disabled={!selectedLedger}
                    />
                  </div>
                  <div className="fg">
                    <div className="lbl">Currency <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select currency —"
                      options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                      value={currencyGuid}
                      onChange={setCurrencyGuid}
                      disabled={!selectedLedger}
                    />
                  </div>
                </div>

                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Refund Date <span className="req">*</span></div>
                    <DatePicker value={refundDate} onChange={setRefundDate} />
                  </div>
                  <div className="fg">
                    <div className="lbl">Remarks</div>
                    <textarea className="ctrl" rows={1} placeholder="Reason for this refund" value={remarks} onChange={e => setRemarks(e.target.value)} disabled={!selectedLedger} />
                  </div>
                </div>

                <div className="flex gap-[10px] justify-end flex-wrap">
                  <button className="btn btn-neu" onClick={handleCancel}><i className="lni lni-close"></i> Cancel</button>
                  <button className="btn btn-primary btn-lg" disabled={createRefund.isPending} onClick={handleSubmit}>
                    <i className="lni lni-checkmark"></i> {createRefund.isPending ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Refund Details — full width history table below the 2-column
            body. Unpaged (get-refunds-by-application.md): at most one row
            per ledger, ever, so no Pagination here. No Payment Code column
            any more either — a refund isn't linked to a payment. */}
        {selectedApplicationGuid && (
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> Refund Details</div>
            </div>
            {isRefundHistoryLoading ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading refund history…</div>
            ) : isRefundHistoryError ? (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load refund history.</div>
            ) : refundHistory.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No records found.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th>Ledger</th><th>Amount</th><th>Currency</th><th>Refund Date</th><th>Remarks</th></tr></thead>
                  <tbody>
                    {refundHistory.map(r => (
                      <tr key={r.refundGuid}>
                        <td>{r.ledgerName}</td>
                        <td className="text-green font-bold">{fmtAmt(r.amount)}</td>
                        <td>{r.currencyName}</td>
                        <td>{formatDate(r.refundDate)}</td>
                        <td>{r.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </div>
        )}
      </div>

      <PaymentSuccessModal
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        showToast={showToast}
        title={successModal?.title ?? ''}
        rows={successModal?.rows ?? []}
      />
      <Toast toast={toast} />
    </>
  )
}
