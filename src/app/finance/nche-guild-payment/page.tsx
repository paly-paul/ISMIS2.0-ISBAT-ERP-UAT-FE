'use client'
import { useEffect, useRef, useState } from 'react'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { Pagination } from '@/components/Pagination'
import { PaymentSuccessModal } from '@/components/modals/finance/PaymentSuccessModal'
import { ViewRegulatoryPaymentModal } from '@/components/modals/finance/ViewRegulatoryPaymentModal'
import { EditRegulatoryPaymentModal } from '@/components/modals/finance/EditRegulatoryPaymentModal'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import DatePicker from '@/components/DatePicker'
import {
  useSearchStudentsInfinite,
  useStudentProfile,
} from '@/hooks/finance/usePaymentConsole'
import {
  useCreateRegulatoryPayment,
  useDeleteRegulatoryPayment,
  useRegulatoryPaymentHistory,
  useRegulatorySemesterStatus,
  useNcheStudentSearchInfinite,
  PaymentCategory,
  RegulatoryPaymentHistoryEntry,
  RegulatorySemesterStatus,
} from '@/hooks/finance/useNcheGuildPayment'
import { refugeeLabel, studCategoryLabel } from '@/lib/api/finance/paymentConsole'
import { SearchSelect } from '@/components/SearchSelect'
import { useFinanceCurrencies, getDefaultFinanceCurrencyGuid } from '@/hooks/finance/useFinanceCurrencies'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { stripLeadingZeros } from '@/lib/errorMessages'

// Merged NCHE + Guild Payment page — combines the two previously separate
// nche-payment/guild-payment pages behind a single tab switcher, per
// request (2026-09-01). Both categories share the exact same student
// search/profile flow (Payment Console's own search/profile endpoints) and
// the same CRUD + status shape against erp-finance-compliance-service —
// only the URL segment (nche/ vs. guild/) and a couple of payload fields
// differ (pnrNumber+remarks for NCHE vs. bankDeposit+receipt for Guild),
// which useNcheGuildPayment's `category` param and this page's own
// field-toggle handle. Switching tabs keeps the selected student
// (search/profile are category-agnostic) and only resets the payment form
// + outstanding/history/status queries to the newly active category.
//
// Outstanding Balance now comes straight off get-semester-status
// (nche/get-semester-status.md, guild/get-semester-status.md) instead of
// Payment Console's get-all-outstanding-ledgers — per request (2026-09-01),
// same endpoint the card-header due/paid badge already used. That response
// carries no monetary amount at all (just one Paid/Due/"" row per
// semester), so the table below shows a status badge per semester in place
// of a currency amount, keeping the same label-left/value-right row plus
// summary-footer layout the amount-based version used.
const CATEGORY_LABEL: Record<PaymentCategory, string> = { nche: 'NCHE', guild: 'Guild' }
const HISTORY_PAGE_SIZE = 10

function applicantName(a: { firstName: string | null; lastName: string | null }) {
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || '—'
}
function searchResultName(a: { studentName: string | null; firstName: string | null }) {
  return a.studentName || a.firstName || '—'
}

// The NCHE tab's dedicated picker (get-nche-search.md) returns a
// differently-shaped item (studentName/studentNum/programName/semesterName,
// no appRefNo/phone/email) than the Guild tab's generic Payment Console
// search (appRefNo/firstName/phone/emailId) — both are normalized into this
// one shape so the dropdown/select-handler below don't need to branch on
// category. `applicationGuid` is nullable coming off the NCHE picker (a hit
// with no active application) — those rows render but aren't selectable,
// since everything downstream (profile/outstanding/history) keys off it.
interface SearchHit {
  key: string
  applicationGuid: string | null
  studentGuid: string | null
  name: string
  subtitle: string
}

// Delete on a Payment History row goes through the same confirm-then-success
// flow used elsewhere in the app (employee-approve/bulk-intake-edit:
// confirm-modal-overlay/confirm-modal-pop + modal-hdr-blue, swapping the same
// modal's body over to the shared SuccessPopup on success) instead of a bare
// window.confirm + toast — per request (2026-09-01). Edit now opens its own
// modal (EditRegulatoryPaymentModal) instead of routing through this same
// confirm step — correcting a payment isn't the irreversible operation
// Delete is, so a plain Save is enough there. Create (a brand-new payment)
// is unchanged and still goes straight to PaymentSuccessModal.
interface ConfirmDelete {
  entry: RegulatoryPaymentHistoryEntry
}
function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}
function todayYmd() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
// status is exactly "Paid" | "Due" | "" per nche/get-semester-status.md —
// matched precisely rather than by substring, with the same grey fallback
// an earlier, wrong-shape version of this function used for "anything
// unrecognized" (Guild's status values are inferred identical, not
// independently confirmed).
function statusBadgeClass(status: string | null | undefined) {
  if (status === 'Paid') return 'badge-green'
  if (status === 'Due') return 'badge-red'
  return 'badge-grey'
}

