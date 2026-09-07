'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
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
  useOutstandingLedgers,
} from '@/hooks/finance/usePaymentConsole'
import {
  useAdvanceDeposits,
  useAdvanceBalance,
  useAdjustmentsByAdvance,
  useAdjustmentLedgerBreakdown,
  useCreateAdjustment,
} from '@/hooks/finance/useAdvancePayment'
import { useFinanceCurrencies, getDefaultFinanceCurrencyGuid } from '@/hooks/finance/useFinanceCurrencies'
import { useExchangeRatesByDate } from '@/hooks/finance/useExchangeRates'
import { formatDate } from '@/lib/date'
import { AuthError } from '@/lib/api/client'

// Reference: the legacy ISMS "Payment Console Adjustments" screen
// (frmTrnPaymentAdjustment.aspx) for applying an advance deposit against a
// student's outstanding TUITION ledgers — not for correcting an already
// recorded payment's own fields (there's no backing endpoint for that
// anywhere in this API; the previous version of this page was a UI-only
// mock built around that premise). Rebuilt 2026-09-05 against the
// payment-adjust/ doc set (repo root) — port of the legacy
// T_InsertPaymentAdjustments_Advance procedure: pick one of this
// application's own advance deposits, choose how much of it to apply, and
// the payment-console allocation engine (currency conversion, discount,
// lump-sum, round-off) settles outstanding tuition ledgers exactly as a
// real tuition payment would. Student search and the profile summary reuse
// Payment Console's own real hooks/components, same 50/50 pc-body split
// Payment Refund/Discount Allocation already use.

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

// Same currency-conversion helper as Payment Console's own page.tsx (kept
// as an identical copy rather than a shared import — the two pages don't
// currently share a module for page-local helpers like this one, matching
// fmtAmt/applicantName/etc. above already being duplicated the same way).
// exRate is base-currency units per 1 unit of the given currency (Currency
// Master's isDefault=1 row is the base) — confirmed via a real
// get-exchange-rate-exists response: USD came back as exRate: 3774.90 and
// KSH as exRate: 29.16, i.e. exactly "1 {currency} = {exRate} {base}" (real
// UGX/USD, UGX/KSH rates), not the tiny fraction ("this currency's units
// per 1 base") this used to assume — see Payment Console's own page.tsx for
// the same fix and the full story. Converting A→B always routes through the
// base: amountInBase = amount * rateA, amountInB = amountInBase / rateB.
// Returns null (not a fallback guess) when either currency's rate can't be
// resolved, INCLUDING a rate of exactly 0 — that's never a real "no rate
// available" (no currency trades at 0 units per 1 base), it's what the
// by-date board can return for a currency nobody has entered today's rate
// for yet, and dividing by a 0 toRate would otherwise produce Infinity
// (then NaN once totalled) instead of a clean "can't convert".
function convertAmount(
  amount: number,
  fromGuid: string | null | undefined,
  toGuid: string | null,
  baseGuid: string | null,
  ratesByGuid: Map<string, number>,
): number | null {
  if (!fromGuid || !toGuid) return null
  if (fromGuid === toGuid) return amount
  const fromRate = fromGuid === baseGuid ? 1 : ratesByGuid.get(fromGuid)
  const toRate = toGuid === baseGuid ? 1 : ratesByGuid.get(toGuid)
  if (fromRate == null || toRate == null || fromRate <= 0 || toRate <= 0) return null
  return (amount * fromRate) / toRate
}

export default function PaymentConsoleAdjustmentsPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // Success confirmation for a submitted adjustment — same PaymentSuccessModal
  // Payment Console/Payment Refund use for their own submits.
  const [successModal, setSuccessModal] = useState<{ title: string; rows: [string, string][]; notices?: string[] } | null>(null)

  // ── Student search — same live-typing infinite-scroll dropdown Payment
  // Console/Payment Refund use. ──
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
  // pattern Payment Console/Payment Refund use.
  const { data: campuses = [] } = useCampuses()
  const { data: programs = [] } = useProgramMasters()
  const { data: allBatchesData } = useBatches(1, 1000)
  const batches = allBatchesData?.items ?? []
  const { data: semesters = [] } = useSemestersForProgram(profile?.programGuid ?? '', !!profile?.programGuid)

  const campusName = campuses.find(c => c.campusGuid === profile?.campusGuid)?.campusName
  const programName = profile?.programName ?? programs.find(p => p.programGuid === profile?.programGuid)?.programName
  const batchCode = profile?.batchCode ?? batches.find(b => b.batchGuid === profile?.batchGuid)?.batchCode
  const semName = profile?.semesterName ?? semesters.find(s => s.semesterGuid === profile?.semesterGuid)?.semName

  // Outstanding Balance — this application's own tuition ledgers, same
  // endpoint/rendering Payment Console's Tuition tab uses. An adjustment
  // only ever settles tuition (per post-adjustment.md), so this is the
  // right "what's owed" view here, not the cross-category outstanding-all.
  const { data: outstandingLedgersRaw = [], isLoading: isLedgersLoading, isError: isLedgersError } = useOutstandingLedgers(selectedApplicationGuid, !!selectedApplicationGuid, studentGuid)
  // getOutstandingLedgers is documented as "current semester + carried-
  // forward semester-1 registration fee" — same scoping as Payment
  // Console's own getCurrentSemesterPayable — but confirmed live (a real
  // response came back with all four of a programme's semesters' rows, not
  // just the current one), l.semesterGuid is null/blank on every row in
  // practice, so filtering by guid was a silent no-op. semesterName IS
  // reliably populated on every row (it's what the table's own subtitle
  // under each ledger name renders), so this filters by that string against
  // the student's own resolved current semester name instead.
  const outstandingLedgers = semName
    ? outstandingLedgersRaw.filter(l => !l.semesterName || l.semesterName === semName)
    : outstandingLedgersRaw

  // Advance balance strip — per-currency undrawn total (get-advance-balance.md),
  // informational only; the picker below is what actually drives a draw.
  const { data: advanceBalances = [] } = useAdvanceBalance(selectedApplicationGuid, !!selectedApplicationGuid)

  // Deposit picker — this application's own drawable deposits (get-advance-deposits.md).
  const { data: deposits = [], isLoading: isDepositsLoading, isError: isDepositsError } = useAdvanceDeposits(selectedApplicationGuid, !!selectedApplicationGuid)
  const [paymentAdvanceGuid, setPaymentAdvanceGuid] = useState('')
  const selectedDeposit = deposits.find(d => d.paymentAdvanceGuid === paymentAdvanceGuid)

  const { data: currencies = [] } = useFinanceCurrencies()
  const [currencyGuid, setCurrencyGuid] = useState('')
  const [amount, setAmount] = useState('')
  const [adjustmentDate, setAdjustmentDate] = useState(todayYmd)
  const [remarks, setRemarks] = useState('')

  // Default the currency picker to the deposit's own currency as soon as
  // it's picked — the common case is applying it in the currency it was
  // deposited in; still freely changeable (the endpoint converts amount
  // into the deposit's currency before checking it against the balance).
  // Before a deposit is picked, falls back to Finance's own default (UGX)
  // rather than sitting blank.
  useEffect(() => {
    if (selectedDeposit?.currencyGuid) setCurrencyGuid(selectedDeposit.currencyGuid)
    else if (!currencyGuid && currencies.length > 0) setCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeposit?.currencyGuid, currencies])

  // Outstanding Balance conversion — same approach as Payment Console's own
  // page.tsx: convert every ledger's Scheduled Bill/Outstanding into
  // whichever currency is picked below, using today's exchange-rate board.
  // The "Currency" field in Apply Advance does double duty as the
  // conversion target here too (same reasoning as Payment Console's
  // Currency Received field) — there's no separate picker to keep in sync.
  const { data: todayRates = [] } = useExchangeRatesByDate(todayYmd())
  const ratesByGuid = new Map(todayRates.map(r => [r.currencyGuid, r.exRate]))
  const baseCurrency = currencies.find(c => c.isDefault === 1)
  const targetCurrency = currencies.find(c => c.currencyGuid === currencyGuid)
  const targetCurrencyGuid = targetCurrency?.currencyGuid ?? null
  const targetCurrencyName = targetCurrency?.currencyName ?? ''
  // null on a given ledger means its own currency (or the target's) has no
  // resolvable rate for today — shown as "—" rather than silently defaulting
  // to the original, unconverted figure.
  const convertedLedgers = outstandingLedgers.map(l => ({
    ...l,
    convScheduled: convertAmount(l.ledgerAmount, l.currencyGuid, targetCurrencyGuid, baseCurrency?.currencyGuid ?? null, ratesByGuid),
    convOutstanding: convertAmount(l.outstanding, l.currencyGuid, targetCurrencyGuid, baseCurrency?.currencyGuid ?? null, ratesByGuid),
  }))
  const convertedTotalOutstanding = convertedLedgers.reduce((sum, l) => sum + (l.convOutstanding ?? 0), 0)
  const hasUnconvertibleLedger = convertedLedgers.some(l => l.outstanding > 0 && l.convOutstanding === null)

  function resetForm() {
    setPaymentAdvanceGuid('')
    setCurrencyGuid(getDefaultFinanceCurrencyGuid(currencies))
    setAmount('')
    setAdjustmentDate(todayYmd())
    setRemarks('')
  }

  // Adjustment history for the currently-picked deposit
  // (get-adjustments-by-advance.md) — unpaged.
  const {
    data: adjustmentHistory = [], isLoading: isHistoryLoading, isError: isHistoryError,
  } = useAdjustmentsByAdvance(paymentAdvanceGuid || null, !!paymentAdvanceGuid)

  // Ledger breakdown for one adjustment row, shown in a small modal on
  // click (get-adjustment-ledger-breakdown.md) — fetched on demand rather
  // than for every row up front.
  const [breakdownGuid, setBreakdownGuid] = useState<string | null>(null)
  const { data: breakdown = [], isLoading: isBreakdownLoading, isError: isBreakdownError } = useAdjustmentLedgerBreakdown(breakdownGuid, !!breakdownGuid)

  const createAdjustment = useCreateAdjustment()

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

  function handleSubmit() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    if (!selectedDeposit) { showToast('Please select an advance deposit to draw from.', 'warn'); return }
    if (!currencyGuid) { showToast('Please select a currency.', 'warn'); return }
    const amt = parseFloat(amount)
    if (!amount.trim() || isNaN(amt) || amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!adjustmentDate) { showToast('Please select an adjustment date.', 'warn'); return }

    createAdjustment.mutate(
      {
        paymentAdvanceGuid: selectedDeposit.paymentAdvanceGuid,
        applicationGuid: selectedApplicationGuid,
        input: { amount: amt, currencyGuid, adjustmentDate, remarks: remarks.trim() || null },
      },
      {
        onSuccess: result => {
          setSuccessModal({
            title: 'Adjustment Recorded',
            rows: [
              ['Adjustment Code', result.adjustmentCode ?? '—'],
              ['Applied', `${currencies.find(c => c.currencyGuid === currencyGuid)?.currencyName ?? ''} ${fmtAmt(result.adjustedAmount)}`.trim()],
              ['Receipt', result.receipt],
              ['Remaining Deposit Balance', `${selectedDeposit.currencyCode} ${fmtAmt(result.remainingAdvanceBalance)}`],
            ],
            notices: result.newAdvanceMessage ? [result.newAdvanceMessage] : undefined,
          })
          resetForm()
        },
        onError: (error: Error) => {
          // Business-rule rejections (exhausted balance, missing exchange
          // rate, nothing outstanding, concurrent settlement, …) all come
          // back as a plain message on the generic-failure branch — surface
          // it as-is rather than a generic "failed" toast.
          showToast(error instanceof AuthError ? error.message : (error.message || 'Failed to record adjustment. Please try again.'), 'error')
        },
      },
    )
  }

  return (
    <>
      <div className="page active" id="page-payment-console-adjustments">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Payment Console Adjustments</div>
            <div className="pg-sub">Search student → pick an advance deposit → apply it to outstanding tuition</div>
          </div>
          <button className="btn btn-neu" onClick={() => router.push('/finance/dashboard')}><i className="lni lni-arrow-left"></i> Back</button>
        </div>

        {/* Student Search — same bar/dropdown shell as Payment Console/Payment
            Refund's own Student Search card. */}
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

        {/* LEFT: Profile Details (pc-hero) · RIGHT: Outstanding Balance +
            Adjustment form — same 50/50 pc-body split as Payment Console/
            Payment Refund. */}
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

                  {/* Advance balance strip — per-currency undrawn total
                      (get-advance-balance.md). Informational: the deposit
                      picker on the right is what actually drives a draw.
                      Merged into this same card as a second section (same
                      "compact like Payment Console" fix as its own Payment
                      History section — see that page's identical comment)
                      instead of its own separate card below, which stacked
                      an extra 20px padding + 16px card-hdr margin right
                      under the hero for what's really just a couple of
                      figures. */}
                  {advanceBalances.length > 0 && (
                    <div className="px-5 pb-5">
                      <div className="sec-divider"><i className="lni lni-wallet"></i> Undrawn Advance Balance</div>
                      {advanceBalances.map(b => (
                        <div className="pc-total-due" key={b.currencyGuid}>
                          <span className="text-muted" style={{ fontSize: 12 }}>{b.currencyName}</span>
                          <span className="font-bold text-blue" style={{ fontSize: 15 }}>{fmtAmt(b.balance)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-dollar"></i></span> Outstanding Balance (Tuition)</div>
                </div>
                {isLedgersLoading ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading outstanding ledgers…</div>
                ) : isLedgersError ? (
                  <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load outstanding ledgers.</div>
                ) : outstandingLedgers.length === 0 ? (
                  <div className="text-center" style={{ padding: 24 }}>
                    <div className="pc-receipt-check" style={{ fontSize: 22 }}><i className="lni lni-checkmark-circle"></i></div>
                    <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Fully settled</div>
                    <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>No outstanding tuition ledgers for this application.</div>
                  </div>
                ) : (
                  <div>
                    {/* Same conversion presentation as Payment Console's own
                        Outstanding Balance table — Scheduled Bill/Outstanding
                        converted into whichever currency is picked in Apply
                        Advance below (that field does double duty as the
                        conversion target, same as Payment Console's Currency
                        Received), while Scheduled Amt/Paid stay native to
                        each ledger's own currency. convertAmount now treats
                        a 0 rate the same as a missing one, so an
                        unconvertible ledger cleanly shows "—" instead of the
                        ∞/NaN this used to produce when today's rate for a
                        currency hadn't been entered yet. */}
                    <div className="text-g400 mb-2" style={{ fontSize: 11.5 }}>
                      Converted to {targetCurrencyName || 'the currency picked below'} — set via <b>Currency</b> in Apply Advance.
                    </div>
                    {hasUnconvertibleLedger && (
                      <div className="warn-box mb-3">
                        <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                        <div>Some ledgers couldn&apos;t be converted to {targetCurrencyName || 'the selected currency'} — no exchange rate is on file for today for that currency. Those rows show <span className="font-mono">—</span> below; the total only includes what could be converted.</div>
                      </div>
                    )}
                    <div className="recgrid">
                      <div className="recgrid-row recgrid-hdr">
                        <span>Ledger</span>
                        <span>Scheduled Amt</span>
                        <span>Scheduled Bill</span>
                        <span>Paid</span>
                        <span>Outstanding</span>
                      </div>
                      {convertedLedgers.map((l, i) => {
                        const isPaid = l.outstanding === 0
                        return (
                          <div className="recgrid-row recgrid-body" key={`${l.ledgerGuid ?? l.ledgerName}-${i}`}>
                            <span>
                              {l.ledgerName}{l.ledgerNum ? ` (${l.ledgerNum})` : ''}
                              {isPaid && <span className="text-green" style={{ fontSize: 11, fontWeight: 600, marginLeft: 6 }}>Paid</span>}
                              {l.semesterName && <span className="pc-ledger-sub" style={{ display: 'block' }}>{l.semesterName}</span>}
                            </span>
                            <span data-label="Scheduled Amt">
                              <span>
                                {fmtAmt(l.ledgerAmount)}
                                <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({l.currencyName})</span>
                              </span>
                            </span>
                            <span data-label="Scheduled Bill">{l.convScheduled != null ? fmtAmt(l.convScheduled) : '—'}</span>
                            <span data-label="Paid" className="font-bold text-green">
                              <span>
                                {fmtAmt(l.paidAmount)}
                                <span className="text-g400" style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>({l.currencyName})</span>
                              </span>
                            </span>
                            <span data-label="Outstanding" className={isPaid ? 'font-bold text-green' : 'font-bold text-amber'}>{l.convOutstanding != null ? fmtAmt(l.convOutstanding) : '—'}</span>
                          </div>
                        )
                      })}
                      <div className="recgrid-foot recgrid-total">
                        <span>Total Outstanding {targetCurrencyName && `(${targetCurrencyName})`}</span>
                        <span style={{ color: 'var(--amber)' }}>{fmtAmt(convertedTotalOutstanding)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="sec-divider" style={{ color: 'var(--g900)' }}>
                  <span className="ctitle-icon"><i className="lni lni-reload"></i></span> Apply Advance
                </div>

                {/* Nothing to apply without a drawable deposit — an empty
                    picker plus a stack of disabled fields underneath it
                    just repeats the same "nothing here" message four times
                    over, so the whole form is gated on there being at least
                    one option instead. */}
                {isDepositsLoading ? (
                  <div className="text-g400 text-center" style={{ padding: '12px 0', fontSize: 12.5 }}>Loading advance deposits…</div>
                ) : isDepositsError ? (
                  <div className="text-clr-red text-center" style={{ padding: '12px 0', fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load advance deposits.</div>
                ) : deposits.length === 0 ? (
                  <div className="text-g400 text-center" style={{ padding: '12px 0', fontSize: 12.5 }}>
                    No drawable advance deposits for this application — nothing to apply until one exists.
                  </div>
                ) : (
                  <>
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Advance Deposit <span className="req">*</span></div>
                        <SearchSelect
                          placeholder="— Select a deposit —"
                          options={deposits.map(d => ({
                            value: d.paymentAdvanceGuid,
                            label: `${d.advPaymentCode} — ${d.currencyCode} ${fmtAmt(d.balance)} available`,
                          }))}
                          value={paymentAdvanceGuid}
                          onChange={setPaymentAdvanceGuid}
                        />
                      </div>
                      <div className="fg">
                        <div className="lbl">Deposit Balance</div>
                        <input
                          className="ctrl"
                          readOnly
                          value={selectedDeposit ? `${selectedDeposit.currencyName} ${fmtAmt(selectedDeposit.balance)}` : ''}
                          placeholder="—"
                        />
                      </div>
                    </div>

                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Amount to Apply <span className="req">*</span></div>
                        <input
                          className="ctrl"
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          disabled={!selectedDeposit}
                        />
                      </div>
                      <div className="fg">
                        <div className="lbl">Currency <span className="req">*</span></div>
                        <SearchSelect
                          placeholder="— Select currency —"
                          options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                          value={currencyGuid}
                          onChange={setCurrencyGuid}
                          disabled={!selectedDeposit}
                        />
                      </div>
                    </div>

                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Adjustment Date <span className="req">*</span></div>
                        <DatePicker value={adjustmentDate} onChange={setAdjustmentDate} />
                      </div>
                      <div className="fg">
                        <div className="lbl">Remarks <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
                        <textarea className="ctrl" rows={1} placeholder="Defaults to “Advance Adjustment”" value={remarks} onChange={e => setRemarks(e.target.value)} disabled={!selectedDeposit} />
                      </div>
                    </div>

                    <div className="flex gap-[10px] justify-end flex-wrap">
                      <button className="btn btn-neu" onClick={handleCancel}><i className="lni lni-close"></i> Cancel</button>
                      <button className="btn btn-primary btn-lg" disabled={createAdjustment.isPending} onClick={handleSubmit}>
                        <i className="lni lni-checkmark"></i> {createAdjustment.isPending ? 'Submitting…' : 'Apply Advance'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payment Adjustment History for the currently-picked deposit
            (get-adjustments-by-advance.md) — full width. Relabeled from
            "Adjustment History" and switched from clickable rows to a
            leftmost ActionMenu "View" column per request, matching Payment
            Console's own history tables (Tuition/Other Payment tabs) rather
            than Payment Refund's clickable-row convention. The endpoint
            itself takes a paymentAdvanceGuid in its path — there's no
            "all adjustments for this application" variant — so the section
            genuinely can't render (or fire its API call) before a deposit is
            picked in Apply Advance below; this placeholder says so instead
            of just silently leaving that space blank with no explanation. */}
        {/* Gated on deposits.length > 0 too — the "no drawable deposits"
            empty state above already explains why there's nothing to pick,
            so this placeholder would be a redundant second message on top
            of it otherwise. */}
        {selectedApplicationGuid && !paymentAdvanceGuid && deposits.length > 0 && (
          <div className="card text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>
            <i className="lni lni-folder" style={{ fontSize: 20, display: 'block', marginBottom: 6 }}></i>
            Select an Advance Deposit above to see its Payment Adjustment History.
          </div>
        )}
        {selectedApplicationGuid && paymentAdvanceGuid && (
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> Payment Adjustment History</div>
              {selectedDeposit?.advPaymentCode && <span className="badge badge-grey">{selectedDeposit.advPaymentCode}</span>}
            </div>
            {isHistoryLoading ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading adjustment history…</div>
            ) : isHistoryError ? (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load adjustment history.</div>
            ) : adjustmentHistory.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No adjustments recorded against this deposit yet.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th style={{ width: 40 }}></th><th>Adjustment Code</th><th>Amount</th><th>Currency</th><th>Date</th><th>Receipt</th></tr></thead>
                  <tbody>
                    {adjustmentHistory.map(a => (
                      <tr key={a.adjustmentGuid}>
                        <td>
                          <ActionMenu>
                            <button className="btn btn-neu btn-sm" onClick={() => setBreakdownGuid(a.adjustmentGuid)}>
                              <i className="lni lni-eye"></i> View
                            </button>
                          </ActionMenu>
                        </td>
                        <td className="font-mono text-blue">{a.adjustmentCode ?? '—'}</td>
                        <td className="text-green font-bold">{fmtAmt(a.adjustedAmount)}</td>
                        <td>{a.currencyName ?? '—'}</td>
                        <td>{formatDate(a.adjustmentDate)}</td>
                        <td className="font-mono">{a.receipt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </div>
        )}
      </div>

      {/* Ledger breakdown for one adjustment row
          (get-adjustment-ledger-breakdown.md) — what the applied money
          actually settled, ledger by ledger. */}
      {breakdownGuid && (
        <div className="modal-overlay open" onClick={() => setBreakdownGuid(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title"><i className="lni lni-list"></i> Adjustment Ledger Breakdown</div>
              <button className="modal-close" onClick={() => setBreakdownGuid(null)}><i className="lni lni-close"></i></button>
            </div>
            {isBreakdownLoading ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading breakdown…</div>
            ) : isBreakdownError ? (
              <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load this adjustment&apos;s breakdown.</div>
            ) : breakdown.length === 0 ? (
              <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No ledger lines found for this adjustment.</div>
            ) : (
              <ScrollTable className="no-sticky-col">
                <table>
                  <thead><tr><th>Ledger</th><th>Semester</th><th>Amount</th><th>Currency</th></tr></thead>
                  <tbody>
                    {breakdown.map((l, i) => (
                      <tr key={`${l.ledgerGuid}-${i}`}>
                        <td>
                          {l.isDiscountLine ? `${l.ledgerName} (Discount${l.discountName ? `: ${l.discountName}` : ''})` : l.isRoundingLine ? `${l.ledgerName} (Round-off)` : l.ledgerName}
                        </td>
                        <td>{l.semName ?? '—'}</td>
                        <td className={l.isDiscountLine ? 'text-red font-bold' : 'font-bold'}>{fmtAmt(l.amount)}</td>
                        <td>{l.currencyName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            )}
            <div className="modal-footer">
              <button className="btn btn-neu" onClick={() => setBreakdownGuid(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <PaymentSuccessModal
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        showToast={showToast}
        title={successModal?.title ?? ''}
        rows={successModal?.rows ?? []}
        notices={successModal?.notices}
      />
      <Toast toast={toast} />
    </>
  )
}
