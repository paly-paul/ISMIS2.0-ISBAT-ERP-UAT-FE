'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { SearchSelect } from '@/components/SearchSelect'
import { useSearchStudentsInfinite, useStudentProfile } from '@/hooks/finance/usePaymentConsole'
import { useCampuses } from '@/hooks/config/useCampuses'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useBatches } from '@/hooks/academic/useBatches'
import { useSemestersForProgram } from '@/hooks/academic/useSemesters'
import { useDiscounts } from '@/hooks/finance/useDiscounts'
import { useCooperates } from '@/hooks/finance/useCooperates'
import {
  useStudentDiscount,
  useAssignStudentDiscount,
  useUpdateStudentDiscount,
  useCancelStudentDiscount,
  DISCOUNT_STATUS_VALUES,
  DISCOUNT_STATUS_LABELS,
} from '@/hooks/student/useStudentDiscount'
import { CALC_TYPE_VALUES, CALC_TYPE_LABELS } from '@/lib/api/finance/discount'

// Sketch: a Payment-Console-style split — Student Master search on the
// left, an "Apply Discount" form on the right with Edit/Cancel Discount
// actions once something's assigned, and a Confirm Cancel Discount popup
// offering "next semester" vs "immediately". The underlying assign/update/
// cancel-discount endpoints are already real and proven — Student Profile's
// own "Manage Discount" modal (student/profile/page.tsx) has used them
// since 2026-09-01 — this page is a dedicated, search-driven surface for
// the same workflow rather than a modal buried in a profile page, matching
// how Payment Console/NCHE & Guild Payment are their own pages too.
//
// Ledger, Fee Year, and the read-only Programme/Semester fields were
// dropped per request (2026-09-02) — Ledger/Fee Year had no backing field
// anywhere in AssignStudentDiscountRequest/UpdateStudentDiscountRequest/
// StudentDiscountDto to begin with (studentDiscount.ts), and Programme/
// Semester are already shown on the profile hero card to the left, so
// repeating them in the form was redundant.

function applicantName(a: { firstName: string | null; lastName: string | null }) {
  return `${a.firstName ?? ''}${a.lastName ? ` ${a.lastName}` : ''}`.trim() || '—'
}