// Same label-left/value-right row + summary-footer treatment the old
// amount-based version used (itself matching Payment Console's own
// OutstandingCategoryTable) — but sourced from get-semester-status
// (nche/get-semester-status.md, guild/get-semester-status.md) instead of
// get-all-outstanding-ledgers, since that's what the card-header badge
// above already fetches. One row per semester in the program; the status
// badge stands in for a currency amount, since this response carries none.
// Same .pc-ledger-item/.pc-total-due treatment as Payment Console's own
// Outstanding Balance (Tuition tab) — icon-per-row plus a summary footer —
// in place of this page's previous plain .receipt-row + manually-styled
// summary box, per request to bring this page's look in line with the rest
// of Finance.
function RegulatoryOutstandingTable({ items, isLoading, isError, category }: { items: RegulatorySemesterStatus[] | null | undefined; isLoading: boolean; isError: boolean; category: PaymentCategory }) {
  if (isLoading) return <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading outstanding balance…</div>
  if (isError) return <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load the outstanding balance.</div>
  const semesters = items ?? []
  if (semesters.length === 0) return <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No {CATEGORY_LABEL[category]} semester schedule found for this application.</div>
  const dueCount = semesters.filter(s => s.status === 'Due').length
  const paidCount = semesters.filter(s => s.status === 'Paid').length
  return (
    <>
      {semesters.map(s => {
        const isPaid = s.status === 'Paid'
        const isDue = s.status === 'Due'
        return (
          <div className={`pc-ledger-item${isPaid ? ' paid' : ''}`} key={s.semesterGuid}>
            {/* lni-invoice (the Due icon this used before) isn't a real
                LineIcons 4.0 class — it's the only place in this codebase
                that ever referenced it (vs. lni-timer/lni-checkmark-circle
                below, both confirmed working elsewhere), so it silently
                rendered blank instead of an icon (2026-09-09 bug report:
                "the Due row has no icon"). lni-alarm-clock is a real,
                already-used icon and reads well for "due now" next to
                lni-timer's own "not yet due" waiting look. */}
            <span className="pc-ledger-icon"><i className={isPaid ? 'lni lni-checkmark-circle' : isDue ? 'lni lni-alarm-clock' : 'lni lni-timer'}></i></span>
            <div className="flex-1 min-w-0">
              <div className="pc-ledger-name truncate">{s.semName}</div>
              {isPaid && <div className="pc-ledger-sub">Paid</div>}
            </div>
            <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status || 'Not Yet Due'}</span>
          </div>
        )
      })}
      <div className="pc-total-due">
        <span className="text-muted" style={{ fontSize: 12 }}>Semesters Due</span>
        <span className="font-bold text-blue" style={{ fontSize: 15 }}>{dueCount} of {semesters.length}{paidCount > 0 ? ` · ${paidCount} Paid` : ''}</span>
      </div>
    </>
  )
}

