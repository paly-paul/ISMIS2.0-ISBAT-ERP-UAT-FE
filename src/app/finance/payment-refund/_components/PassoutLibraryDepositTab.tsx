'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import DatePicker from '@/components/DatePicker'
import { SearchSelect } from '@/components/SearchSelect'
import { usePassoutLibraryDepositSearch, usePassoutLibraryDepositByStudent } from '@/hooks/academic/useRefundSearch'
import { PassoutLedgerLineDto, PassoutLibraryDepositRefundCandidateDto } from '@/lib/api/academic/refundSearch'
import {
  useBulkRefundPassoutLibraryDeposit,
  useCreateRefund,
  BulkRefundLineInput,
  BulkRefundLineResultDto,
} from '@/hooks/finance/usePaymentRefund'
import { useSearchCampusesInfinite } from '@/hooks/config/useCampuses'
import { useSearchProgramMastersInfinite, useSearchProgramMastersByCampusInfinite } from '@/hooks/academic/useProgramMaster'
import { useBatches } from '@/hooks/academic/useBatches'
import { useSearchIntakesInfinite } from '@/hooks/academic/useIntakes'
import { flattenUniquePages } from '@/lib/pagination'
import { AuthError } from '@/lib/api/client'
import { fmtAmt, initialsFor, todayYmd } from './shared'
import { mockBulkRefund, mockCreateRefund, mockGetPassoutStudentByGuid, mockSearchPassout } from './mockData'

// Category 2 — students with RegStatus = Passout, refunding a Library
// Deposit paid through either/both of two genuinely different backend
// sources (2026-09-23 frontend integration guide, fixing the earlier
// "Ledger not found." bug):
// - mainLedgerLines (T_PAYMENT_LEDGER) — refund with `ledgerGuid`
// - otherLedgerLines (T_PAYMENT_OTHER_LEDGER) — refund with `ledgerOthersGuid`
// These are NEVER merged into one array or one combined refund action — see
// PassoutLibraryDepositRefundCandidateDto's own comment for why flattening
// them caused every refund to fail. Each selectable row here carries a
// `source` tag so submit can populate the correct request field per line.
//
// Two entry modes toggled by staff (2026-09-23, per request):
// - Bulk: filter + table + multi-select across possibly several students,
//   submitted in one POST /refund/passout-library-deposit/bulk call.
// - Single: search-and-select exactly one student — same typeahead +
//   pc-hero card pattern Rejected-by-Registrar (Category 1) uses — backed by
//   the dedicated single-student detail endpoint, then refunded one line at
//   a time through the generic POST /refund/applications/{applicationGuid}
//   (there is no single-student bulk endpoint for this category; the guide
//   is explicit that this flow reuses the same endpoint every other tab
//   uses).
// "Select all" in bulk mode only checks what's currently on screen — it is
// a frontend-only affordance, not a server-side filter re-derive.

const PAGE_SIZE = 20

type LedgerSource = 'main' | 'other'

interface SelectableLine {
  key: string
  studentGuid: string
  applicationGuid: string | null
  studentName: string
  studentRegNo: string
  source: LedgerSource
  ledgerGuid: string
  ledgerName: string
  currencyGuid: string
  currencyCode: string
  amount: number
}

function lineKey(studentGuid: string, source: LedgerSource, ledgerGuid: string) {
  return `${studentGuid}::${source}::${ledgerGuid}`
}

// Sorts a filter dropdown's fetched options so the currently-selected value
// always sorts first, regardless of where it'd otherwise land in the
// server's own order — a re-opened dropdown should show what's already
// picked right at the top, not buried wherever the page/search happened to
// place it. Falls back to `selectedLabel` (this page's own "label for a
// value not in the current fetched page" cache) when the selected value
// hasn't loaded into `list` yet.
function pinSelected<T extends { value: string; label: string }>(list: T[], selectedValue: string, selectedLabel: string): T[] {
  if (!selectedValue) return list
  const selected = list.find(o => o.value === selectedValue) ?? (selectedLabel ? ({ value: selectedValue, label: selectedLabel } as T) : null)
  if (!selected) return list
  return [selected, ...list.filter(o => o.value !== selectedValue)]
}

