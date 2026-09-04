'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { PaymentSuccessModal } from '@/components/modals/finance/PaymentSuccessModal'
import { SuccessPopup } from '@/components/modals/shared/SuccessPopup'
import DatePicker from '@/components/DatePicker'
import {
  useSearchStudentsInfinite,
  useStudentProfile,
} from '@/hooks/finance/usePaymentConsole'
import {
  useCreateRegulatoryPayment,
  useUpdateRegulatoryPayment,
  useDeleteRegulatoryPayment,
  useRegulatoryPaymentHistory,
  useRegulatorySemesterStatus,
  useNcheStudentSearchInfinite,
  PaymentCategory,
  RegulatoryPaymentHistoryEntry,
  RegulatoryPaymentUpdateInput,
  RegulatorySemesterStatus,
} from '@/hooks/finance/useNcheGuildPayment'

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

// Edit/Delete on a Payment History row now go through the same confirm-then-
// success flow used elsewhere in the app (employee-approve/bulk-intake-edit:
// confirm-modal-overlay/confirm-modal-pop + modal-hdr-blue, swapping the same
// modal's body over to the shared SuccessPopup on success) instead of a bare
// window.confirm + toast — per request (2026-09-01). Create (a brand-new,
// not-editing payment) is unchanged and still goes straight to
// PaymentSuccessModal; only Update and Delete route through this.
interface ConfirmUpdate {
  kind: 'update'
  paymentGuid: string
  input: RegulatoryPaymentUpdateInput
  applicationGuid: string
  studentGuid: string | null
}
interface ConfirmDelete {
  kind: 'delete'
  entry: RegulatoryPaymentHistoryEntry
}
type ConfirmAction = ConfirmUpdate | ConfirmDelete
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
function RegulatoryOutstandingTable({ items, isLoading, isError, category }: { items: RegulatorySemesterStatus[] | null | undefined; isLoading: boolean; isError: boolean; category: PaymentCategory }) {
  if (isLoading) return <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Loading outstanding balance…</div>
  if (isError) return <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load the outstanding balance.</div>
  const semesters = items ?? []
  if (semesters.length === 0) return <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No {CATEGORY_LABEL[category]} semester schedule found for this application.</div>
  const dueCount = semesters.filter(s => s.status === 'Due').length
  const paidCount = semesters.filter(s => s.status === 'Paid').length
  return (
    <>
      {semesters.map(s => (
        <div className="receipt-row" key={s.semesterGuid}>
          <span className="text-muted">{s.semName}</span>
          <span className={`badge ${statusBadgeClass(s.status)}`}>{s.status || 'Not Yet Due'}</span>
        </div>
      ))}
      <div className="mt-[10px] p-3 rounded-[var(--rsm)] bg-b50 border border-[1.5px] border-b100 flex justify-between items-center">
        <span className="text-muted" style={{ fontSize: 12 }}>Semesters Due</span>
        <span className="font-bold text-blue">{dueCount} of {semesters.length}{paidCount > 0 ? ` · ${paidCount} Paid` : ''}</span>
      </div>
    </>
  )
}