export default function NcheGuildPaymentPage() {
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const [successModal, setSuccessModal] = useState<{ title: string; rows: [string, string][] } | null>(null)

  // Delete confirm step — see ConfirmDelete's own comment above.
  // successInfo set once the delete mutation actually succeeds swaps the
  // same modal from the confirm view over to SuccessPopup, same "stay
  // open, swap to success" convention as employee-approve/bulk-intake-edit.
  const [confirmAction, setConfirmAction] = useState<ConfirmDelete | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string } | null>(null)

  // View/Edit modals (get-payment-nches.md's category-agnostic pair,
  // put-payment-nche.md/put-payment-guild.md) — same convention as Payment
  // Console's own View/Edit actions on its Tuition history table.
  const [viewEntry, setViewEntry] = useState<RegulatoryPaymentHistoryEntry | null>(null)
  const [editTarget, setEditTarget] = useState<RegulatoryPaymentHistoryEntry | null>(null)

  const [category, setCategory] = useState<PaymentCategory>('nche')

  // Payment History as a popup (2026-09-15) — same move Payment Console's
  // own Semester/Other Payment tabs made: off a permanent card merged into
  // the hero, onto a pc-hero-action button that opens it instead.
  const [showHistory, setShowHistory] = useState(false)

  const [search, setSearch] = useState('')
  const [committedSearch, setCommittedSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const [selectedApplicationGuid, setSelectedApplicationGuid] = useState<string | null>(null)
  const [selectedStudentGuidHint, setSelectedStudentGuidHint] = useState<string | null>(null)

  const searchTermLen = search.trim().length
  const searchEnabled = searchFocused && (searchTermLen === 0 || searchTermLen >= 2)
  const searchTerm = committedSearch || search.trim()

  // NCHE has its own dedicated picker (get-nche-search.md); Guild has no
  // documented equivalent yet and still goes through Payment Console's
  // generic search — only one of these two hooks is actually enabled at a
  // time, gated on the active tab. Both are the infinite-scroll variant
  // (same mechanism as the student module's own student-master search
  // dropdown) — scrolling the results list near its bottom fetches the
  // next page instead of this dropdown being capped at a fixed 15 rows.
  const {
    data: nchePages, fetchNextPage: fetchNextNchePage, hasNextPage: hasNextNchePage, isFetchingNextPage: isFetchingNextNchePage,
    isFetching: isNcheSearching, isError: isNcheSearchError, error: ncheSearchError,
  } = useNcheStudentSearchInfinite(searchTerm, 15, category === 'nche' && searchEnabled)
  const {
    data: guildPages, fetchNextPage: fetchNextGuildPage, hasNextPage: hasNextGuildPage, isFetchingNextPage: isFetchingNextGuildPage,
    isFetching: isGuildSearching, isError: isGuildSearchError, error: guildSearchError,
  } = useSearchStudentsInfinite(searchTerm, 15, category === 'guild' && searchEnabled)

  const isSearching = category === 'nche' ? isNcheSearching : isGuildSearching
  const isSearchError = category === 'nche' ? isNcheSearchError : isGuildSearchError
  const searchError = category === 'nche' ? ncheSearchError : guildSearchError
  const isFetchingNextSearchPage = category === 'nche' ? isFetchingNextNchePage : isFetchingNextGuildPage
  const hasNextSearchPage = category === 'nche' ? hasNextNchePage : hasNextGuildPage
  const fetchNextSearchPage = category === 'nche' ? fetchNextNchePage : fetchNextGuildPage
  const matches: SearchHit[] = category === 'nche'
    ? (nchePages?.pages.flatMap(p => p.items) ?? []).map((a, i) => ({
      key: `${a.applicationGuid ?? a.studentGuid}-${i}`,
      applicationGuid: a.applicationGuid,
      studentGuid: a.studentGuid,
      name: a.studentName || a.studentNum || '—',
      subtitle: [a.studentNum, a.programName, a.semesterName].filter(Boolean).join(' · ') || '—',
    }))
    : (guildPages?.pages.flatMap(p => p.items) ?? []).map(a => ({
      key: a.applicationGuid,
      applicationGuid: a.applicationGuid,
      studentGuid: a.studentGuid,
      name: searchResultName(a) as string,
      subtitle: [a.appRefNo, a.phone ?? '—', a.emailId ?? '—'].join(' · '),
    }))

  // Same scrollTop > 0 guard TableSearch's own handleResultsScroll uses —
  // see that component's comment: a plain distance-to-bottom check alone
  // fires spuriously on a short list right after a new page loads, even
  // with no user interaction.
  function handleSearchResultsScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasNextSearchPage || isFetchingNextSearchPage) return
    const el = e.currentTarget
    if (el.scrollTop > 0 && el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchNextSearchPage()
  }

  useEffect(() => {
    if (!searchFocused) return
    function handle(e: MouseEvent) {
      if (!searchBoxRef.current?.contains(e.target as Node)) setSearchFocused(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [searchFocused])

  const { data: profile, isLoading: isProfileLoading, isError: isProfileError, error: profileError } = useStudentProfile(selectedApplicationGuid, !!selectedApplicationGuid, selectedStudentGuidHint)
  const studentGuid = profile?.studentGuid ?? selectedStudentGuidHint ?? null

  // get-semester-status returns one row per semester in the program, not a
  // single current-status object — the card-header badge shows whichever
  // semester is currently Due (the one the cashier should be collecting
  // for), falling back to "fully paid" once nothing is left Due, while the
  // Outstanding Balance card below lists every row. Also now the sole
  // source for that card (see this page's own top-of-file comment) —
  // Payment Console's get-all-outstanding-ledgers is no longer fetched here.
  const { data: semesterStatusList, isLoading: isOutstandingLoading, isError: isOutstandingError } = useRegulatorySemesterStatus(category, selectedApplicationGuid, !!selectedApplicationGuid, studentGuid)
  const dueSemester = semesterStatusList?.find(s => s.status === 'Due') ?? null
  const allSemestersPaid = !!semesterStatusList?.length && semesterStatusList.every(s => s.status === 'Paid')
  const { data: history = [], isLoading: isHistoryLoading } = useRegulatoryPaymentHistory(category, studentGuid, !!studentGuid)
  // Payment History is fetched whole per student — not server-paginated —
  // so it's paged client-side, same as Payment Console's own left-column
  // Payment History card.
  const [historyPage, setHistoryPage] = useState(1)
  useEffect(() => setHistoryPage(1), [studentGuid, category])
  const historyTotalPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  // A delete can shrink the list enough that the page the user was on no
  // longer exists (e.g. deleting the only row on the last page) — clamp
  // back rather than stranding the view on an empty page.
  useEffect(() => { if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages) }, [historyTotalPages, historyPage])
  const pagedHistory = history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)

  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState(todayYmd)
  const [pnrNumber, setPnrNumber] = useState('')
  const [remarks, setRemarks] = useState('')
  const [bankDeposit, setBankDeposit] = useState('')
  // Required on create (post-payment-nche.md / post-payment-guild.md).
  // Recorded only — the rate and balance checks assume the base currency —
  // so it defaults to the default finance currency once the list loads.
  const { data: currencies = [] } = useFinanceCurrencies()
  const [currencyGuid, setCurrencyGuid] = useState('')
  const defaultCurrencyGuid = getDefaultFinanceCurrencyGuid(currencies)
  useEffect(() => {
    if (!currencyGuid && defaultCurrencyGuid) setCurrencyGuid(defaultCurrencyGuid)
  }, [currencyGuid, defaultCurrencyGuid])
  // Inline field errors: amount, currencyGuid, payDate.
  const [errors, setErrors] = useState<Record<string, string>>({})
  function clearError(field: string) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: '' } : prev))
  }
  function fieldErr(field: string) {
    return errors[field] ? <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors[field]}</p> : null
  }

  const createPayment = useCreateRegulatoryPayment(category)
  const deletePayment = useDeleteRegulatoryPayment(category)

  function resetForm() {
    setAmount('')
    setPayDate(todayYmd())
    setCurrencyGuid(defaultCurrencyGuid)
    setPnrNumber('')
    setRemarks('')
    setBankDeposit('')
    setErrors({})
  }

  function switchCategory(next: PaymentCategory) {
    if (next === category) return
    setCategory(next)
    resetForm()
  }

  function selectStudent(applicationGuid: string, name: string, studentGuidHintVal: string | null) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentGuidHint(studentGuidHintVal)
    setSearch(name)
    setCommittedSearch('')
    setSearchFocused(false)
    resetForm()
  }

  function handleClear() {
    setSelectedApplicationGuid(null)
    setSelectedStudentGuidHint(null)
    setSearch('')
    setCommittedSearch('')
    resetForm()
    setSuccessModal(null)
    closeConfirm()
    showToast('Form cleared.', 'warn')
  }

  // Opens the shared confirm modal instead of deleting straight away —
  // confirmDeletePayment below does the actual mutate once the cashier
  // confirms.
  function handleDelete(entry: RegulatoryPaymentHistoryEntry) {
    if (!selectedApplicationGuid) return
    setConfirmAction({ entry })
  }

  function confirmDeletePayment() {
    if (!confirmAction || !selectedApplicationGuid) return
    const { entry } = confirmAction
    deletePayment.mutate(
      { paymentGuid: entry.paymentGuid, applicationGuid: selectedApplicationGuid, studentGuid },
      {
        onSuccess: () => {
          setSuccessInfo({ title: `${CATEGORY_LABEL[category]} Payment Deleted!`, subtitle: `The ${entry.amount.toLocaleString()} payment dated ${entry.payDate.slice(0, 10)} has been removed.` })
        },
        // Left on the confirm view (not closed) so the error is visible
        // right next to the retry button, same as bulk-intake-edit's own
        // confirm popup does on a failed PATCH.
        onError: (error: Error) => showToast(error.message || 'Failed to delete payment.', 'error'),
      },
    )
  }

  function closeConfirm() {
    setConfirmAction(null)
    setSuccessInfo(null)
  }

  // The create validator (post-payment-nche.md / post-payment-guild.md ›
  // Validation), checked all at once and shown inline. "Multiple of the
  // configured rate" and "not more than the outstanding balance" can't be
  // checked here — semester-status carries no amounts — so those come back
  // from the server and land under Amount (see onError below).
  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    const amt = parseFloat(amount)
    if (!amount.trim()) e.amount = 'Amount is required.'
    else if (isNaN(amt) || amt <= 0) e.amount = 'Amount must be greater than 0.'
    if (!currencyGuid) e.currencyGuid = 'Please select the currency received.'
    if (!payDate) e.payDate = 'Payment date is required.'
    return e
  }

  function handleSave() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) { scrollToFirstError(errs); return }
    const amt = parseFloat(amount)

    const categoryFields = category === 'nche'
      ? { pnrNumber: pnrNumber.trim() || null, remarks: remarks.trim() || null }
      : { bankDeposit: bankDeposit.trim() || null }

    createPayment.mutate(
      { applicationGuid: selectedApplicationGuid, studentGuid, amount: amt, currencyGuid, payDate, ...categoryFields },
      {
        onSuccess: result => {
          setSuccessModal({
            title: `${CATEGORY_LABEL[category]} Payment Recorded`,
            rows: [
              ['Amount', amt.toLocaleString()],
              ['Remaining Balance', result.remainingBalance.toLocaleString()],
            ],
          })
          resetForm()
        },
        onError: (error: Error) => {
          // The 400 "not a multiple of the configured rate" / "exceeds
          // outstanding balance" business errors and the 404 for an unknown
          // currency go under their field, in the server's own words; any
          // other failure (application not found, etc.) stays a toast.
          const msg = error.message || ''
          const field = /currency/i.test(msg) ? 'currencyGuid'
            : /multiple|exceed|outstanding|balance|amount/i.test(msg) ? 'amount'
            : /pay ?date/i.test(msg) ? 'payDate'
            : null
          if (field) {
            const e = { [field]: msg }
            setErrors(prev => ({ ...prev, ...e }))
            scrollToFirstError(e)
            return
          }
          showToast(msg || `Failed to save ${CATEGORY_LABEL[category]} payment. Please try again.`, 'error')
        },
      },
    )
  }

  const isSaving = createPayment.isPending

  return (
    <>
      {/* id no longer scopes a .pc-body override (2026-09-15 — this page's
          body moved to the same full-width-hero + .pc-tuition-split layout
          Payment Console's own Semester Payment tab uses, see below); kept
          on the wrapper regardless, same as #page-payment-console's own id,
          in case a future page-specific override is ever needed here. */}
      <div className="page active" id="page-nche-guild-payment">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">NCHE &amp; Guild Payment</div>
            <div className="pg-sub">Search student → view outstanding balance → record payment</div>
          </div>
          <div className="flex gap-2">
            {selectedApplicationGuid && <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-reload"></i> New Search</button>}          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Student Search</div>
          </div>
          <div className="fg" style={{ marginBottom: 0, position: 'relative' }} ref={searchBoxRef}>
            {/* Same label on both tabs per request (2026-09-01) — Guild's
                placeholder below stays tab-specific since its search really
                does still match on ref no/phone/email too (Payment
                Console's generic search), unlike NCHE's dedicated picker. */}
            <div className="lbl">Search by Student Name or Registration No <span className="req">*</span></div>
            <div className="inp-wrap">
              <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
              <input
                className="ctrl"
                type="text"
                placeholder={category === 'nche' ? 'e.g. STU/2024/001 or Tumukunde Alice' : 'e.g. APP20222/667 or Tumukunde Alice'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />
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
                {/* matches.length === 0 gates the loading/error/empty states
                    below — isSearching (useInfiniteQuery's isFetching) also
                    goes true for a load-more fetch, which must not blank out
                    an already-loaded list; isFetchingNextSearchPage's own row
                    further down covers that case instead. */}
                {isSearching && matches.length === 0 && <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>Searching…</div>}
                {!isSearching && isSearchError && matches.length === 0 && (
                  <div className="text-clr-red px-3 py-2" style={{ fontSize: 12.5 }}>
                    <i className="lni lni-warning"></i> {searchError instanceof Error ? searchError.message : 'Search failed. Please try again.'}
                  </div>
                )}
                {!isSearching && !isSearchError && matches.length === 0 && (
                  <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>No applications found.</div>
                )}
                {matches.map(a => {
                  const selectable = !!a.applicationGuid
                  return (
                    <div
                      key={a.key}
                      className={selectable ? 'cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0' : 'px-3 py-2 border-b border-g100 last:border-b-0 opacity-50'}
                      title={selectable ? undefined : 'No active application on file — cannot be selected here.'}
                      onClick={() => selectable && selectStudent(a.applicationGuid as string, a.name, a.studentGuid)}
                    >
                      <div className="font-bold">{a.name}</div>
                      <div className="text-g500" style={{ fontSize: 11 }}>{a.subtitle}</div>
                    </div>
                  )
                })}
                {isFetchingNextSearchPage && (
                  <div className="text-g400 px-3 py-2 text-center" style={{ fontSize: 11.5 }}>
                    <i className="lni lni-reload"></i> Loading more…
                  </div>
                )}
              </div>
            )}
          </div>

          {isProfileLoading && selectedApplicationGuid && (
            <div className="mt-4 text-g400" style={{ fontSize: 12.5 }}>Loading applicant profile…</div>
          )}
          {isProfileError && selectedApplicationGuid && (
            <div className="mt-4 text-clr-red" style={{ fontSize: 12.5 }}>
              <i className="lni lni-warning"></i> {profileError instanceof Error ? profileError.message : "Couldn't load this applicant's profile."}
            </div>
          )}
        </div>

        {profile && (
          <>
            {/* Same rounded-pill .pc-tabs/.pc-tab-btn switcher as Payment
                Console's own Semester Payment/Other Payment tabs, moved
                below Student Search and gated on a selected student
                (2026-09-09, per request) — matches Payment Console's own
                .pc-tabs, which only renders once selectedApplicationGuid is
                set, rather than showing category-selection ahead of picking
                who it's even for. */}
            <div className="pc-tabs">
              <button className={`pc-tab-btn${category === 'nche' ? ' active' : ''}`} onClick={() => switchCategory('nche')}>
                <i className="lni lni-graduation"></i> NCHE
              </button>
              <button className={`pc-tab-btn${category === 'guild' ? ' active' : ''}`} onClick={() => switchCategory('guild')}>
                <i className="lni lni-users"></i> Guild
              </button>
            </div>

            {/* Full-width hero card, promoted out of a 2-column split
                (2026-09-15) — same move Payment Console's own Semester
                Payment tab made: Payment History is now a popup opened from
                a pc-hero-action button here instead of a permanent section
                merged into this card. */}
            <div className="card p-0 overflow-hidden">
              <div className="pc-hero">
                <div className="pc-hero-top">
                  <div className="pc-hero-avatar">{initialsFor(applicantName(profile))}</div>
                  <div className="flex-1 min-w-0">
                    <div className="pc-hero-name truncate">{applicantName(profile)}</div>
                    <div className="pc-hero-sub truncate">{profile.programName ?? '—'}</div>
                    <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {profile.appRefNo}</span>
                  </div>
                  <div className="pc-hero-actions pc-hero-actions-top">
                    <button type="button" className="pc-hero-action" onClick={() => setShowHistory(true)}>
                      <i className="lni lni-folder"></i>
                      <span>Payment History</span>
                      {history.length > 0 && <strong>{history.length}</strong>}
                    </button>
                  </div>
                </div>
                <div className="pc-hero-facts">
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val">—</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Semester</span><span className="pc-hero-fact-val" title={profile.semesterName ?? '—'}>{profile.semesterName ?? '—'}</span></div>
                  {/* Guards against the literal string "null" — same live
                      quirk Payment Console's own Intake tile guards against. */}
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Intake</span><span className="pc-hero-fact-val" title={profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}>{profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={profile.batchCode ?? '—'}>{profile.batchCode ?? '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Year</span><span className="pc-hero-fact-val" title={profile.yearCode ?? '—'}>{profile.yearCode ?? '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Phone</span><span className="pc-hero-fact-val" title={profile.phone ?? '—'}>{profile.phone ?? '—'}</span></div>
                  <div className="pc-hero-fact pc-hero-fact-span2">
                    <span className="pc-hero-fact-lbl">Email</span>
                    <span className="pc-hero-fact-val truncate" title={profile.emailId ?? profile.universityEmail ?? '—'}>{profile.emailId ?? profile.universityEmail ?? '—'}</span>
                  </div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Reg Status</span><span className="pc-hero-fact-val" title={profile.regStatusName ?? '—'}>{profile.regStatusName ?? '—'}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Refugee</span><span className="pc-hero-fact-val">{refugeeLabel(profile.refugee)}</span></div>
                  <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Category</span><span className="pc-hero-fact-val">{studCategoryLabel(profile.studCategory)}</span></div>
                </div>
              </div>
            </div>

            {/* Payment History — popup (2026-09-15), same modal-overlay/
                modal-lg shell as Payment Console's own showPaymentHistory. */}
            {showHistory && (
              <div className="modal-overlay open">
                <div className="modal modal-lg" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-hdr modal-hdr-blue" style={{ flexShrink: 0 }}>
                    <div className="modal-title"><i className="lni lni-folder"></i> Payment History</div>
                    <button className="modal-close" onClick={() => setShowHistory(false)}><i className="lni lni-close"></i></button>
                  </div>
                  <div style={{ padding: 20, overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
                    {isHistoryLoading ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading payment history…</div>
                    ) : history.length === 0 ? (
                      <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No {CATEGORY_LABEL[category]} payments recorded yet.</div>
                    ) : (
                      <>
                      <ScrollTable className="no-sticky-col">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width: 40 }}></th>
                              <th>Payment Date</th>
                              {category === 'nche' ? <th>PNR Number</th> : <th>Bank Deposit</th>}
                              <th>Amount</th>
                              {category === 'nche' && <th>Remarks</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {pagedHistory.map(h => (
                              <tr key={h.paymentGuid}>
                                <td>
                                  <ActionMenu>
                                    <button className="btn btn-neu btn-sm" onClick={() => setViewEntry(h)}>
                                      <i className="lni lni-eye"></i> View
                                    </button>
                                    {/* permissions.edit && ( */}
                                      <button className="btn btn-neu btn-sm" onClick={() => setEditTarget(h)}>
                                        <i className="lni lni-pencil-alt"></i> Edit
                                      </button>
                                    {/* )} */}
                                    {permissions.delete && (
                                      <button className="btn btn-neu btn-sm" onClick={() => handleDelete(h)}>
                                        <i className="lni lni-trash-can"></i> Delete
                                      </button>
                                    )}
                                  </ActionMenu>
                                </td>
                                <td>{h.payDate.slice(0, 10)}</td>
                                {category === 'nche' ? (
                                  <td className="font-mono text-blue">{h.pnrNumber ?? '—'}</td>
                                ) : (
                                  <td className="text-muted">{h.bankDeposit ?? '—'}</td>
                                )}
                                <td className="text-green font-bold">{h.amount.toLocaleString()}</td>
                                {category === 'nche' && <td className="text-muted">{h.remarks ?? '—'}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollTable>
                      <Pagination page={historyPage} totalPages={historyTotalPages} totalCount={history.length} itemLabel="payments" onPageChange={setHistoryPage} />
                      </>
                    )}
                  </div>
                  <div className="modal-footer" style={{ flexShrink: 0 }}>
                    <button className="btn btn-neu flex-1 justify-center" onClick={() => setShowHistory(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading / no schedule / fully paid — one full-width card each,
                with no payment form, same as Payment Console's tuition tab:
                with nothing to bill, any amount would only be rejected. */}
            {isOutstandingLoading && (
              <div className="card text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Checking outstanding balance…</div>
            )}
            {!isOutstandingLoading && !isOutstandingError && !semesterStatusList?.length && (
              <div className="card text-center" style={{ padding: 24 }}>
                <div className="text-g400" style={{ fontSize: 22 }}><i className="lni lni-calendar"></i></div>
                <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>No {CATEGORY_LABEL[category]} schedule</div>
                <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>This application has no {CATEGORY_LABEL[category]} semester schedule — there is nothing to bill right now.</div>
              </div>
            )}
            {!isOutstandingLoading && !isOutstandingError && allSemestersPaid && (
              <div className="card text-center" style={{ padding: 24 }}>
                <div className="pc-receipt-check" style={{ fontSize: 22 }}><i className="lni lni-checkmark-circle"></i></div>
                <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Fully settled</div>
                <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>Every semester&apos;s {CATEGORY_LABEL[category]} fee is paid — there is nothing to bill right now.</div>
              </div>
            )}

            {/* .pc-tuition-split — Outstanding Balance (left) / Payment
                Detail (right), same two-card split as Payment Console's own
                Semester Payment tab. Only once there's something to bill (or
                the status failed to load — the table shows that error and
                the cashier can still record a payment). */}
            {!isOutstandingLoading && (isOutstandingError || (!!semesterStatusList?.length && !allSemestersPaid)) && (
            <div className="pc-tuition-split">
              <div className="card flex flex-col gap-4 min-w-0">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-dollar"></i></span> Outstanding Balance ({CATEGORY_LABEL[category]})</div>
                  {dueSemester ? (
                    <span className={`badge ${statusBadgeClass(dueSemester.status)}`}>{dueSemester.semName} — Due</span>
                  ) : allSemestersPaid ? (
                    <span className="badge badge-green">Fully Paid</span>
                  ) : null}
                </div>
                <RegulatoryOutstandingTable items={semesterStatusList} isLoading={isOutstandingLoading} isError={isOutstandingError} category={category} />
              </div>

              <div className="card flex flex-col gap-4 min-w-0">
                <div className="sec-divider" style={{ marginTop: 0 }}>
                  <i className="lni lni-wallet"></i> Payment Detail
                </div>
                {/* Currency + Amount paired, then Date + the category's
                    reference field — same arrangement as Payment Console. */}
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Currency Received <span className="req">*</span></div>
                    <SearchSelect
                      placeholder="— Select Currency —"
                      options={currencies.map(c => ({ value: c.currencyGuid, label: `${c.currencyCode} — ${c.currencyName}` }))}
                      value={currencyGuid}
                      onChange={v => { setCurrencyGuid(v); clearError('currencyGuid') }}
                    />
                    {fieldErr('currencyGuid')}
                  </div>
                  <div className="fg">
                    <div className="lbl">Amount <span className="req">*</span></div>
                    <input type="number" min={0} step={0.01} className="amt-val-input" placeholder="0.00"
                      style={{ fontSize: 18, fontWeight: 700, ...(errors.amount ? { borderColor: 'var(--red)' } : {}) }}
                      aria-invalid={!!errors.amount}
                      // Number inputs still accept e/E/+/-; none is a valid amount (> 0).
                      onKeyDown={e => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                      value={amount} onChange={e => { setAmount(stripLeadingZeros(e.target.value)); clearError('amount') }} />
                    {errors.amount
                      ? fieldErr('amount')
                      : <div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 4 }}>Must be a multiple of the configured {CATEGORY_LABEL[category]} rate, and not more than the outstanding balance.</div>}
                  </div>
                </div>
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Payment Date <span className="req">*</span></div>
                    <DatePicker value={payDate} onChange={v => { setPayDate(v); clearError('payDate') }} hasError={!!errors.payDate} />
                    {fieldErr('payDate')}
                  </div>
                  {category === 'nche' ? (
                    <div className="fg">
                      <div className="lbl">PNR Number</div>
                      <input className="ctrl" type="text" placeholder="Optional reference number" value={pnrNumber} onChange={e => setPnrNumber(e.target.value)} />
                    </div>
                  ) : (
                    <div className="fg">
                      <div className="lbl">Bank Deposit</div>
                      <input className="ctrl" type="text" placeholder="Optional bank deposit reference" value={bankDeposit} onChange={e => setBankDeposit(e.target.value)} />
                    </div>
                  )}
                </div>
                {category === 'nche' && (
                  <div className="fg mb-4">
                    <div className="lbl">Remarks</div>
                    <textarea className="ctrl" rows={2} placeholder="Optional notes" value={remarks} onChange={e => setRemarks(e.target.value)} />
                  </div>
                )}
                <div className="flex gap-[10px] justify-end items-center">
                  <button className="btn btn-primary btn-lg" disabled={isSaving} onClick={handleSave}>
                    <i className="lni lni-save"></i> {isSaving ? 'Saving…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {successModal && (
        <PaymentSuccessModal
          isOpen={!!successModal}
          onClose={() => setSuccessModal(null)}
          showToast={showToast}
          title={successModal.title}
          rows={successModal.rows}
        />
      )}

      <ViewRegulatoryPaymentModal isOpen={!!viewEntry} onClose={() => setViewEntry(null)} showToast={showToast} entry={viewEntry} category={category} />
      <EditRegulatoryPaymentModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        showToast={showToast}
        target={editTarget}
        category={category}
        applicationGuid={selectedApplicationGuid}
        studentGuid={studentGuid}
      />

      {/* Delete confirm step — same confirm-modal-overlay/confirm-
          modal-pop + modal-hdr-blue markup as employee-approve/
          bulk-intake-edit, swapping this same modal's body over to the
          shared SuccessPopup once the mutation actually succeeds instead
          of closing outright. */}
      {confirmAction && (
        <div className="modal-overlay open confirm-modal-overlay">
          <div className="modal modal-sm confirm-modal-pop" onClick={e => e.stopPropagation()}>
            {successInfo ? (
              <SuccessPopup title={successInfo.title} subtitle={successInfo.subtitle} onClose={closeConfirm} />
            ) : (
              <>
                <div className="modal-hdr modal-hdr-blue">
                  <div className="modal-title">Confirm Delete</div>
                  <button className="modal-close" onClick={closeConfirm}><i className="lni lni-close"></i></button>
                </div>
                <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--g700)', lineHeight: 1.6 }}>
                  Delete this {CATEGORY_LABEL[category]} payment of <strong>{confirmAction.entry.amount.toLocaleString()}</strong> dated <strong>{confirmAction.entry.payDate.slice(0, 10)}</strong>? This cannot be undone.
                </div>
                <div className="modal-footer">
                  <button className="btn btn-neu" onClick={closeConfirm}>Cancel</button>
                  <button className="btn btn-danger" disabled={deletePayment.isPending} onClick={confirmDeletePayment}>
                    <i className="lni lni-trash-can"></i> {deletePayment.isPending ? 'Deleting…' : 'Confirm & Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
