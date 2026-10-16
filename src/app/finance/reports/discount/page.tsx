'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { MultiSelect } from '@/components/MultiSelect'
import DatePicker from '@/components/DatePicker'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { AuthError } from '@/lib/api/client'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { simulateReportStatus } from '@/lib/notificationsHub'
import { REPORT_JOBS_KEY, downloadReportJob, trackInline, upsertReportJob } from '@/lib/reportDownloads'
import {
  DiscountReportFilters, DiscountReportRow,
  DISCOUNT_REPORT_MAX_PROGRAMMES, DISCOUNT_REPORT_MAX_SEARCH,
  exportDiscountReport, getDiscountDropdown, getDiscountReportPreview, getReportJobs, REPORT_STATUS,
} from '@/lib/api/finance/discountReport'

const MOCK_AUTH = process.env.NEXT_PUBLIC_AUTH_MOCK === 'true'

// Discount Report — erp-docs/pages/finance/discount-report-page.md.
// Process → page 1 (summary + 15 rows) → infinite scroll (includeSummary=false)
// → Export to Excel runs in the background; its progress arrives live as
// `reportStatus` on the app's one SignalR connection and lands in Downloads.

interface FormState {
  fromDate: string
  toDate: string
  intakeGuid: string
  discountGuid: string
  programGuids: string[]
  search: string
}
const EMPTY_FORM: FormState = { fromDate: '', toDate: '', intakeGuid: '', discountGuid: '', programGuids: [], search: '' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// payDate is a calendar date (time always 00:00:00): format the string
// itself, never via Date, so no time-zone shift can move it a day.
function fmtPayDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-')
  return y && m && d ? `${d}/${MONTHS[+m - 1]}/${y}` : value
}
function fmtYmd(ymd: string): string { return fmtPayDate(ymd) }

function fmtAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtCount(n: number): string { return n.toLocaleString('en-US') }

const SOURCE_LABEL: Record<number, string> = { 1: 'Direct payment', 2: 'Advance adjustment' }
const PAYMODE_LABEL: Record<number, string> = { 1: 'Cash', 2: 'Cheque', 3: 'Bank', 4: 'Demand draft', 5: 'Online' }