export default function NcheGuildPaymentPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  const [successModal, setSuccessModal] = useState<{ title: string; rows: [string, string][] } | null>(null)

  // Edit/Delete confirm step — see ConfirmAction's own comment above.
  // successInfo set once confirmAction's mutation actually succeeds swaps
  // the same modal from the confirm view over to SuccessPopup, same
  // "stay open, swap to success" convention as employee-approve/
  // bulk-intake-edit.
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ title: string; subtitle: string } | null>(null)

  const [category, setCategory] = useState<PaymentCategory>('nche')

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
  // Set while editing an existing history row — Save switches to Update
  // (PUT) against this guid instead of Create (POST); cleared on
  // save/cancel/student change/tab switch.
  const [editingGuid, setEditingGuid] = useState<string | null>(null)

  const createPayment = useCreateRegulatoryPayment(category)
  const updatePayment = useUpdateRegulatoryPayment(category)
  const deletePayment = useDeleteRegulatoryPayment(category)

  function resetForm() {
    setAmount('')
    setPayDate(todayYmd())
    setPnrNumber('')
    setRemarks('')
    setBankDeposit('')
    setEditingGuid(null)
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

  function startEdit(entry: RegulatoryPaymentHistoryEntry) {
    setEditingGuid(entry.paymentGuid)
    setAmount(String(entry.amount))
    setPayDate(entry.payDate.slice(0, 10))
    setPnrNumber(entry.pnrNumber ?? '')
    setRemarks(entry.remarks ?? '')
    setBankDeposit(entry.bankDeposit ?? '')
  }

  // Opens the shared confirm modal instead of deleting straight away —
  // confirmDeletePayment below does the actual mutate once the cashier
  // confirms.
  function handleDelete(entry: RegulatoryPaymentHistoryEntry) {
    if (!selectedApplicationGuid) return
    setConfirmAction({ kind: 'delete', entry })
  }

  function confirmDeletePayment() {
    if (!confirmAction || confirmAction.kind !== 'delete' || !selectedApplicationGuid) return
    const { entry } = confirmAction
    deletePayment.mutate(
      { paymentGuid: entry.paymentGuid, applicationGuid: selectedApplicationGuid, studentGuid },
      {
        onSuccess: () => {
          setSuccessInfo({ title: `${CATEGORY_LABEL[category]} Payment Deleted!`, subtitle: `The ${entry.amount.toLocaleString()} payment dated ${entry.payDate.slice(0, 10)} has been removed.` })
          if (editingGuid === entry.paymentGuid) resetForm()
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

  function handleSave() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    const amt = parseFloat(amount)
    if (!amount.trim() || isNaN(amt) || amt <= 0) { showToast('Amount must be greater than 0.', 'warn'); return }
    if (!payDate) { showToast('Please select a payment date.', 'warn'); return }

    const categoryFields = category === 'nche'
      ? { pnrNumber: pnrNumber.trim() || null, remarks: remarks.trim() || null }
      : { bankDeposit: bankDeposit.trim() || null }

    // Editing an existing history row now opens the same confirm modal
    // Delete uses, instead of saving straight away — confirmUpdatePayment
    // below does the actual mutate once the cashier confirms.
    if (editingGuid) {
      setConfirmAction({ kind: 'update', paymentGuid: editingGuid, input: { amount: amt, payDate, ...categoryFields }, applicationGuid: selectedApplicationGuid, studentGuid })
      return
    }

    createPayment.mutate(
      { applicationGuid: selectedApplicationGuid, studentGuid, amount: amt, payDate, ...categoryFields },
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
          // Same 400 "not a multiple of the configured rate"/"exceeds
          // outstanding balance" business errors each doc describes —
          // surfaced as-is rather than guessed at, since the rate isn't
          // known here.
          showToast(error.message || `Failed to save ${CATEGORY_LABEL[category]} payment. Please try again.`, 'error')
        },
      },
    )
  }

  function confirmUpdatePayment() {
    if (!confirmAction || confirmAction.kind !== 'update') return
    const { paymentGuid, input, applicationGuid, studentGuid: sg } = confirmAction
    updatePayment.mutate(
      { paymentGuid, input, applicationGuid, studentGuid: sg },
      {
        onSuccess: result => {
          setSuccessInfo({ title: `${CATEGORY_LABEL[category]} Payment Updated!`, subtitle: `Amount ${input.amount.toLocaleString()} on ${input.payDate} — remaining balance ${result.remainingBalance.toLocaleString()}.` })
          resetForm()
        },
        // Left on the confirm view (not closed) so the error is visible
        // right next to the retry button, same as bulk-intake-edit's own
        // confirm popup does on a failed PATCH.
        onError: (error: Error) => showToast(error.message || `Failed to update ${CATEGORY_LABEL[category]} payment. Please try again.`, 'error'),
      },
    )
  }

  const isSaving = createPayment.isPending || updatePayment.isPending

  return (
    <>
      {/* id scopes the .pc-body 2-column override in globals.css to just
          this page — same convention #page-payment-console's own id uses,
          per request (2026-09-01) to bring this page's layout in line with
          Payment Console's: a left column (Profile Details + Payment
          History, merged) beside a wider right column (Outstanding
          Balance + Payment Detail, merged), instead of everything stacked
          full-width in a single column. */}
      <div className="page active" id="page-nche-guild-payment">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">NCHE &amp; Guild Payment</div>
            <div className="pg-sub">Search student → view outstanding balance → record payment</div>
          </div>
          <div className="flex gap-2">
            {selectedApplicationGuid && <button className="btn btn-neu" onClick={handleClear}><i className="lni lni-reload"></i> New Search</button>}
            <button className="btn btn-neu" onClick={() => router.push('/finance/dashboard')}><i className="lni lni-arrow-left"></i> Back</button>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="tab-bar">
            <button className={`tab-btn${category === 'nche' ? ' active' : ''}`} onClick={() => switchCategory('nche')}>
              <i className="lni lni-graduation"></i> NCHE
            </button>
            <button className={`tab-btn${category === 'guild' ? ' active' : ''}`} onClick={() => switchCategory('guild')}>
              <i className="lni lni-users"></i> Guild
            </button>
          </div>
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
          <div className="pc-body">
            {/* LEFT column: Profile Details + Payment History, merged into
                one card — same layout Payment Console's own left column
                uses (see its own "merged into this same card as a second
                section" comment). */}
            <div className="flex flex-col gap-5 min-w-0">
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-user"></i></span> Profile Details</div>
                </div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-14 h-14 rounded-full flex-shrink-0 grid place-items-center text-white font-extrabold" style={{ background: 'linear-gradient(135deg,var(--b700),var(--b500))', fontSize: 17 }}>
                    {initialsFor(applicantName(profile))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-g900" style={{ fontSize: 15.5 }}>{applicantName(profile)}</div>
                    <div className="text-g500 text-xs truncate">{profile.programName ?? '—'}</div>
                  </div>
                </div>
                <div className="mb-3">
                  <span className="badge badge-blue font-mono"><i className="lni lni-bookmark"></i> {profile.appRefNo}</span>
                </div>
                {/* Same pc-fact-grid tiles as Payment Console's own Profile
                    Details — Campus has no client-side name resolver on
                    this page (Payment Console falls back to useCampuses()
                    for it; not pulled in here), so it stays '—' rather than
                    a guessed value. Every other field is already
                    pre-resolved on StudentProfile itself, same as there. */}
                <div className="pc-fact-grid">
                  <div className="pc-fact"><i className="lni lni-map-marker"></i><div><span className="pc-fact-lbl">Campus</span><span className="pc-fact-val">—</span></div></div>
                  <div className="pc-fact"><i className="lni lni-calendar"></i><div><span className="pc-fact-lbl">Semester</span><span className="pc-fact-val">{profile.semesterName ?? '—'}</span></div></div>
                  {/* Guards against the literal string "null" — same live
                      quirk Payment Console's own Intake tile guards against. */}
                  <div className="pc-fact"><i className="lni lni-calendar"></i><div><span className="pc-fact-lbl">Intake</span><span className="pc-fact-val">{profile.intakeCode && profile.intakeCode !== 'null' ? profile.intakeCode : '—'}</span></div></div>
                  <div className="pc-fact"><i className="lni lni-graduation"></i><div><span className="pc-fact-lbl">Batch</span><span className="pc-fact-val">{profile.batchCode ?? '—'}</span></div></div>
                  <div className="pc-fact"><i className="lni lni-calendar"></i><div><span className="pc-fact-lbl">Year</span><span className="pc-fact-val">{profile.yearCode ?? '—'}</span></div></div>
                  <div className="pc-fact"><i className="lni lni-phone"></i><div><span className="pc-fact-lbl">Phone</span><span className="pc-fact-val">{profile.phone ?? '—'}</span></div></div>
                  <div className="pc-fact pc-fact-span2"><i className="lni lni-envelope"></i><div><span className="pc-fact-lbl">Email</span><span className="pc-fact-val truncate">{profile.emailId ?? profile.universityEmail ?? '—'}</span></div></div>
                </div>

                <div className="sec-divider"><i className="lni lni-files"></i> Payment History</div>
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
                          <th>Payment Date</th>
                          {category === 'nche' ? <th>PNR Number</th> : <th>Bank Deposit</th>}
                          <th>Amount</th>
                          {category === 'nche' && <th>Remarks</th>}
                          <th style={{ width: 90 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedHistory.map(h => (
                          <tr key={h.paymentGuid}>
                            <td>{h.payDate.slice(0, 10)}</td>
                            {category === 'nche' ? (
                              <td className="font-mono text-blue">{h.pnrNumber ?? '—'}</td>
                            ) : (
                              <td className="text-muted">{h.bankDeposit ?? '—'}</td>
                            )}
                            <td className="text-green font-bold">{h.amount.toLocaleString()}</td>
                            {category === 'nche' && <td className="text-muted">{h.remarks ?? '—'}</td>}
                            <td>
                              <div className="flex gap-2">
                                <button className="btn-icon" title="Edit" onClick={() => startEdit(h)}><i className="lni lni-pencil-alt"></i></button>
                                <button className="btn-icon" title="Delete" style={{ color: 'var(--red)' }} onClick={() => handleDelete(h)}><i className="lni lni-trash-can"></i></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollTable>
                  <Pagination page={historyPage} totalPages={historyTotalPages} totalCount={history.length} itemLabel="payments" onPageChange={setHistoryPage} />
                  </>
                )}
              </div>
            </div>

            {/* RIGHT column: Outstanding Balance + Payment Detail, merged
                into one card — same "single card, not two" treatment
                Payment Console's own Tuition tab uses for its outstanding-
                balance-plus-form section. */}
            <div className="flex flex-col gap-5 min-w-0">
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-dollar"></i></span> Outstanding Balance ({CATEGORY_LABEL[category]})</div>
                  {dueSemester ? (
                    <span className={`badge ${statusBadgeClass(dueSemester.status)}`}>{dueSemester.semName} — Due</span>
                  ) : allSemestersPaid ? (
                    <span className="badge badge-green">Fully Paid</span>
                  ) : null}
                </div>
                <RegulatoryOutstandingTable items={semesterStatusList} isLoading={isOutstandingLoading} isError={isOutstandingError} category={category} />

                <div className="sec-divider flex items-center justify-between">
                  <span><i className="lni lni-wallet"></i> Payment Detail</span>
                  {editingGuid && <span className="badge badge-amber">Editing existing payment</span>}
                </div>
                <div className="g2 mb-[14px]">
                  <div className="fg">
                    <div className="lbl">Amount <span className="req">*</span></div>
                    <input type="number" min={0} step={0.01} className="amt-val-input" placeholder="0.00"
                      style={{ fontSize: 18, fontWeight: 700 }}
                      value={amount} onChange={e => setAmount(e.target.value)} />
                    <div style={{ fontSize: 11, color: 'var(--g500)', marginTop: 4 }}>Must be a multiple of the configured {CATEGORY_LABEL[category]} rate — enforced server-side.</div>
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
                    <div className="fg mb-4">
                      <div className="lbl">Remarks</div>
                      <textarea className="ctrl" rows={2} placeholder="Optional notes" value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="fg mb-4">
                    <div className="lbl">Bank Deposit</div>
                    <input className="ctrl" type="text" placeholder="Optional bank deposit reference" value={bankDeposit} onChange={e => setBankDeposit(e.target.value)} />
                  </div>
                )}
                <div className="flex gap-[10px] justify-end items-center">
                  {editingGuid && <button className="btn btn-neu" onClick={resetForm}><i className="lni lni-close"></i> Cancel Edit</button>}
                  <button className="btn btn-primary btn-lg" disabled={isSaving} onClick={handleSave}>
                    <i className="lni lni-save"></i> {isSaving ? 'Saving…' : editingGuid ? `Update ${CATEGORY_LABEL[category]} Payment` : `Save ${CATEGORY_LABEL[category]} Payment`}
                  </button>
                </div>
              </div>
            </div>
          </div>
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

      {/* Edit/Delete confirm step — same confirm-modal-overlay/confirm-
          modal-pop + modal-hdr-blue markup as employee-approve/
          bulk-intake-edit, swapping this same modal's body over to the
          shared SuccessPopup once the mutation actually succeeds instead
          of closing outright. */}
      {confirmAction && (
        <div className="modal-overlay open confirm-modal-overlay" onClick={successInfo ? undefined : closeConfirm}>
          <div className="modal modal-sm confirm-modal-pop" onClick={e => e.stopPropagation()}>
            {successInfo ? (
              <SuccessPopup title={successInfo.title} subtitle={successInfo.subtitle} onClose={closeConfirm} />
            ) : confirmAction.kind === 'delete' ? (
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
            ) : (
              <>
                <div className="modal-hdr modal-hdr-blue">
                  <div className="modal-title">Confirm Update</div>
                  <button className="modal-close" onClick={closeConfirm}><i className="lni lni-close"></i></button>
                </div>
                <div style={{ padding: '18px 20px', fontSize: 13.5, color: 'var(--g700)', lineHeight: 1.6 }}>
                  Update this {CATEGORY_LABEL[category]} payment to <strong>{confirmAction.input.amount.toLocaleString()}</strong> on <strong>{confirmAction.input.payDate}</strong>?
                </div>
                <div className="modal-footer">
                  <button className="btn btn-neu" onClick={closeConfirm}>Cancel</button>
                  <button className="btn btn-primary" disabled={updatePayment.isPending} onClick={confirmUpdatePayment}>
                    <i className="lni lni-checkmark"></i> {updatePayment.isPending ? 'Updating…' : 'Confirm & Update'}
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