// Search results come from FinanceStudentSearchDto (no lastName — a
// pre-combined studentName instead), same shape Payment Console's own
// search dropdown consumes.
function searchResultName(a: { studentName: string | null; firstName: string | null }) {
  return a.studentName || a.firstName || '—'
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

// discountStatus is a numeric enum (confirmed live 2026-09-02 — see
// studentDiscount.ts's own DISCOUNT_STATUS_VALUES comment for exactly what
// is/isn't confirmed about which number means what).
function statusBadgeClass(status: number | null | undefined) {
  if (status === DISCOUNT_STATUS_VALUES.Active) return 'badge-green'
  if (status == null) return 'badge-blue'
  return 'badge-grey'
}

function statusLabel(status: number | null | undefined) {
  if (status == null) return '—'
  return DISCOUNT_STATUS_LABELS[status] ?? `Status ${status}`
}

// A cancellation is a status change, not a delete (post-cancel-student-
// discount.md: "the record stays with a cancelled status") — GET keeps
// returning this same record afterward, just no longer at Active status
// (confirmed live: a second cancel call against an already-cancelled
// record is refused with "Discount is already cancelled."). So a non-null
// discountDetail alone doesn't mean "there's an active assignment to edit/
// cancel" — a cancelled one is really "nothing currently assigned", and
// should offer the Apply Discount form again (assigning a new one), not
// the view/Edit/Cancel actions meant for a live assignment. Checking
// "not Active" rather than "equals the Cancelled value" holds regardless
// of which of the two cancelled-state numbers a given record carries.
function isCancelledStatus(status: number | null | undefined) {
  return status !== DISCOUNT_STATUS_VALUES.Active
}

export default function DiscountAllocationPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ── Student search — identical mechanics to Payment Console's own (same
  // hooks, same debounce/click-outside/infinite-scroll behavior) so the two
  // pages feel like one system. ──
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
    isFetching: isSearching, isError: isSearchError, error: searchError,
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

  const { data: profile, isLoading: isProfileLoading, isError: isProfileError, error: profileError } = useStudentProfile(selectedApplicationGuid, !!selectedApplicationGuid, selectedStudentGuidHint)
  const studentGuid = profile?.studentGuid ?? selectedStudentGuidHint ?? null

  // Client-side name resolution for the profile's guid FKs — same fallback
  // pattern as Payment Console (prefer the server-resolved name, fall back
  // to the client-side lookup only when the server sends null).
  const { data: campuses = [] } = useCampuses()
  const { data: programs = [] } = useProgramMasters()
  const { data: allBatchesData } = useBatches(1, 1000)
  const batches = allBatchesData?.items ?? []
  const { data: semesters = [] } = useSemestersForProgram(profile?.programGuid ?? '', !!profile?.programGuid)
  const campusName = campuses.find(c => c.campusGuid === profile?.campusGuid)?.campusName
  const programName = profile?.programName ?? programs.find(p => p.programGuid === profile?.programGuid)?.programName
  const batchCode = profile?.batchCode ?? batches.find(b => b.batchGuid === profile?.batchGuid)?.batchCode
  const semName = profile?.semesterName ?? semesters.find(s => s.semesterGuid === profile?.semesterGuid)?.semName

  // ── Discount catalogue + this student's current assignment. ──
  const { data: discountCatalogue = [] } = useDiscounts()
  const { data: discountDetail, isLoading: isDiscountLoading, isError: isDiscountError } = useStudentDiscount(studentGuid, !!selectedApplicationGuid && !!studentGuid)
  const assignDiscount = useAssignStudentDiscount()
  const updateDiscount = useUpdateStudentDiscount()
  const cancelDiscount = useCancelStudentDiscount()
  // Corporate is a dropdown sourced from Finance's own Cooperates catalogue
  // (/finance/cooperates) rather than free text — the value stored/sent as
  // `cop` is the cooperate's GUID (confirmed 2026-09-02 — a cooperate NAME
  // sent as `cop` 400'd on assign; the field wants cooperateGuid).
  const { data: cooperates = [] } = useCooperates()

  const [editing, setEditing] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const [discountChoice, setDiscountChoice] = useState('')
  const [calcType, setCalcType] = useState<'Amount' | 'Percentage'>('Percentage')
  const [amtPer, setAmtPer] = useState('')
  const [corporate, setCorporate] = useState('')
  const [remarks, setRemarks] = useState('')

  function resetForm() {
    setDiscountChoice('')
    setCalcType('Percentage')
    setAmtPer('')
    setCorporate('')
    setRemarks('')
    setEditing(false)
    setShowCancelConfirm(false)
  }

  // Seeds the form from the just-loaded assignment the moment it's editable
  // — same trigger-on-open pattern Student Profile's own modal uses, just
  // fired by the Edit Discount button here instead of a modal open.
  function startEdit() {
    if (!discountDetail) return
    setCalcType(discountDetail.calcType === CALC_TYPE_VALUES.Amount ? 'Amount' : 'Percentage')
    setAmtPer(discountDetail.amtPer != null ? String(discountDetail.amtPer) : '')
    setCorporate(discountDetail.cop ?? '')
    setRemarks(discountDetail.remarks ?? '')
    setEditing(true)
  }

  function selectStudent(applicationGuid: string, name: string, studentGuidHint: string | null) {
    setSelectedApplicationGuid(applicationGuid)
    setSelectedStudentGuidHint(studentGuidHint)
    setSearch(name)
    setCommittedSearch('')
    setSearchFocused(false)
    resetForm()
    showToast(`Loaded: ${name}`, 'success')
  }

  function handleClear() {
    setSelectedApplicationGuid(null)
    setSelectedStudentGuidHint(null)
    setSearch('')
    setCommittedSearch('')
    resetForm()
    showToast('Form cleared.', 'warn')
  }

  function handleAssign() {
    if (!profile || !selectedApplicationGuid) { showToast('Please select a student first.', 'warn'); return }
    if (!studentGuid) { showToast("This applicant hasn't been registered as a student yet — discounts can only be assigned to enrolled students.", 'warn'); return }
    if (!discountChoice) { showToast('Please select a discount.', 'warn'); return }
    const amt = amtPer.trim() ? Number(amtPer) : null
    // Mirrors AssignStudentDiscountCommandValidator (post-assign-student-
    // discount.md): amtPer must be > 0 when supplied, and ≤ 100 when
    // calcType is Percentage — catching both client-side avoids a round
    // trip for a 400 validation_error the server would reject anyway.
    if (amt != null && isNaN(amt)) { showToast('Amount/Percentage must be a number.', 'warn'); return }
    if (amt != null && amt <= 0) { showToast('Amount/Percentage must be greater than 0.', 'warn'); return }
    if (amt != null && calcType === 'Percentage' && amt > 100) { showToast('Percentage cannot be more than 100.', 'warn'); return }

    assignDiscount.mutate(
      {
        studentGuid,
        payload: {
          discountGuid: discountChoice,
          calcType: CALC_TYPE_VALUES[calcType],
          amtPer: amt,
          // Only sent when the chosen discount actually wants one — see
          // discountWantsCorporate's own comment. Sending a cop value for a
          // discount that isn't flagged this way 400'd (confirmed live).
          cop: showCorporateForChoice ? (corporate.trim() || null) : null,
          // No program-scoped semester picker to build a dropdown from (see
          // AssignStudentDiscountRequest's own comment) — defaults to the
          // student's current semester off the already-loaded profile.
          effectiveFromSemesterGuid: profile.semesterGuid,
          remarks: remarks.trim() || null,
        },
      },
      {
        onSuccess: () => showToast('Discount assigned.', 'success'),
        onError: (error: Error) => showToast(error.message || 'Could not assign discount.', 'error'),
      },
    )
  }

  function handleSaveEdit() {
    if (!studentGuid) return
    const amt = amtPer.trim() ? Number(amtPer) : null
    // Same UpdateStudentDiscountCommandValidator rules as assign — see the
    // comment in handleAssign above.
    if (amt != null && isNaN(amt)) { showToast('Amount/Percentage must be a number.', 'warn'); return }
    if (amt != null && amt <= 0) { showToast('Amount/Percentage must be greater than 0.', 'warn'); return }
    if (amt != null && calcType === 'Percentage' && amt > 100) { showToast('Percentage cannot be more than 100.', 'warn'); return }

    updateDiscount.mutate(
      { studentGuid, payload: { calcType: CALC_TYPE_VALUES[calcType], amtPer: amt, cop: showCorporateForAssigned ? (corporate.trim() || null) : null, remarks: remarks.trim() || null } },
      {
        onSuccess: () => { showToast('Discount updated.', 'success'); setEditing(false) },
        onError: (error: Error) => showToast(error.message || 'Could not update discount.', 'error'),
      },
    )
  }

  function handleCancelDiscount(includeCurrentSemester: boolean) {
    if (!studentGuid) return
    cancelDiscount.mutate(
      { studentGuid, includeCurrentSemester },
      {
        onSuccess: () => {
          showToast(includeCurrentSemester ? 'Discount cancelled immediately.' : 'Discount will be cancelled from next semester.', 'success')
          // Clears discountChoice/calcType/amtPer/corporate/remarks too —
          // without this, the Apply Discount form that reappears once
          // canAssignNew flips back to true would still be carrying
          // whatever the cancelled discount's own terms were (from an
          // earlier startEdit(), or a previous assign that was never
          // cleared), pre-filling a "new" assignment with the old one's
          // values instead of a blank form.
          resetForm()
        },
        onError: (error: Error) => showToast(error.message || 'Could not cancel this discount.', 'error'),
      },
    )
  }

  const chosenDiscount = discountCatalogue.find(d => d.discountGuid === discountChoice)
  // See isCancelledStatus's own comment — a cancelled assignment still
  // means "free to assign a new one", same as no assignment at all.
  const canAssignNew = !discountDetail || isCancelledStatus(discountDetail.discountStatus)
  const busy = assignDiscount.isPending || updateDiscount.isPending || cancelDiscount.isPending

  // The Corporate field only applies to discounts flagged as corporate/
  // agent discounts on the Finance discount record itself — Discount.cop
  // (finance/discount.ts) is that flag, "1" meaning yes (confirmed
  // 2026-09-02: sending a `cop` value on the assign/update payload for a
  // discount NOT flagged this way 400'd; the field is only accepted at all
  // when the underlying discount calls for it). Not the same `cop` as the
  // one on the *assignment* (StudentDiscountDto.cop / this form's own
  // `corporate` state) — that one holds the chosen cooperateGuid, this one
  // is just a yes/no switch on the discount definition.
  const discountWantsCorporate = (d: { cop: string | null } | undefined) => String(d?.cop ?? '') === '1'
  const showCorporateForChoice = discountWantsCorporate(chosenDiscount)
  const assignedDiscount = discountDetail ? discountCatalogue.find(d => d.discountGuid === discountDetail.discountGuid) : undefined
  const showCorporateForAssigned = discountWantsCorporate(assignedDiscount)

  return (
    <>
      <div className="page active" id="page-discount-allocation">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Discount Allocation</div>
            <div className="pg-sub">Search student → review current discount → assign, edit, or cancel an allocation</div>
          </div>
          <button className="btn btn-neu" onClick={() => router.push('/finance/dashboard')}><i className="lni lni-arrow-left"></i> Back</button>
        </div>

        {/* Student Search — same bar/dropdown as Payment Console. */}
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
                {isSearching && matches.length === 0 && <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>Searching…</div>}
                {!isSearching && isSearchError && matches.length === 0 && (
                  <div className="text-clr-red px-3 py-2" style={{ fontSize: 12.5 }}>
                    <i className="lni lni-warning"></i> {searchError instanceof Error ? searchError.message : 'Search failed. Please try again.'}
                  </div>
                )}
                {!isSearching && !isSearchError && matches.length === 0 && (
                  <div className="text-g400 px-3 py-2" style={{ fontSize: 12.5 }}>
                    {committedSearch ? 'No matching applications found.' : 'No applications found.'}
                  </div>
                )}
                {matches.map(a => (
                  <div
                    key={a.applicationGuid}
                    className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                    onClick={() => selectStudent(a.applicationGuid, searchResultName(a), a.studentGuid)}
                  >
                    <div className="font-bold">{searchResultName(a)}</div>
                    <div className="text-g500" style={{ fontSize: 11 }}>{a.appRefNo} · {a.phone ?? '—'} · {a.emailId ?? '—'}</div>
                  </div>
                ))}
                {isFetchingNextPage && (
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

        {selectedApplicationGuid && profile && (
          <div className="pc-body">
            {/* LEFT: profile hero, same treatment as Payment Console's own. */}
            <div className="flex flex-col gap-5 min-w-0">
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
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={batchCode ?? '—'}>{batchCode ?? '—'}</span></div>
                    <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Year</span><span className="pc-hero-fact-val" title={profile.yearCode ?? '—'}>{profile.yearCode ?? '—'}</span></div>
                  </div>
                </div>
                <div className="text-g500 flex items-center gap-1.5 px-5 py-4" style={{ fontSize: 11.5 }}>
                  <i className="lni lni-envelope text-b500"></i> <span className="truncate">{profile.emailId ?? profile.universityEmail ?? '—'}</span>
                </div>
              </div>

              {!studentGuid && (
                <div className="card">
                  <div className="text-center" style={{ padding: 16 }}>
                    <div className="pc-receipt-check" style={{ background: 'var(--amber-bg)', borderColor: 'var(--amber-bd)', color: 'var(--amber)', fontSize: 22 }}>
                      <i className="lni lni-warning"></i>
                    </div>
                    <div className="font-bold text-g700" style={{ fontSize: 13.5 }}>Not Yet Enrolled</div>
                    <div className="text-g400 mt-1" style={{ fontSize: 12.5 }}>This applicant hasn&apos;t been registered as a student yet — discounts can only be assigned to enrolled students.</div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: the discount form / current-assignment summary. */}
            <div className="flex flex-col gap-5 min-w-0">
              <div className="card">
                <div className="card-hdr">
                  <div className="card-title"><span className="ctitle-icon"><i className="lni lni-tag"></i></span> {canAssignNew ? 'Apply Discount' : 'Discount Allocation'}</div>
                  {discountDetail && !canAssignNew && <span className={`badge ${statusBadgeClass(discountDetail.discountStatus)}`}>{statusLabel(discountDetail.discountStatus)}</span>}
                </div>

                {!studentGuid ? null : isDiscountLoading ? (
                  <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Checking discount allocation…</div>
                ) : isDiscountError ? (
                  <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}>
                    <i className="lni lni-warning"></i> Couldn&apos;t load this student&apos;s discount allocation.
                  </div>
                ) : canAssignNew ? (
                  // ── Nothing currently in force — either no assignment at
                  // all, or the last one was cancelled — so this is the
                  // Apply Discount form either way. ──
                  <>
                    {/* "Previous discount" context card — commented out per
                        request (2026-09-02), not removed; uncomment to
                        bring it back if it's wanted later. */}
                    {/* {discountDetail && (
                      <div className="pc-ledger-item" style={{ marginBottom: 16, background: 'var(--g50)' }}>
                        <span className="pc-ledger-icon" style={{ background: 'var(--g200)', color: 'var(--g500)' }}><i className="lni lni-close"></i></span>
                        <div className="flex-1 min-w-0">
                          <div className="pc-ledger-name truncate">Previous: {discountDetail.discountName}</div>
                          <div className="pc-ledger-sub">{discountDetail.remarks ?? 'No remarks'}</div>
                        </div>
                        <span className={`badge ${statusBadgeClass(discountDetail.discountStatus)}`}>{statusLabel(discountDetail.discountStatus)}</span>
                      </div>
                    )} */}
                    {discountChoice && (
                      <div className="pc-pay-summary">
                        <div>
                          <div className="pc-pay-lbl">Discount</div>
                          <div className="pc-pay-amt" style={{ fontSize: 18 }}>{chosenDiscount ? `${chosenDiscount.discountCode} — ${chosenDiscount.discountName}` : '—'}</div>
                        </div>
                        <div className="pc-pay-meta">
                          <div><span>Type</span><b>{calcType}</b></div>
                          <div><span>{calcType === 'Percentage' ? 'Percentage' : 'Amount'}</span><b>{amtPer || '—'}</b></div>
                        </div>
                      </div>
                    )}

                    <div className="fg mb-[14px]">
                      <div className="lbl">Discount <span className="req">*</span></div>
                      <SearchSelect
                        placeholder="— Select Discount —"
                        options={discountCatalogue.map(d => ({ value: d.discountGuid, label: `${d.discountCode} — ${d.discountName}` }))}
                        value={discountChoice}
                        onChange={v => { setDiscountChoice(v); setCorporate('') }}
                      />
                    </div>
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Calculation Type</div>
                        <SearchSelect options={['Amount', 'Percentage']} value={calcType} onChange={v => setCalcType(v as 'Amount' | 'Percentage')} />
                      </div>
                      <div className="fg">
                        <div className="lbl">{calcType === 'Percentage' ? 'Percentage (%)' : 'Amount'}</div>
                        <input className="ctrl" type="number" min={0} placeholder="Leave blank to inherit from the discount" value={amtPer} onChange={e => setAmtPer(e.target.value)} />
                      </div>
                    </div>
                    {/* Only shown for discounts flagged cop === "1" — see
                        discountWantsCorporate's own comment above. */}
                    {showCorporateForChoice && (
                      <div className="fg mb-[14px]">
                        <div className="lbl">Corporate <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
                        <SearchSelect
                          placeholder="— Select Corporate —"
                          options={cooperates.map(c => ({ value: c.cooperateGuid, label: `${c.cooperateCode} — ${c.cooperateName}` }))}
                          value={corporate}
                          onChange={setCorporate}
                        />
                      </div>
                    )}
                    <div className="fg mb-4">
                      <div className="lbl">Remarks</div>
                      <textarea className="ctrl" rows={2} maxLength={500} placeholder="Optional notes" value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>

                    <div className="flex gap-[10px] justify-end">
                      <button className="btn btn-primary btn-lg" disabled={assignDiscount.isPending} onClick={handleAssign}>
                        <i className="lni lni-checkmark"></i> {assignDiscount.isPending ? 'Assigning…' : 'Assign Discount'}
                      </button>
                    </div>
                  </>
                ) : !editing ? (
                  // ── An assignment exists: read-only summary + actions. ──
                  <>
                    <div className="pc-ledger-item">
                      <span className="pc-ledger-icon"><i className="lni lni-tag"></i></span>
                      <div className="flex-1 min-w-0">
                        <div className="pc-ledger-name truncate">{discountDetail.discountName}</div>
                        <div className="pc-ledger-sub">
                          {CALC_TYPE_LABELS[discountDetail.calcType ?? 2] ?? 'Percentage'}
                          {discountDetail.amtPer != null ? ` · ${discountDetail.amtPer}${discountDetail.calcType === CALC_TYPE_VALUES.Amount ? '' : '%'}` : ' · inherited from discount'}
                        </div>
                      </div>
                    </div>
                    {showCorporateForAssigned && (
                      <div className="receipt-row"><span className="text-muted">Corporate</span><span>{discountDetail.cop ? (cooperates.find(c => c.cooperateGuid === discountDetail.cop)?.cooperateName ?? discountDetail.cop) : '—'}</span></div>
                    )}
                    <div className="receipt-row"><span className="text-muted">Remarks</span><span>{discountDetail.remarks ?? '—'}</span></div>

                    <div className="info-box mt-3">
                      <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
                      <div style={{ fontSize: 12 }}>The discount and its effective-from semester can&apos;t be changed here — cancel this assignment and assign again to change either.</div>
                    </div>

                    <div className="flex gap-[10px] justify-end mt-4">
                      <button className="btn btn-neu" disabled={busy} onClick={() => setShowCancelConfirm(true)}><i className="lni lni-close"></i> Cancel Discount</button>
                      <button className="btn btn-primary" disabled={busy} onClick={startEdit}><i className="lni lni-pencil"></i> Edit Discount</button>
                    </div>
                  </>
                ) : (
                  // ── Editing the existing assignment's terms. ──
                  <>
                    <div className="fg mb-[14px]">
                      <div className="lbl">Discount</div>
                      <SearchSelect
                        disabled
                        options={[{ value: discountDetail.discountGuid, label: discountDetail.discountName }]}
                        value={discountDetail.discountGuid}
                      />
                    </div>
                    <div className="g2 mb-[14px]">
                      <div className="fg">
                        <div className="lbl">Calculation Type</div>
                        <SearchSelect options={['Amount', 'Percentage']} value={calcType} onChange={v => setCalcType(v as 'Amount' | 'Percentage')} />
                      </div>
                      <div className="fg">
                        <div className="lbl">{calcType === 'Percentage' ? 'Percentage (%)' : 'Amount'}</div>
                        <input className="ctrl" type="number" min={0} placeholder="Leave blank to inherit from the discount" value={amtPer} onChange={e => setAmtPer(e.target.value)} />
                      </div>
                    </div>
                    {showCorporateForAssigned && (
                      <div className="fg mb-[14px]">
                        <div className="lbl">Corporate <span className="text-g400" style={{ fontWeight: 500 }}>(optional)</span></div>
                        <SearchSelect
                          placeholder="— Select Corporate —"
                          options={cooperates.map(c => ({ value: c.cooperateGuid, label: `${c.cooperateCode} — ${c.cooperateName}` }))}
                          value={corporate}
                          onChange={setCorporate}
                        />
                      </div>
                    )}
                    <div className="fg mb-4">
                      <div className="lbl">Remarks</div>
                      <textarea className="ctrl" rows={2} maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                    <div className="info-box mb-4">
                      <i className="lni lni-information" style={{ color: 'var(--b700)', fontSize: 15, flexShrink: 0 }}></i>
                      <div style={{ fontSize: 12 }}>The discount and its effective-from semester can&apos;t be changed here — cancel this assignment and assign again to change either.</div>
                    </div>
                    <div className="flex gap-[10px] justify-end">
                      <button className="btn btn-neu" disabled={updateDiscount.isPending} onClick={() => setEditing(false)}>Discard</button>
                      <button className="btn btn-primary" disabled={updateDiscount.isPending} onClick={handleSaveEdit}>
                        <i className="lni lni-checkmark"></i> {updateDiscount.isPending ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Cancel Discount — matches the sketch's own popup: two
          explicit choices, no default "yes", since cancelling immediately
          vs. from next semester has real financial consequences either
          way. */}
      {showCancelConfirm && discountDetail && (
        <div className="modal-overlay open" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue">
              <div className="modal-title"><i className="lni lni-warning"></i> Cancel Discount</div>
              <button className="modal-close" onClick={() => setShowCancelConfirm(false)}>✕</button>
            </div>

            <div className="pc-ledger-item" style={{ marginBottom: 14 }}>
              <span className="pc-ledger-icon"><i className="lni lni-tag"></i></span>
              <div className="flex-1 min-w-0">
                <div className="pc-ledger-name truncate">{discountDetail.discountName}</div>
                <div className="pc-ledger-sub">
                  {CALC_TYPE_LABELS[discountDetail.calcType ?? 2] ?? 'Percentage'}
                  {discountDetail.amtPer != null ? ` · ${discountDetail.amtPer}${discountDetail.calcType === CALC_TYPE_VALUES.Amount ? '' : '%'}` : ' · inherited from discount'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: 'var(--g500)', marginBottom: 4 }}>
              This will cancel the student&apos;s current discount allocation. Choose when it should take effect.
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-neu" disabled={cancelDiscount.isPending} onClick={() => handleCancelDiscount(false)}>Cancel from Next Semester</button>
              <button className="btn btn-danger" disabled={cancelDiscount.isPending} onClick={() => handleCancelDiscount(true)}>Cancel Immediately</button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </>
  )
}