// Turn the form into the filters the API takes: trimmed, empties dropped.
function toFilters(f: FormState): DiscountReportFilters {
  const search = f.search.trim()
  return {
    fromDate: f.fromDate || undefined,
    toDate: f.toDate || undefined,
    intakeGuid: f.intakeGuid || undefined,
    discountGuid: f.discountGuid || undefined,
    programGuids: f.programGuids.length ? f.programGuids : undefined,
    search: search || undefined,
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export default function DiscountReportPage() {
  // ── Filters ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [filtersOpen, setFiltersOpen] = useState(true)
  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => (prev[k] ? { ...prev, [k]: '' } : prev))
  }

  // Step 1: all three dropdowns load in parallel on page open.
  const intakesQuery = useIntakesDropdown()
  const programsQuery = useProgramDropdown()
  const discountsQuery = useQuery({ queryKey: ['finance', 'discounts', 'dropdown'], queryFn: getDiscountDropdown })

  const intakeOptions = useMemo(() => (intakesQuery.data ?? []).map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` })), [intakesQuery.data])
  const programOptions = useMemo(() => (programsQuery.data ?? []).map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` })), [programsQuery.data])
  const discountOptions = useMemo(() => (discountsQuery.data ?? []).map(d => ({ value: d.discountGuid, label: `${d.discountName} (${d.discountCode})` })), [discountsQuery.data])

  // ── Process: the saved copy of the filters ──────────────────────────────
  // Every later page and the export reuse THIS, not the live form, so editing
  // a filter without pressing Process again can't stitch two reports together.
  const [saved, setSaved] = useState<DiscountReportFilters | null>(null)
  // Bumped on every Process so pressing it again with identical filters still
  // fetches a fresh, consistent result (rows can shift during a long scroll).
  const [runId, setRunId] = useState(0)

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (form.fromDate && form.toDate && form.fromDate > form.toDate) e.toDate = 'To date can’t be before the from date'
    if (form.programGuids.length > DISCOUNT_REPORT_MAX_PROGRAMMES) e.programGuids = `Select at most ${DISCOUNT_REPORT_MAX_PROGRAMMES} programmes (now ${form.programGuids.length})`
    if (form.search.trim().length > DISCOUNT_REPORT_MAX_SEARCH) e.search = `Search can be at most ${DISCOUNT_REPORT_MAX_SEARCH} characters`
    setErrors(e)
    if (Object.keys(e).length) { scrollToFirstError(e); return false }
    return true
  }

  function handleProcess() {
    if (!validate()) return
    setSaved(toFilters(form))
    setExportJobGuid(null)
    setExportError(null)
    setRunId(r => r + 1)
    setFiltersOpen(false)
  }

  function handleReset() { setForm(EMPTY_FORM); setErrors({}) }

  // ── Preview: page 1 with summary, then infinite scroll ──────────────────
  const preview = useInfiniteQuery({
    queryKey: ['finance', 'discount-report', runId, saved],
    queryFn: ({ pageParam }) => getDiscountReportPreview(saved as DiscountReportFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.rows.items.length, 0)
      return loaded < last.rows.totalCount && last.rows.items.length > 0 ? all.length + 1 : undefined
    },
    enabled: !!saved,
    gcTime: 0,
  })

  const pages = preview.data?.pages ?? []
  const rows: DiscountReportRow[] = useMemo(() => pages.flatMap(p => p.rows.items), [pages])
  // Summary is rendered from the page-1 response only and kept while scrolling.
  const summary = pages[0]?.summary ?? null
  const totalCount = pages[0]?.rows.totalCount ?? 0
  const hasResult = pages.length > 0
  const isEmpty = hasResult && totalCount === 0
  const firstPageFailed = preview.isError && !hasResult
  const nextPageFailed = preview.isFetchNextPageError

  // Load the next page as the sentinel row nears the bottom of the scroll box.
  // Never while a request is in flight, and never automatically after a
  // failed page (that waits for the user's Retry).
  const sentinelRef = useRef<HTMLTableRowElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    // The ScrollTable box the rows scroll in (a new Process remounts it at the top).
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
      chips.push({ label: 'Dates', value: `${saved.fromDate ? fmtYmd(saved.fromDate) : 'Start'} – ${saved.toDate ? fmtYmd(saved.toDate) : 'Today'}` })
    }
    if (saved.intakeGuid) chips.push({ label: 'Intake', value: intakeOptions.find(o => o.value === saved.intakeGuid)?.label ?? 'Selected' })
    if (saved.discountGuid) chips.push({ label: 'Discount', value: discountOptions.find(o => o.value === saved.discountGuid)?.label ?? 'Selected' })
    if (saved.programGuids?.length) {
      chips.push({ label: 'Programmes', value: saved.programGuids.length === 1 ? (programOptions.find(o => o.value === saved.programGuids![0])?.label ?? '1 selected') : `${saved.programGuids.length} selected` })
    }
    if (saved.search) chips.push({ label: 'Student', value: `“${saved.search}”` })
    return chips
  }, [saved, intakeOptions, discountOptions, programOptions])

  // ── Export ──────────────────────────────────────────────────────────────
  // The button follows the job it started: Export to Excel → Processing… →
  // Download (or an inline error with Try again). No toasts here; the job
  // also appears in the header's Downloads list, which skips its own toast
  // for a job this page is showing (trackInline).
  const queryClient = useQueryClient()
  const jobsQuery = useQuery({ queryKey: REPORT_JOBS_KEY, queryFn: () => getReportJobs(1, 15) })
  const [exportJobGuid, setExportJobGuid] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const exportJob = exportJobGuid ? jobsQuery.data?.items.find(j => j.reportJobGuid === exportJobGuid) : undefined
  useEffect(() => (exportJobGuid ? trackInline(exportJobGuid) : undefined), [exportJobGuid])

  const exportPhase: 'idle' | 'processing' | 'ready' | 'failed' =
    exporting || exportJob?.status.value === REPORT_STATUS.Queued || exportJob?.status.value === REPORT_STATUS.Processing ? 'processing'
    : exportJob?.status.value === REPORT_STATUS.Completed && !exportJob.isExpired ? 'ready'
    : exportJob?.status.value === REPORT_STATUS.Failed ? 'failed'
    : 'idle'

  async function handleExport() {
    if (!saved) return
    setExporting(true)
    setExportError(null)
    try {
      // The SAVED filters from Process, never the live form.
      const { job } = await exportDiscountReport(saved)
      upsertReportJob(queryClient, job)   // same guid on a duplicate export → updated, not added twice
      setExportJobGuid(job.reportJobGuid)
      if (MOCK_AUTH) {
        const base = { reportJobGuid: job.reportJobGuid, reportName: job.reportName, fileName: null, downloadUrl: null, downloadUrlExpiresAtUtc: null, errorMessage: null }
        setTimeout(() => simulateReportStatus({ ...base, status: 2, statusName: "Processing", occurredAtUtc: new Date().toISOString() }), 1200)
        setTimeout(() => simulateReportStatus({ ...base, status: 3, statusName: "Completed", fileName: "Discount_Report.xlsx", downloadUrl: "#", downloadUrlExpiresAtUtc: new Date(Date.now() + 600_000).toISOString(), occurredAtUtc: new Date().toISOString() }), 4200)
      }
    } catch (err) {
      const code = err instanceof AuthError ? err.code : undefined
      setExportError(code === "employee_required"
        ? "Your account isn’t linked to an employee record, so it can’t export. Ask an administrator to link it."
        : errorMessage(err, "Couldn’t start the export. Please try again."))
    } finally {
      setExporting(false)
    }
  }

  async function handleDownload() {
    if (!exportJobGuid) return
    setDownloading(true)
    setExportError(null)
    try {
      const opened = await downloadReportJob(exportJobGuid)
      if (!opened) setExportError("Mock mode: there’s no real file to download.")
    } catch (err) {
      if (err instanceof AuthError && err.code === "report_expired") {
        setExportJobGuid(null)
        setExportError("This report has expired. Please export it again.")
        jobsQuery.refetch()
      } else {
        setExportError(errorMessage(err, "Couldn’t get the download link. Please try again."))
      }
    } finally {
      setDownloading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Discount Report</div>
          <div className="pg-sub">Every fee discount applied on a payment · who got it, on which receipt and semester, and the total given per currency</div>
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
                <label className="lbl">Discount</label>
                <SearchSelect placeholder="All discounts" options={discountOptions} value={form.discountGuid} onChange={v => setField('discountGuid', v)} isLoading={discountsQuery.isLoading} />
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Programme <span className="text-g400" style={{ fontWeight: 400 }}>· up to {DISCOUNT_REPORT_MAX_PROGRAMMES}</span></label>
                <MultiSelect placeholder="All programmes" options={programOptions} value={form.programGuids} onChange={v => setField('programGuids', v)} isLoading={programsQuery.isLoading} />
                {errors.programGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programGuids}</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl" htmlFor="rpt-student">Student</label>
                <div className="inp-wrap">
                  <i className="lni lni-search-alt inp-icon" aria-hidden="true" />
                  <input
                    id="rpt-student"
                    className="ctrl"
                    placeholder="Name, reg no, student number, application ref, phone or email"
                    maxLength={DISCOUNT_REPORT_MAX_SEARCH}
                    value={form.search}
                    onChange={e => setField('search', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleProcess() }}
                    style={errors.search ? { borderColor: 'var(--red)' } : undefined}
                  />
                </div>
                {errors.search && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.search}</p>}
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
                ? <span className="rpt-chip">All discounts, all dates</span>
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
            <div style={{ fontSize: 13 }}>The discounts appear here, with totals per currency.</div>
          </div>
        ) : firstPageFailed ? (
          <div className="rpt-empty">
            <i className="lni lni-warning" aria-hidden="true" style={{ color: 'var(--red)' }} />
            <div className="rpt-empty-title">Couldn’t load the report</div>
            <div style={{ fontSize: 13, marginBottom: 14 }}>{errorMessage(preview.error, 'Something went wrong. Please try again.')}</div>
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
            <div className="rpt-empty-title">No discounts match these filters</div>
            <div style={{ fontSize: 13 }}>Try a wider date range or fewer filters.</div>
          </div>
        ) : (
          <>
            <div className="rpt-results-hdr">
              <div className="rpt-count">
                <strong>{fmtCount(totalCount)}</strong> rows · <strong>{fmtCount(summary?.totalStudents ?? 0)}</strong> students
              </div>
              <div className="rpt-export">
                {exportError && <span className="rpt-export-msg err" role="alert">{exportError}</span>}
                {exportPhase === 'failed' && !exportError && (
                  <span className="rpt-export-msg err" role="alert">{exportJob?.errorMessage || 'The report could not be generated.'}</span>
                )}
                {exportPhase === 'processing' && <span className="rpt-export-msg" aria-live="polite">Building the Excel file…</span>}
                {exportPhase === 'ready' && !exportError && (
                  <span className="rpt-export-msg ok" aria-live="polite">
                    {exportJob?.rowCount != null ? `Ready · ${fmtCount(exportJob.rowCount)} rows` : 'Ready'}
                  </span>
                )}
                {exportPhase === 'processing' ? (
                  <button type="button" className="btn btn-primary btn-sm" disabled aria-busy="true">
                    <i className="lni lni-spinner-arrow spin" aria-hidden="true" /> Processing…
                  </button>
                ) : exportPhase === 'ready' ? (
                  <button type="button" className="btn btn-success btn-sm" onClick={handleDownload} disabled={downloading}>
                    <i className={`lni ${downloading ? 'lni-spinner-arrow spin' : 'lni-download'}`} aria-hidden="true" /> Download Excel
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleExport}>
                    <i className={`lni ${exportPhase === 'failed' ? 'lni-reload' : 'lni-download'}`} aria-hidden="true" /> {exportPhase === 'failed' ? 'Try again' : 'Export to Excel'}
                  </button>
                )}
              </div>
            </div>

            <ScrollTable className="rpt-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Receipt</th><th>Student No</th><th>Student Name</th><th>Programme</th>
                    <th>Semester</th><th>Discount</th><th>Source</th><th>Paymode</th><th>Currency</th>
                    <th className="num">Discount Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    // Same receipt can legitimately repeat (adjustment rows), so
                    // the key includes the position.
                    <tr key={`${r.receipt}-${r.semCode}-${r.discountName}-${i}`}>
                      <td>{fmtPayDate(r.payDate)}</td>
                      <td className="rpt-mono">{r.receipt}</td>
                      <td className="rpt-mono">{r.studentNumber}</td>
                      <td>{r.studentName}</td>
                      <td>{r.programName}</td>
                      <td>{r.semesterName}</td>
                      <td>{r.discountName === 'Unknown discount' ? <span className="text-g400">Unknown discount</span> : r.discountName}</td>
                      <td>
                        <span className={`badge ${r.source.value === 2 ? 'badge-amber' : 'badge-grey'}`}>
                          {SOURCE_LABEL[r.source.value] ?? r.source.name}
                        </span>
                      </td>
                      <td>{PAYMODE_LABEL[r.payMode.value] ?? r.payMode.name}</td>
                      <td>{r.currencyCode}</td>
                      <td className="num"><span className="rpt-amt">{fmtAmount(r.discountAmount)}</span><span className="rpt-cur">{r.currencyCode}</span></td>
                    </tr>
                  ))}
                  <tr ref={sentinelRef} className="rpt-foot-row">
                    <td colSpan={11}>
                      {nextPageFailed ? (
                        <span className="inline-flex items-center gap-3">
                          <span style={{ color: 'var(--red)' }}>Couldn’t load more rows.</span>
                          <button className="btn btn-neu btn-sm" onClick={() => preview.fetchNextPage()}><i className="lni lni-reload" aria-hidden="true" /> Retry</button>
                        </span>
                      ) : preview.hasNextPage ? (
                        <span className="inline-flex items-center gap-2"><i className="lni lni-spinner-arrow spin" aria-hidden="true" /> Loading more…</span>
                      ) : (
                        <span>End of report · {fmtCount(rows.length)} rows</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollTable>

            {/* Pinned summary from page 1. One line per currency, never summed
                across currencies; students are NOT added up across lines. */}
            {summary && (
              <div className="rpt-summary" aria-label="Summary by currency">
                {summary.byCurrency.map(c => (
                  <div key={c.currencyCode} className="rpt-sum-cur">
                    <span className="rpt-sum-code">{c.currencyCode}</span>
                    <span className="rpt-sum-total">{fmtAmount(c.totalDiscount)}</span>
                    <span className="rpt-sum-meta">{fmtCount(c.rowCount)} rows · {fmtCount(c.studentCount)} students</span>
                  </div>
                ))}
                <span className="rpt-sum-note">Totals per discount are in the Excel file</span>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
