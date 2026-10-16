'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { MultiSelect } from '@/components/MultiSelect'
import DatePicker from '@/components/DatePicker'
import { ReportExportControls } from '@/components/finance/ReportExportControls'
import { ReportCurrencySummary } from '@/components/finance/ReportCurrencySummary'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { getReceiptBookDropdown } from '@/lib/api/finance/receiptBook'
import { useLedgers } from '@/hooks/finance/useLedgers'
import { searchVettedRegisteredApplications } from '@/lib/api/admission/applicationFiling'
import {
  DISCOUNT_LEDGER_CODE, TRANSACTION_REPORT_MAX_LEDGERS, TRANSACTION_REPORT_MAX_RECEIPT_BOOKS,
  TransactionReportFilters, TransactionReportRow, exportTransactionReport, getTransactionReportPreview,
} from '@/lib/api/finance/transactionReport'
import {
  REPORT_PAYMODE_LABEL, REPORT_SOURCE_LABEL, fmtReportAmount, fmtReportCount, fmtReportDate, reportErrorMessage,
} from '@/lib/reportFormat'

// Transaction Report — erp-docs/pages/finance/transaction-report-page.md.
// Works like the Discount Report: Process → page 1 (summary + 15 rows) →
// infinite scroll (includeSummary=false) → Export to Excel in the background,
// delivered through the shared Downloads list.

interface FormState {
  fromDate: string
  toDate: string
  intakeGuid: string
  applicationGuid: string
  receiptBookGuids: string[]
  ledgerGuids: string[]
}
const EMPTY_FORM: FormState = { fromDate: '', toDate: '', intakeGuid: '', applicationGuid: '', receiptBookGuids: [], ledgerGuids: [] }

// The student picker's search runs from 2 characters (vetted-registered-search
// rejects 1), debounced.
const STUDENT_MIN_CHARS = 2

function toFilters(f: FormState): TransactionReportFilters {
  return {
    fromDate: f.fromDate || undefined,
    toDate: f.toDate || undefined,
    intakeGuid: f.intakeGuid || undefined,
    applicationGuid: f.applicationGuid || undefined,
    receiptBookGuids: f.receiptBookGuids.length ? f.receiptBookGuids : undefined,
    ledgerGuids: f.ledgerGuids.length ? f.ledgerGuids : undefined,
  }
}