function linesFor(s: PassoutLibraryDepositRefundCandidateDto): SelectableLine[] {
  const toRow = (source: LedgerSource) => (l: PassoutLedgerLineDto): SelectableLine => ({
    key: lineKey(s.studentGuid, source, l.ledgerGuid),
    studentGuid: s.studentGuid,
    applicationGuid: s.applicationGuid,
    studentName: s.studentName,
    studentRegNo: s.studentRegNo,
    source,
    ledgerGuid: l.ledgerGuid,
    ledgerName: l.ledgerName,
    currencyGuid: l.currencyGuid,
    currencyCode: l.currencyCode,
    amount: l.amount,
  })
  // Defensive ?? [] — guards a live response not yet carrying these two
  // fields (or carrying them as null), same "don't trust an array is always
  // present" caution used throughout this codebase.
  return [...(s.mainLedgerLines ?? []).map(toRow('main')), ...(s.otherLedgerLines ?? []).map(toRow('other'))]
}

interface PassoutLibraryDepositTabProps {
  showToast: (msg: string, type?: string) => void
  permissionsCreate: boolean
  useMock?: boolean
}

export function PassoutLibraryDepositTab({ showToast, permissionsCreate, useMock = false }: PassoutLibraryDepositTabProps) {
  const [mode, setMode] = useState<'bulk' | 'single'>('single')

  function switchMode(next: 'bulk' | 'single') {
    if (next === mode) return
    setMode(next)
    setSelectedKeys(new Set())
    setResults(null)
  }

  // ── Single-student mode — same live-typing typeahead (opens on focus,
  // narrows as you type, closes on pick) as Rejected-by-Registrar's own
  // Student Search. Selecting a typeahead hit only captures its guid; the
  // actual detail (ledger lines, applicationGuid) is fetched fresh from the
  // dedicated single-student endpoint below, not reused off the possibly-
  // stale search row. ────────────────────────────────────────────────────
  const [singleSearch, setSingleSearch] = useState('')
  const [singleCommittedSearch, setSingleCommittedSearch] = useState('')
  const [singleSearchFocused, setSingleSearchFocused] = useState(false)
  const singleSearchBoxRef = useRef<HTMLDivElement>(null)
  const [selectedStudentGuid, setSelectedStudentGuid] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSingleCommittedSearch(singleSearch.trim()), 400)
    return () => clearTimeout(t)
  }, [singleSearch])

  useEffect(() => {
    if (!singleSearchFocused) return
    function handle(e: MouseEvent) {
      if (!singleSearchBoxRef.current?.contains(e.target as Node)) setSingleSearchFocused(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [singleSearchFocused])

  const singleSearchTermLen = singleCommittedSearch.length
  const singleSearchEnabled = mode === 'single' && singleSearchFocused && (singleSearchTermLen === 0 || singleSearchTermLen >= 2)
  const { data: singleData, isLoading: isSingleSearchLoadingReal, isError: isSingleSearchError } = usePassoutLibraryDepositSearch(
    { search: singleCommittedSearch, page: 1, pageSize: 20 },
    !useMock && singleSearchEnabled,
  )
  const singleMockItems = useMock ? mockSearchPassout({ search: singleCommittedSearch, intakeGuid: '', programGuid: '', batchGuid: '', campusGuid: '' }) : []
  const singleMatches = useMock ? singleMockItems : (singleData?.items ?? [])
  const isSingleSearching = useMock ? false : isSingleSearchLoadingReal

  const { data: selectedStudentReal, isLoading: isSelectedLoadingReal, isError: isSelectedError } = usePassoutLibraryDepositByStudent(
    selectedStudentGuid, !useMock && mode === 'single',
  )
  const selectedStudent = useMock
    ? (selectedStudentGuid ? mockGetPassoutStudentByGuid(selectedStudentGuid) : null)
    : (selectedStudentReal ?? null)
  const isSelectedLoading = useMock ? false : isSelectedLoadingReal

  function selectStudent(s: PassoutLibraryDepositRefundCandidateDto) {
    setSelectedStudentGuid(s.studentGuid)
    setSingleSearch(s.studentName)
    setSingleCommittedSearch('')
    setSingleSearchFocused(false)
    setSelectedKeys(new Set())
    setResults(null)
  }

  function clearSingleSelection() {
    setSelectedStudentGuid(null)
    setSingleSearch('')
    setSingleCommittedSearch('')
    setSelectedKeys(new Set())
    setResults(null)
  }

  const [intakeGuid, setIntakeGuid] = useState('')
  const [programGuid, setProgramGuid] = useState('')
  const [batchGuid, setBatchGuid] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [batchSearch, setBatchSearch] = useState('')
  const [intakeSearch, setIntakeSearch] = useState('')
  const [programSearch, setProgramSearch] = useState('')
  const [campusSearch, setCampusSearch] = useState('')
  const [intakePickerOpen, setIntakePickerOpen] = useState(false)
  const [programPickerOpen, setProgramPickerOpen] = useState(false)
  const [campusPickerOpen, setCampusPickerOpen] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState({ intake: '', program: '', batch: '', campus: '' })
  const [page, setPage] = useState(1)

  const intakeQuery = useSearchIntakesInfinite(intakeSearch, 20, intakePickerOpen)
  const campusQuery = useSearchCampusesInfinite(campusSearch, 20, campusPickerOpen)
  // Programme is scoped to whichever Campus is currently picked — same
  // cascading-dropdown convention Application Payment uses (see
  // useProgramMastersByCampus's own comment). Falls back to the unscoped
  // search when no campus is picked yet, so staff aren't blocked from
  // filtering by Programme first if they want to.
  const programByCampusQuery = useSearchProgramMastersByCampusInfinite(campusGuid, programSearch, 20, programPickerOpen && !!campusGuid)
  const programAllQuery = useSearchProgramMastersInfinite(programSearch, 20, programPickerOpen && !campusGuid)
  const intakes = useMemo(() => flattenUniquePages(intakeQuery.data?.pages ?? [], i => i.intakeGuid), [intakeQuery.data])
  const programsByCampus = useMemo(() => flattenUniquePages(programByCampusQuery.data?.pages ?? [], p => p.programGuid), [programByCampusQuery.data])
  const programsAll = useMemo(() => flattenUniquePages(programAllQuery.data?.pages ?? [], p => p.programGuid), [programAllQuery.data])
  const programs = campusGuid ? programsByCampus : programsAll
  // Whichever of the two program queries is actually active right now —
  // only its own isLoading/hasNextPage/fetchNextPage should drive the
  // dropdown's own loading/scroll state.
  const programQuery = campusGuid ? programByCampusQuery : programAllQuery
  const campuses = useMemo(() => flattenUniquePages(campusQuery.data?.pages ?? [], c => c.campusGuid), [campusQuery.data])
  const { data: batchesData } = useBatches(1, 20, batchSearch, true)
  // Batch is scoped to whichever Programme is currently picked — filtered
  // client-side (Batch has no server-side by-program search endpoint in
  // this app), same pattern Filing/Payment's own programGuid+semesterGuid+
  // batchTimeGuid batch lookups already use.
  const batches = useMemo(() => {
    const items = batchesData?.items ?? []
    return programGuid ? items.filter(b => b.programGuid === programGuid) : items
  }, [batchesData, programGuid])

  const { data, isLoading: isLoadingReal, isError } = usePassoutLibraryDepositSearch(
    { page, pageSize: PAGE_SIZE, intakeGuid: intakeGuid || undefined, programGuid: programGuid || undefined, batchGuid: batchGuid || undefined, campusGuid: campusGuid || undefined },
    !useMock && mode === 'bulk',
  )
  const mockItems = useMock && mode === 'bulk' ? mockSearchPassout({ search: '', intakeGuid, programGuid, batchGuid, campusGuid }) : []
  const bulkItems = useMock ? mockItems : (data?.items ?? [])
  const totalCount = useMock ? mockItems.length : (data?.totalCount ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const isLoading = useMock ? false : isLoadingReal

  // Single mode's "items" is just the one fetched student (or none yet) —
  // everything downstream (rows/selection/submit) stays identical either
  // way, it just ends up scoped to one student's line(s).
  const items = mode === 'single' ? (selectedStudent ? [selectedStudent] : []) : bulkItems

  // Flatten each student's two ledger-source arrays into one selectable row
  // per (student, source, ledger) triple — kept flat for a simple checkbox
  // table, but `source` on each row is what submit uses to populate the
  // correct request field; the two sources are never summed or merged.
  const rows: SelectableLine[] = useMemo(() => items.flatMap(linesFor), [items])

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  // A row with no linked application can't be refunded on either ledger
  // (the refund endpoint requires applicationGuid even for otherLedgerLines)
  // — excluded from selection entirely, not just visually disabled.
  const selectableRows = useMemo(() => rows.filter(r => !!r.applicationGuid), [rows])
  const selectedRows = selectableRows.filter(r => selectedKeys.has(r.key))
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every(r => selectedKeys.has(r.key))

  function toggleRow(row: SelectableLine) {
    if (!row.applicationGuid) return
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(row.key)) next.delete(row.key)
      else next.add(row.key)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) selectableRows.forEach(r => next.delete(r.key))
      else selectableRows.forEach(r => next.add(r.key))
      return next
    })
  }

  function updateFilters(fn: () => void) {
    fn()
    setPage(1)
    setSelectedKeys(new Set())
  }

  const intakeOptions = pinSelected(intakes.map(i => ({ value: i.intakeGuid, label: `${i.month} ${i.financialYear}` })), intakeGuid, selectedLabels.intake)
  const programOptions = pinSelected(programs.map(p => ({ value: p.programGuid, label: p.programName })), programGuid, selectedLabels.program)
  const batchOptions = pinSelected(batches.map(b => ({ value: b.batchGuid, label: b.batchCode })), batchGuid, selectedLabels.batch)
  const campusOptions = pinSelected(campuses.map(c => ({ value: c.campusGuid, label: c.campusName })), campusGuid, selectedLabels.campus)

  // Bumped after a mock submit to force a re-render — the mock helpers
  // mutate MOCK_PASSOUT_STUDENTS' embedded ledger arrays in place, which
  // React has no other way to notice.
  const [, forceMockRefresh] = useState(0)

  const [refundDate, setRefundDate] = useState(todayYmd)
  const [remarks, setRemarks] = useState('')
  const [results, setResults] = useState<BulkRefundLineResultDto[] | null>(null)
  const [isSingleSubmitting, setIsSingleSubmitting] = useState(false)

  const bulkRefund = useBulkRefundPassoutLibraryDeposit()
  const createRefund = useCreateRefund()

  function onSubmitDone(res: BulkRefundLineResultDto[]) {
    setResults(res)
    const failCount = res.filter(r => !r.success).length
    if (failCount === 0) showToast(`Refunded ${res.length} line(s) successfully.`, 'success')
    else showToast(`${res.length - failCount} of ${res.length} line(s) refunded — ${failCount} failed. See results below.`, 'warn')
    setSelectedKeys(new Set())
    setRemarks('')
  }

  function handleBulkSubmit() {
    if (!permissionsCreate) { showToast('You do not have permission to create refunds.', 'warn'); return }
    if (selectedRows.length === 0) { showToast('Select at least one line to refund.', 'warn'); return }
    if (!refundDate) { showToast('Please select a refund date.', 'warn'); return }

    const lines: BulkRefundLineInput[] = selectedRows.map(r => ({
      applicationGuid: r.applicationGuid as string,
      studentGuid: r.studentGuid,
      ledgerGuid: r.source === 'main' ? r.ledgerGuid : null,
      ledgerOthersGuid: r.source === 'other' ? r.ledgerGuid : null,
      currencyGuid: r.currencyGuid,
      amount: r.amount,
      refundDate,
      remarks: remarks.trim() || null,
    }))

    if (useMock) {
      mockBulkRefund(lines).then(res => { forceMockRefresh(n => n + 1); onSubmitDone(res) })
      return
    }

    bulkRefund.mutate(lines, {
      onSuccess: onSubmitDone,
      onError: () => showToast('Bulk refund request failed. Please try again.', 'error'),
    })
  }

  // Single mode has no dedicated bulk endpoint for this category — refunds
  // each selected line individually through the same generic
  // POST /refund/applications/{applicationGuid} every other tab uses, then
  // aggregates the outcomes into the same result shape the bulk endpoint
  // returns so the results card below can stay identical either way.
  function handleSingleSubmit() {
    if (!permissionsCreate) { showToast('You do not have permission to create refunds.', 'warn'); return }
    if (selectedRows.length === 0) { showToast('Select at least one line to refund.', 'warn'); return }
    if (!refundDate) { showToast('Please select a refund date.', 'warn'); return }

    const submissions = selectedRows.map(r => ({
      applicationGuid: r.applicationGuid as string,
      row: r,
      input: {
        ledgerGuid: r.source === 'main' ? r.ledgerGuid : null,
        ledgerOthersGuid: r.source === 'other' ? r.ledgerGuid : null,
        currencyGuid: r.currencyGuid,
        amount: r.amount,
        refundDate,
        studentGuid: r.studentGuid,
        remarks: remarks.trim() || null,
      },
    }))

    setIsSingleSubmitting(true)

    if (useMock) {
      Promise.all(submissions.map(s => mockCreateRefund(s.applicationGuid, s.input))).then(resArr => {
        forceMockRefresh(n => n + 1)
        setIsSingleSubmitting(false)
        onSubmitDone(resArr.map((r, i) => ({
          applicationGuid: submissions[i].applicationGuid,
          ledgerGuid: submissions[i].input.ledgerGuid,
          ledgerOthersGuid: submissions[i].input.ledgerOthersGuid,
          success: true, refundGuid: r.refundGuid, error: null,
        })))
      })
      return
    }

    Promise.allSettled(submissions.map(s => createRefund.mutateAsync({ applicationGuid: s.applicationGuid, input: s.input }))).then(settled => {
      setIsSingleSubmitting(false)
      const res: BulkRefundLineResultDto[] = settled.map((outcome, i) => {
        const s = submissions[i]
        if (outcome.status === 'fulfilled') {
          return {
            applicationGuid: s.applicationGuid, ledgerGuid: s.input.ledgerGuid, ledgerOthersGuid: s.input.ledgerOthersGuid,
            success: true, refundGuid: outcome.value.refundGuid, error: null,
          }
        }
        const err = outcome.reason
        return {
          applicationGuid: s.applicationGuid, ledgerGuid: s.input.ledgerGuid, ledgerOthersGuid: s.input.ledgerOthersGuid,
          success: false, refundGuid: null,
          error: err instanceof AuthError ? err.message : (err?.message || 'Failed to refund.'),
        }
      })
      onSubmitDone(res)
    })
  }

  const isSubmitPending = mode === 'bulk' ? bulkRefund.isPending : isSingleSubmitting

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        {/* Same role="switch" pill toggle Payment Refund's own page header
            uses for its Mock Data/Live API flip — an on/off flip reads more
            correctly here than the .pc-tabs pill switcher (that's for
            picking one of several sibling tabs; this is a two-state mode
            within one tab). */}
        <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 12.5, color: 'var(--g600)' }}>
          <span className={mode === 'single' ? 'font-bold text-g700' : undefined}><i className="lni lni-user"></i> Single Student</span>
          <span
            role="switch"
            aria-checked={mode === 'bulk'}
            aria-label="Toggle between Single Student and Bulk mode"
            onClick={() => switchMode(mode === 'single' ? 'bulk' : 'single')}
            style={{
              position: 'relative', width: 36, height: 20, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
              background: mode === 'bulk' ? 'var(--b500)' : 'var(--g300)', transition: 'background .15s',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: mode === 'bulk' ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
              background: 'var(--white)', transition: 'left .15s', boxShadow: 'var(--neu-sm)',
            }} />
          </span>
          <span className={mode === 'bulk' ? 'font-bold text-g700' : undefined}><i className="lni lni-layers"></i> Bulk</span>
        </label>
      </div>

      {mode === 'single' && (
        <>
          <div className="card">
            <div className="card-hdr">
              <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Search Passout Student</div>
            </div>
            <div className="fg" style={{ marginBottom: 0, position: 'relative' }} ref={singleSearchBoxRef}>
              <div className="lbl">Student Name, Reg No, or Student No <span className="req">*</span></div>
              <div className="flex gap-2 flex-wrap">
                <div className="inp-wrap" style={{ flex: 1, minWidth: 180 }}>
                  <span className="inp-icon"><i className="lni lni-search-alt"></i></span>
                  <input
                    className="ctrl"
                    type="text"
                    placeholder="e.g. MAJOK JOSEPH MADIT"
                    value={singleSearch}
                    onChange={e => setSingleSearch(e.target.value)}
                    onFocus={() => setSingleSearchFocused(true)}
                    onKeyDown={e => { if (e.key === 'Enter') setSingleCommittedSearch(singleSearch.trim()) }}
                  />
                </div>
                {selectedStudentGuid && (
                  <button className="btn btn-neu" onClick={clearSingleSelection}><i className="lni lni-close"></i> New Search</button>
                )}
              </div>

              {singleSearchFocused && (
                <div
                  className="mt-1"
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    background: 'var(--white)', border: '1.5px solid var(--b200)', borderRadius: 'var(--rsm)',
                    boxShadow: 'var(--neu-out)', maxHeight: 280, overflowY: 'auto',
                  }}
                >
                  {isSingleSearching ? (
                    <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>Searching…</div>
                  ) : isSingleSearchError ? (
                    <div className="text-clr-red text-center" style={{ padding: 16, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
                  ) : singleMatches.length === 0 ? (
                    <div className="text-g400 text-center" style={{ padding: 16, fontSize: 12.5 }}>No passout students found.</div>
                  ) : (
                    singleMatches.map(s => (
                      <div
                        key={s.studentGuid}
                        className="cursor-pointer px-3 py-2 hover:bg-b50 border-b border-g100 last:border-b-0"
                        onMouseDown={() => selectStudent(s)}
                      >
                        <div className="font-bold">{s.studentName}</div>
                        <div className="text-g500" style={{ fontSize: 11 }}>{s.studentRegNo}{s.programName ? ` · ${s.programName}` : ''}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedStudentGuid && (
            isSelectedLoading ? (
              <div className="card text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Loading student…</div>
            ) : isSelectedError || !selectedStudent ? (
              <div className="card text-clr-red text-center" style={{ padding: 24, fontSize: 12.5 }}><i className="lni lni-warning"></i> Couldn&apos;t load this student, or they&apos;re no longer marked Passout.</div>
            ) : (
              <>
                <div className="card p-0 overflow-hidden">
                  <div className="pc-hero">
                    <div className="pc-hero-top">
                      <div className="pc-hero-avatar">{initialsFor(selectedStudent.studentName)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="pc-hero-name truncate">{selectedStudent.studentName}</div>
                        <div className="pc-hero-sub truncate">{selectedStudent.programName ?? '—'}</div>
                        <span className="pc-hero-badge"><i className="lni lni-bookmark"></i> {selectedStudent.studentRegNo}</span>
                      </div>
                    </div>
                    <div className="pc-hero-facts">
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Batch</span><span className="pc-hero-fact-val" title={selectedStudent.batchCode ?? '—'}>{selectedStudent.batchCode ?? '—'}</span></div>
                      <div className="pc-hero-fact"><span className="pc-hero-fact-lbl">Campus</span><span className="pc-hero-fact-val" title={selectedStudent.campusName ?? '—'}>{selectedStudent.campusName ?? '—'}</span></div>
                    </div>
                  </div>
                </div>

                {!selectedStudent.applicationGuid && (
                  <div className="warn-box">
                    <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0, marginTop: 1 }}></i>
                    <div>No linked application for this student — cannot refund on either ledger.</div>
                  </div>
                )}
              </>
            )
          )}
        </>
      )}

      {mode === 'bulk' && (
      <>
      <div className="card">
        <div className="card-hdr">
          <div className="card-title"><span className="ctitle-icon"><i className="lni lni-search-alt"></i></span> Search Passout / Library Deposit</div>
        </div>
        <div className="g4">
          <div className="fg" style={{ marginBottom: 0 }}>
            <div className="lbl">Intake</div>
            <SearchSelect
              placeholder="All intakes"
              options={intakeOptions}
              value={intakeGuid}
              onChange={v => updateFilters(() => {
                setIntakeGuid(v)
                const intake = intakes.find(i => i.intakeGuid === v)
                if (intake) setSelectedLabels(prev => ({ ...prev, intake: `${intake.month} ${intake.financialYear}` }))
              })}
              onSearch={setIntakeSearch}
              onOpenChange={setIntakePickerOpen}
              isLoading={intakeQuery.isLoading}
              hasNextPage={intakeQuery.hasNextPage}
              isFetchingNextPage={intakeQuery.isFetchingNextPage}
              onLoadMore={() => intakeQuery.fetchNextPage()}
            />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <div className="lbl">Campus</div>
            <SearchSelect
              placeholder="All campuses"
              options={campusOptions}
              value={campusGuid}
              onChange={v => updateFilters(() => {
                setCampusGuid(v)
                const campus = campuses.find(c => c.campusGuid === v)
                setSelectedLabels(prev => ({ ...prev, campus: campus?.campusName ?? '', program: '', batch: '' }))
                // Cascade reset — a Programme (and its own downstream Batch)
                // picked under the old Campus may not exist under the new
                // one, so both clear rather than silently keep filtering by
                // a now-stale guid.
                setProgramGuid('')
                setBatchGuid('')
              })}
              onSearch={setCampusSearch}
              onOpenChange={setCampusPickerOpen}
              isLoading={campusQuery.isLoading}
              hasNextPage={campusQuery.hasNextPage}
              isFetchingNextPage={campusQuery.isFetchingNextPage}
              onLoadMore={() => campusQuery.fetchNextPage()}
            />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <div className="lbl">Programme</div>
            <SearchSelect
              placeholder={campusGuid ? 'All programmes at this campus' : 'Select a campus first'}
              disabled={!campusGuid}
              options={programOptions}
              value={programGuid}
              onChange={v => updateFilters(() => {
                setProgramGuid(v)
                const program = programs.find(p => p.programGuid === v)
                setSelectedLabels(prev => ({ ...prev, program: program?.programName ?? '', batch: '' }))
                // Cascade reset — Batch is scoped to Programme.
                setBatchGuid('')
              })}
              onSearch={setProgramSearch}
              onOpenChange={setProgramPickerOpen}
              isLoading={programQuery.isLoading}
              hasNextPage={programQuery.hasNextPage}
              isFetchingNextPage={programQuery.isFetchingNextPage}
              onLoadMore={() => programQuery.fetchNextPage()}
            />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <div className="lbl">Batch</div>
            <SearchSelect
              placeholder={programGuid ? 'All batches in this programme' : 'Select a programme first'}
              disabled={!programGuid}
              options={batchOptions}
              value={batchGuid}
              onChange={v => updateFilters(() => {
                setBatchGuid(v)
                const batch = batches.find(b => b.batchGuid === v)
                if (batch) setSelectedLabels(prev => ({ ...prev, batch: batch.batchCode }))
              })}
              onSearch={setBatchSearch}
              isLoading={batchesData === undefined}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>Searching…</div>
        ) : isError ? (
          <div className="text-clr-red text-center" style={{ padding: 24, fontSize: 12.5 }}><i className="lni lni-warning"></i> Search failed. Please try again.</div>
        ) : rows.length === 0 ? (
          <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>No unrefunded Library Deposit lines found.</div>
        ) : (
          <>
            <ScrollTable className="no-sticky-col">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} title="Select all refundable lines on this page" /></th>
                    <th>Student</th>
                    <th>Reg No</th>
                    <th>Source</th>
                    <th>Ledger</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const disabled = !r.applicationGuid
                    return (
                      <tr key={r.key} className={disabled ? '' : 'cursor-pointer'} style={disabled ? { opacity: 0.55 } : undefined} onClick={() => toggleRow(r)}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(r.key)}
                            disabled={disabled}
                            onChange={() => toggleRow(r)}
                            onClick={e => e.stopPropagation()}
                            title={disabled ? 'No linked application — cannot refund' : undefined}
                          />
                        </td>
                        <td className="font-bold">{r.studentName}</td>
                        <td>{r.studentRegNo}</td>
                        <td><span className={`badge ${r.source === 'main' ? 'badge-cyan' : 'badge-purple'}`}>{r.source === 'main' ? 'Main Ledger' : 'Other Ledger'}</span></td>
                        <td>{r.ledgerName}{disabled && <span className="text-clr-red" style={{ fontSize: 10.5, marginLeft: 6 }}>No application</span>}</td>
                        <td className="font-bold">{r.currencyCode} {fmtAmt(r.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollTable>
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="students" onPageChange={setPage} />
          </>
        )}
      </div>
      </>
      )}

      {mode === 'single' && selectedStudent && (
        <div className="card">
          {rows.length === 0 ? (
            <div className="text-g400 text-center" style={{ padding: 24, fontSize: 12.5 }}>No unrefunded Library Deposit lines found for this student.</div>
          ) : (
            <ScrollTable className="no-sticky-col">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} title="Select all refundable lines" /></th>
                    <th>Source</th>
                    <th>Ledger</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const disabled = !r.applicationGuid
                    return (
                      <tr key={r.key} className={disabled ? '' : 'cursor-pointer'} style={disabled ? { opacity: 0.55 } : undefined} onClick={() => toggleRow(r)}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(r.key)}
                            disabled={disabled}
                            onChange={() => toggleRow(r)}
                            onClick={e => e.stopPropagation()}
                            title={disabled ? 'No linked application — cannot refund' : undefined}
                          />
                        </td>
                        <td><span className={`badge ${r.source === 'main' ? 'badge-cyan' : 'badge-purple'}`}>{r.source === 'main' ? 'Main Ledger' : 'Other Ledger'}</span></td>
                        <td>{r.ledgerName}</td>
                        <td className="font-bold">{r.currencyCode} {fmtAmt(r.amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </div>
      )}

      {selectedRows.length > 0 && (
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-reload"></i></span> {mode === 'single' ? 'Refund' : 'Bulk Refund'} — {selectedRows.length} line{selectedRows.length === 1 ? '' : 's'} selected</div>
          </div>

          {/* Each selected line keeps its own amount — this date/remarks
              pair applies to every refund submitted in this batch, it is
              never combined into one editable total across lines/sources
              (see the tab's own comment on the refund cap model). */}
          <div className="g2 mb-[14px]">
            <div className="fg">
              <div className="lbl">Refund Date <span className="req">*</span></div>
              <DatePicker value={refundDate} onChange={setRefundDate} />
            </div>
            <div className="fg">
              <div className="lbl">Remarks</div>
              <textarea className="ctrl" rows={1} placeholder="Applied to every selected line" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-[10px] justify-end flex-wrap">
            <button className="btn btn-neu" onClick={() => setSelectedKeys(new Set())}><i className="lni lni-close"></i> Clear Selection</button>
            <button
              className="btn btn-primary btn-lg"
              disabled={isSubmitPending || !permissionsCreate}
              onClick={mode === 'bulk' ? handleBulkSubmit : handleSingleSubmit}
            >
              <i className="lni lni-checkmark"></i> {isSubmitPending ? 'Submitting…' : `Refund ${selectedRows.length} Line${selectedRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {results && (
        <div className="card">
          <div className="card-hdr">
            <div className="card-title"><span className="ctitle-icon"><i className="lni lni-folder"></i></span> {mode === 'single' ? 'Refund Results' : 'Bulk Refund Results'}</div>
            <button className="btn btn-neu btn-sm" onClick={() => setResults(null)}><i className="lni lni-close"></i> Dismiss</button>
          </div>
          <ScrollTable className="no-sticky-col">
            <table>
              <thead><tr><th>Application</th><th>Source</th><th>Status</th><th>Detail</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.applicationGuid}-${r.ledgerGuid ?? r.ledgerOthersGuid}-${i}`}>
                    <td className="font-mono">{r.applicationGuid}</td>
                    <td><span className={`badge ${r.ledgerGuid ? 'badge-cyan' : 'badge-purple'}`}>{r.ledgerGuid ? 'Main Ledger' : 'Other Ledger'}</span></td>
                    <td>{r.success ? <span className="badge badge-green">Refunded</span> : <span className="badge badge-red">Failed</span>}</td>
                    <td>{r.success ? (r.refundGuid ?? '—') : (r.error ?? 'Unknown error')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      )}
    </div>
  )
}