export default function TransactionReportPage() {
  // ── Filters ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [filtersOpen, setFiltersOpen] = useState(true)
  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => (prev[k] ? { ...prev, [k]: '' } : prev))
  }

  // Step 1: the dropdowns load in parallel on page open.
  const intakesQuery = useIntakesDropdown()
  const booksQuery = useQuery({ queryKey: ['finance', 'receipt-books', 'dropdown', 'all'], queryFn: () => getReceiptBookDropdown(true) })
  const ledgersQuery = useLedgers()

  const intakeOptions = useMemo(() => (intakesQuery.data ?? []).map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` })), [intakesQuery.data])
  // Used-up books are kept (most past receipts came from them), labelled.
  const bookOptions = useMemo(() => (booksQuery.data ?? []).map(b => ({ value: b.receiptBookGuid, label: b.isActive ? b.bookCode : `${b.bookCode} (used)` })), [booksQuery.data])
  // The Discount ledger is left out: discount is a column, not a row.
  const ledgerOptions = useMemo(() => (ledgersQuery.data ?? [])
    .filter(l => l.ledgerCode.trim().toUpperCase() !== DISCOUNT_LEDGER_CODE)
    .map(l => ({ value: l.ledgerGuid, label: `${l.ledgerCode} - ${l.ledgerName}` })), [ledgersQuery.data])

  // Student typeahead (one student; clearing it means all students). The
  // chosen option is kept so its label survives a new search.
  const [studentSearch, setStudentSearch] = useState('')
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedStudentSearch(studentSearch.trim()), 300); return () => clearTimeout(t) }, [studentSearch])
  const studentsQuery = useQuery({
    queryKey: ['admissions', 'vetted-registered-search', debouncedStudentSearch],
    queryFn: () => searchVettedRegisteredApplications(debouncedStudentSearch, 1, 20),
    enabled: debouncedStudentSearch.length >= STUDENT_MIN_CHARS,
  })
  const [chosenStudent, setChosenStudent] = useState<{ value: string; label: string } | null>(null)
  const studentOptions = useMemo(() => {
    const found = (studentsQuery.data?.items ?? []).map(a => ({
      value: a.applicationGuid,
      label: `${[a.firstName, a.lastName].filter(Boolean).join(' ') || 'Unnamed'} (${a.appRefNo})`,
    }))
    return chosenStudent && !found.some(o => o.value === chosenStudent.value) ? [chosenStudent, ...found] : found
  }, [studentsQuery.data, chosenStudent])
  function pickStudent(guid: string) {
    setChosenStudent(guid ? studentOptions.find(o => o.value === guid) ?? null : null)
    setField('applicationGuid', guid)
  }

  // ── Process: the saved copy of the filters ──────────────────────────────
  // Every later page and the export reuse THIS, not the live form.
  const [saved, setSaved] = useState<TransactionReportFilters | null>(null)
  const [savedStudentLabel, setSavedStudentLabel] = useState<string | null>(null)
  // Bumped on every Process so pressing it again still fetches fresh rows.
  const [runId, setRunId] = useState(0)

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (form.fromDate && form.toDate && form.fromDate > form.toDate) e.toDate = 'To date can’t be before the from date'
    if (form.receiptBookGuids.length > TRANSACTION_REPORT_MAX_RECEIPT_BOOKS) e.receiptBookGuids = `Select at most ${TRANSACTION_REPORT_MAX_RECEIPT_BOOKS} receipt books (now ${form.receiptBookGuids.length})`
    if (form.ledgerGuids.length > TRANSACTION_REPORT_MAX_LEDGERS) e.ledgerGuids = `Select at most ${TRANSACTION_REPORT_MAX_LEDGERS} ledgers (now ${form.ledgerGuids.length})`
    setErrors(e)
    if (Object.keys(e).length) { scrollToFirstError(e); return false }
    return true
  }

  function handleProcess() {
    if (!validate()) return
    setSaved(toFilters(form))
    setSavedStudentLabel(chosenStudent?.label ?? null)
    setRunId(r => r + 1)
    setFiltersOpen(false)
  }

  function handleReset() { setForm(EMPTY_FORM); setErrors({}); setChosenStudent(null); setStudentSearch('') }

  // ── Preview: page 1 with summary, then infinite scroll ──────────────────
  const preview = useInfiniteQuery({
    queryKey: ['finance', 'transaction-report', runId, saved],
    queryFn: ({ pageParam }) => getTransactionReportPreview(saved as TransactionReportFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.rows.items.length, 0)
      return loaded < last.rows.totalCount && last.rows.items.length > 0 ? all.length + 1 : undefined
    },
    enabled: !!saved,
    gcTime: 0,
  })

  const pages = preview.data?.pages ?? []
  const rows: TransactionReportRow[] = useMemo(() => pages.flatMap(p => p.rows.items), [pages])
  // Summary comes from the page-1 response only and stays while scrolling.
  const summary = pages[0]?.summary ?? null
  const totalCount = pages[0]?.rows.totalCount ?? 0
  const hasResult = pages.length > 0
  const isEmpty = hasResult && totalCount === 0
  const firstPageFailed = preview.isError && !hasResult
  const nextPageFailed = preview.isFetchNextPageError

  // Load the next page as the sentinel row nears the bottom of the scroll box —
  // never while a request is running, never automatically after a failure.
  const sentinelRef = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    const root = el?.closest('.tbl-wrap')
    if (!el || !root) return
    const io = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && preview.hasNextPage && !preview.isFetching && !preview.isFetchNextPageError) {
        preview.fetchNextPage()
      }
    }, { root, rootMargin: '240px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [preview.hasNextPage, preview.isFetching, preview.isFetchNextPageError, preview.fetchNextPage, rows.length])

  // Recap chips for the filters the CURRENT result was built from.
  const recap = useMemo(() => {
    if (!saved) return []
    const chips: { label: string; value: string }[] = []
    if (saved.fromDate || saved.toDate) {
      chips.push({ label: 'Dates', value: `${saved.fromDate ? fmtReportDate(saved.fromDate) : 'Start'} – ${saved.toDate ? fmtReportDate(saved.toDate) : 'Today'}` })
    }
    if (saved.intakeGuid) chips.push({ label: 'Intake', value: intakeOptions.find(o => o.value === saved.intakeGuid)?.label ?? 'Selected' })
    if (saved.applicationGuid) chips.push({ label: 'Student', value: savedStudentLabel ?? 'Selected' })
    if (saved.receiptBookGuids?.length) {
      chips.push({ label: 'Receipt books', value: saved.receiptBookGuids.length === 1 ? (bookOptions.find(o => o.value === saved.receiptBookGuids![0])?.label ?? '1 selected') : `${saved.receiptBookGuids.length} selected` })
    }
    if (saved.ledgerGuids?.length) {
      chips.push({ label: 'Ledgers', value: saved.ledgerGuids.length === 1 ? (ledgerOptions.find(o => o.value === saved.ledgerGuids![0])?.label ?? '1 selected') : `${saved.ledgerGuids.length} selected` })
    }
    return chips
  }, [saved, savedStudentLabel, intakeOptions, bookOptions, ledgerOptions])

  const COLS = 14

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Transaction Report</div>
          <div className="pg-sub">Every fee ledger line paid on a receipt · with its discount and net amount, and totals per currency</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-neu btn-sm" aria-expanded={filtersOpen} aria-controls="rpt-filters" onClick={() => setFiltersOpen(o => !o)}>
            <i className={`lni ${filtersOpen ? 'lni-chevron-up' : 'lni-funnel'}`} aria-hidden="true" /> {filtersOpen ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" id="rpt-filters">
        {filtersOpen ? (
          <>
            <div className="rpt-filter-grid">
              <div className="fg m-0">
                <label className="lbl">From date</label>
                <DatePicker value={form.fromDate} onChange={v => setField('fromDate', v)} maxYmd={form.toDate || undefined} rangeMessage="From date can’t be after the to date" />
              </div>
              <div className="fg m-0">
                <label className="lbl">To date</label>
                <DatePicker value={form.toDate} onChange={v => setField('toDate', v)} minYmd={form.fromDate || undefined} rangeMessage="To date can’t be before the from date" hasError={!!errors.toDate} />
                {errors.toDate && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.toDate}</p>}
              </div>
              <div className="fg m-0">
                <label className="lbl">Intake</label>
                <SearchSelect placeholder="All intakes" options={intakeOptions} value={form.intakeGuid} onChange={v => setField('intakeGuid', v)} isLoading={intakesQuery.isLoading} />
              </div>
              <div className="fg m-0">
                <label className="lbl">Student</label>
                <SearchSelect
                  placeholder="Type a name or reg no…"
                  options={studentOptions}
                  value={form.applicationGuid}
                  onChange={pickStudent}
                  onSearch={setStudentSearch}
                  isLoading={studentsQuery.isFetching}
                />
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Receipt books <span className="text-g400" style={{ fontWeight: 400 }}>· up to {TRANSACTION_REPORT_MAX_RECEIPT_BOOKS}</span></label>
                <MultiSelect placeholder="All receipt books" options={bookOptions} value={form.receiptBookGuids} onChange={v => setField('receiptBookGuids', v)} isLoading={booksQuery.isLoading} />
                {errors.receiptBookGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.receiptBookGuids}</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Ledgers <span className="text-g400" style={{ fontWeight: 400 }}>· up to {TRANSACTION_REPORT_MAX_LEDGERS}</span></label>
                <MultiSelect placeholder="All ledgers" options={ledgerOptions} value={form.ledgerGuids} onChange={v => setField('ledgerGuids', v)} isLoading={ledgersQuery.isLoading} />
                {errors.ledgerGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.ledgerGuids}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-g400 mr-auto" style={{ fontSize: 'var(--fs-sm)' }}>Every filter is optional. Leave them all empty to report on everything.</span>
              <button type="button" className="btn btn-neu btn-sm" onClick={handleReset}>Reset</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleProcess} disabled={preview.isFetching && !preview.isFetchingNextPage}>
                <i className="lni lni-play" aria-hidden="true" /> {preview.isFetching && !preview.isFetchingNextPage ? 'Processing…' : 'Process'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-g500" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Showing</span>
            <div className="rpt-recap" style={{ flex: 1 }}>
              {recap.length === 0
                ? <span className="rpt-chip">All transactions, all dates</span>
                : recap.map(c => <span key={c.label} className="rpt-chip"><span className="rpt-chip-lbl">{c.label}</span>{c.value}</span>)}
            </div>
            <button type="button" className="btn btn-neu btn-sm" onClick={() => setFiltersOpen(true)}>
              <i className="lni lni-pencil" aria-hidden="true" /> Change filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="card">
        {!saved ? (
          <div className="rpt-empty">
            <i className="lni lni-bar-chart" aria-hidden="true" />
            <div className="rpt-empty-title">Set your filters, then Process</div>
            <div style={{ fontSize: 13 }}>The paid ledger lines appear here, with totals per currency.</div>
          </div>
        ) : firstPageFailed ? (
          <div className="rpt-empty">
            <i className="lni lni-warning" aria-hidden="true" style={{ color: 'var(--red)' }} />
            <div className="rpt-empty-title">Couldn’t load the report</div>
            <div style={{ fontSize: 13, marginBottom: 14 }}>{reportErrorMessage(preview.error, 'Something went wrong. Please try again.')}</div>
            <button className="btn btn-neu btn-sm" onClick={() => preview.refetch()}><i className="lni lni-reload" aria-hidden="true" /> Try again</button>
          </div>
        ) : !hasResult ? (
          <div className="rpt-empty">
            <i className="lni lni-spinner-arrow spin" aria-hidden="true" />
            <div className="rpt-empty-title">Building the report…</div>
          </div>
        ) : isEmpty ? (
          <div className="rpt-empty">
            <i className="lni lni-search-alt" aria-hidden="true" />
            <div className="rpt-empty-title">No transactions match these filters</div>
            <div style={{ fontSize: 13 }}>Try a wider date range or fewer filters.</div>
          </div>
        ) : (
          <>
            <div className="rpt-results-hdr">
              <div className="rpt-count">
                <strong>{fmtReportCount(totalCount)}</strong> rows · <strong>{fmtReportCount(summary?.totalReceipts ?? 0)}</strong> receipts · <strong>{fmtReportCount(summary?.totalStudents ?? 0)}</strong> students
              </div>
              <ReportExportControls
                resetKey={runId}
                mockFileName="Transaction_Report.xlsx"
                startExport={() => exportTransactionReport(saved)}
              />
            </div>

            <ScrollTable className="rpt-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Receipt</th><th>Receipt Book</th><th>Student No</th><th>Student Name</th>
                    <th>Programme</th><th>Semester</th><th>Ledger</th><th>Paymode</th><th>Source</th><th>Currency</th>
                    <th className="num">Amount</th><th className="num">Discount</th><th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    // A receipt has several lines and adjustment rows can
                    // repeat a receipt, so the key includes the position.
                    <tr key={`${r.receipt}-${r.ledgerCode}-${r.semCode}-${i}`}>
                      <td>{fmtReportDate(r.payDate)}</td>
                      <td className="rpt-mono">{r.receipt}</td>
                      <td className="rpt-mono">{r.receiptBook}</td>
                      <td className="rpt-mono">{r.studentNumber}</td>
                      <td>{r.studentName}</td>
                      <td>{r.programName}</td>
                      <td>{r.semesterName}</td>
                      <td>{r.ledgerCode} - {r.ledgerName}</td>
                      <td>{REPORT_PAYMODE_LABEL[r.payMode.value] ?? r.payMode.name}</td>
                      <td>
                        <span className={`badge ${r.source.value === 2 ? 'badge-amber' : 'badge-grey'}`}>
                          {REPORT_SOURCE_LABEL[r.source.value] ?? r.source.name}
                        </span>
                      </td>
                      <td>{r.currencyCode}</td>
                      <td className="num"><span className="rpt-amt">{fmtReportAmount(r.amount)}</span><span className="rpt-cur">{r.currencyCode}</span></td>
                      <td className="num">
                        {r.discount > 0
                          ? <><span className="rpt-amt">{fmtReportAmount(r.discount)}</span><span className="rpt-cur">{r.currencyCode}</span></>
                          : <span className="text-g400">0.00</span>}
                      </td>
                      <td className="num"><span className="rpt-amt">{fmtReportAmount(r.net)}</span><span className="rpt-cur">{r.currencyCode}</span></td>
                    </tr>
                  ))}
                  <tr ref={sentinelRef} className="rpt-foot-row">
                    <td colSpan={COLS}>
                      {nextPageFailed ? (
                        <span className="inline-flex items-center gap-3">
                          <span style={{ color: 'var(--red)' }}>Couldn’t load more rows.</span>
                          <button className="btn btn-neu btn-sm" onClick={() => preview.fetchNextPage()}><i className="lni lni-reload" aria-hidden="true" /> Retry</button>
                        </span>
                      ) : preview.hasNextPage ? (
                        <span className="inline-flex items-center gap-2"><i className="lni lni-spinner-arrow spin" aria-hidden="true" /> Loading more…</span>
                      ) : (
                        <span>End of report · {fmtReportCount(rows.length)} rows</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollTable>

            {/* Pinned summary from page 1. One line per currency, never added
                across currencies; receipt/student counts aren't summed either. */}
            {summary && (
              <ReportCurrencySummary
                title="Summary by currency"
                note="Totals per ledger are in the Excel file"
                rows={summary.byCurrency}
                columns={[
                  { label: 'Rows', value: c => fmtReportCount(c.rowCount) },
                  { label: 'Receipts', value: c => fmtReportCount(c.receiptCount) },
                  { label: 'Gross', value: c => fmtReportAmount(c.gross) },
                  { label: 'Discount', value: c => fmtReportAmount(c.discount) },
                  // Only when some currency has rare unallocated discount.
                  ...(summary.byCurrency.some(c => c.unallocatedDiscount > 0)
                    ? [{ label: 'Unallocated discount', value: (c: typeof summary.byCurrency[number]) => fmtReportAmount(c.unallocatedDiscount) }]
                    : []),
                  { label: 'Net', value: c => fmtReportAmount(c.net), key: true },
                ]}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
