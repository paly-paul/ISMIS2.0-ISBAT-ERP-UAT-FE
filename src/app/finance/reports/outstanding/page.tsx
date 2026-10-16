'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { SearchSelect } from '@/components/SearchSelect'
import { MultiSelect } from '@/components/MultiSelect'
import { ReportExportControls } from '@/components/finance/ReportExportControls'
import { ReportCurrencySummary } from '@/components/finance/ReportCurrencySummary'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { getCampusDropdown } from '@/lib/api/academic/campus'
import { getProgramMastersByCampus } from '@/lib/api/academic/programMaster'
import { getSemestersForProgram } from '@/lib/api/academic/semester'
import { getBatchDropdown } from '@/lib/api/academic/batch'
import { getSponsorCategories } from '@/lib/api/student/sponsor'
import {
  DEFAULT_REG_STATUSES, OUTSTANDING_REPORT_MAX_SEARCH, REG_STATUS_OPTIONS,
  OutstandingAmounts, OutstandingReportFilters, OutstandingReportRow,
  exportOutstandingReport, getOutstandingReportPreview,
} from '@/lib/api/finance/outstandingReport'
import { fmtReportAmount, fmtReportCount, reportErrorMessage } from '@/lib/reportFormat'

// Outstanding Report — erp-docs/pages/finance/outstanding-report-page.md.
// Works like the Transaction Report: Process → page 1 (summary + 15 rows) →
// infinite scroll (includeSummary=false) → Export to Excel in the background.
// The preview is slow by design (~7 s page 1, ~3 s per later page): the whole
// scope is recalculated on every call.

interface FormState {
  campusGuid: string
  programGuid: string
  semesterGuid: string
  batchGuid: string
  intakeGuid: string
  sponsorCategoryGuid: string
  regStatuses: string[]      // MultiSelect values; sent as numbers
  search: string
}
const DEFAULT_STATUS_VALUES = DEFAULT_REG_STATUSES.map(String)
const STATUS_OPTIONS = REG_STATUS_OPTIONS.map(s => ({ value: String(s.value), label: s.label }))

function emptyForm(currentIntakeGuid: string): FormState {
  return { campusGuid: '', programGuid: '', semesterGuid: '', batchGuid: '', intakeGuid: currentIntakeGuid, sponsorCategoryGuid: '', regStatuses: DEFAULT_STATUS_VALUES, search: '' }
}

// Turn the form into the filters the API takes. intakeGuid is sent only when
// it isn't the current intake (the server's default), and never with a batch
// (the batch decides who is checked).
function toFilters(f: FormState, currentIntakeGuid: string): OutstandingReportFilters {
  const search = f.search.trim()
  return {
    campusGuid: f.campusGuid || undefined,
    programGuid: f.programGuid || undefined,
    semesterGuid: f.semesterGuid || undefined,
    batchGuid: f.batchGuid || undefined,
    intakeGuid: !f.batchGuid && f.intakeGuid && f.intakeGuid !== currentIntakeGuid ? f.intakeGuid : undefined,
    sponsorCategoryGuid: f.sponsorCategoryGuid || undefined,
    regStatuses: f.regStatuses.length ? f.regStatuses.map(Number).sort() : undefined,
    search: search || undefined,
  }
}

// One currency line per billed currency. An all-zero line (that currency is
// paid; the student owes in another) is hidden — the row still shows the rest.
function owingLines(r: OutstandingReportRow): OutstandingAmounts[] {
  const owing = r.amounts.filter(a => a.totalOutstanding !== 0 || a.fee !== 0)
  return owing.length ? owing : r.amounts
}

function AmountLines({ lines, field, strong }: { lines: OutstandingAmounts[]; field: keyof Omit<OutstandingAmounts, 'currencyCode'>; strong?: boolean }) {
  return (
    <>
      {lines.map(a => (
        <div key={a.currencyCode} className="rpt-line">
          <span className={strong ? 'rpt-amt' : undefined}>{fmtReportAmount(a[field])}</span><span className="rpt-cur">{a.currencyCode}</span>
        </div>
      ))}
    </>
  )
}

export default function OutstandingReportPage() {
  // ── Filter dropdowns ────────────────────────────────────────────────────
  const intakesQuery = useIntakesDropdown()
  const currentIntakeGuid = intakesQuery.data?.find(i => i.currentIntake)?.intakeGuid ?? ''

  const [form, setForm] = useState<FormState>(() => emptyForm(''))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [filtersOpen, setFiltersOpen] = useState(true)
  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => (prev[k] ? { ...prev, [k]: '' } : prev))
  }

  // Preselect the current intake once the list arrives (only if the user
  // hasn't picked one meanwhile).
  useEffect(() => {
    if (currentIntakeGuid) setForm(prev => (prev.intakeGuid ? prev : { ...prev, intakeGuid: currentIntakeGuid }))
  }, [currentIntakeGuid])

  // Campus, intake and sponsor load on page open; the rest cascade.
  const campusesQuery = useQuery({ queryKey: ['academic', 'campus', 'dropdown'], queryFn: getCampusDropdown })
  const sponsorsQuery = useQuery({ queryKey: ['students', 'sponsor-categories', 'all'], queryFn: () => getSponsorCategories(1, 100) })
  const programsQuery = useQuery({
    queryKey: ['academic', 'program-master', 'by-campus', form.campusGuid],
    queryFn: () => getProgramMastersByCampus(form.campusGuid),
    enabled: !!form.campusGuid,
  })
  const semestersQuery = useQuery({
    queryKey: ['academic', 'semesters', 'for-program', form.programGuid],
    queryFn: () => getSemestersForProgram(form.programGuid),
    enabled: !!form.programGuid,
  })
  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches', 'dropdown', form.programGuid, form.semesterGuid],
    queryFn: () => getBatchDropdown(form.programGuid, form.semesterGuid),
    enabled: !!form.programGuid && !!form.semesterGuid,
  })

  const campusOptions = useMemo(() => (campusesQuery.data ?? []).map(c => ({ value: c.campusGuid, label: c.campusName })), [campusesQuery.data])
  const programOptions = useMemo(() => (programsQuery.data ?? []).map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` })), [programsQuery.data])
  const semesterOptions = useMemo(() => (semestersQuery.data ?? []).map(s => ({ value: s.semesterGuid, label: s.semName })), [semestersQuery.data])
  const batchOptions = useMemo(() => (batchesQuery.data ?? []).map(b => ({ value: b.batchGuid, label: b.batchCode })), [batchesQuery.data])
  const intakeOptions = useMemo(() => (intakesQuery.data ?? []).map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}${i.currentIntake ? ' (current)' : ''}` })), [intakesQuery.data])
  const sponsorOptions = useMemo(() => (sponsorsQuery.data?.items ?? []).map(s => ({ value: s.sponsorCategoryGuid, label: s.category })), [sponsorsQuery.data])

  // Changing a level clears everything below it.
  function pickCampus(v: string) { setForm(prev => ({ ...prev, campusGuid: v, programGuid: '', semesterGuid: '', batchGuid: '' })) }
  function pickProgram(v: string) { setForm(prev => ({ ...prev, programGuid: v, semesterGuid: '', batchGuid: '' })) }
  function pickSemester(v: string) { setForm(prev => ({ ...prev, semesterGuid: v, batchGuid: '' })) }

  // ── Process: the saved copy of the filters ──────────────────────────────
  // Every later page and the export reuse THIS, not the live form.
  const [saved, setSaved] = useState<OutstandingReportFilters | null>(null)
  const [savedForm, setSavedForm] = useState<FormState | null>(null)
  const [runId, setRunId] = useState(0)

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (form.search.trim().length > OUTSTANDING_REPORT_MAX_SEARCH) e.search = `Search can be at most ${OUTSTANDING_REPORT_MAX_SEARCH} characters`
    setErrors(e)
    if (Object.keys(e).length) { scrollToFirstError(e); return false }
    return true
  }

  function handleProcess() {
    if (!validate()) return
    setSaved(toFilters(form, currentIntakeGuid))
    setSavedForm(form)
    setRunId(r => r + 1)
    setFiltersOpen(false)
  }

  function handleReset() { setForm(emptyForm(currentIntakeGuid)); setErrors({}) }

  // ── Preview: page 1 with summary, then infinite scroll ──────────────────
  const preview = useInfiniteQuery({
    queryKey: ['finance', 'outstanding-report', runId, saved],
    queryFn: ({ pageParam }) => getOutstandingReportPreview(saved as OutstandingReportFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.rows.items.length, 0)
      return loaded < last.rows.totalCount && last.rows.items.length > 0 ? all.length + 1 : undefined
    },
    enabled: !!saved,
    gcTime: 0,
  })

  const pages = preview.data?.pages ?? []
  const rows: OutstandingReportRow[] = useMemo(() => pages.flatMap(p => p.rows.items), [pages])
  const summary = pages[0]?.summary ?? null
  const totalCount = pages[0]?.rows.totalCount ?? 0
  const hasResult = pages.length > 0
  const isEmpty = hasResult && totalCount === 0
  const firstPageFailed = preview.isError && !hasResult
  const nextPageFailed = preview.isFetchNextPageError
  const processing = preview.isFetching && !preview.isFetchingNextPage

  // Next page as the sentinel nears the bottom — never while a request is
  // running (each takes ~3 s here), never automatically after a failure.
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
    if (!savedForm) return []
    const f = savedForm
    const label = (opts: { value: string; label: string }[], v: string) => opts.find(o => o.value === v)?.label ?? 'Selected'
    const chips: { label: string; value: string }[] = []
    if (f.campusGuid) chips.push({ label: 'Campus', value: label(campusOptions, f.campusGuid) })
    if (f.programGuid) chips.push({ label: 'Programme', value: label(programOptions, f.programGuid) })
    if (f.semesterGuid) chips.push({ label: 'Semester', value: label(semesterOptions, f.semesterGuid) })
    if (f.batchGuid) chips.push({ label: 'Batch', value: label(batchOptions, f.batchGuid) })
    else chips.push({ label: 'Intake', value: f.intakeGuid ? label(intakeOptions, f.intakeGuid) : 'Current intake' })
    if (f.sponsorCategoryGuid) chips.push({ label: 'Sponsor', value: label(sponsorOptions, f.sponsorCategoryGuid) })
    const statuses = f.regStatuses.length ? f.regStatuses : DEFAULT_STATUS_VALUES
    chips.push({ label: 'Status', value: statuses.map(s => STATUS_OPTIONS.find(o => o.value === s)?.label ?? s).join(', ') })
    if (f.search.trim()) chips.push({ label: 'Search', value: `“${f.search.trim()}”` })
    return chips
  }, [savedForm, campusOptions, programOptions, semesterOptions, batchOptions, intakeOptions, sponsorOptions])

  const COLS = 15

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Outstanding Report</div>
          <div className="pg-sub">Students who still owe fees · billed, paid, discount and balance for the current semester, plus arrears, per currency</div>
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
                <label className="lbl">Campus</label>
                <SearchSelect placeholder="All campuses" options={campusOptions} value={form.campusGuid} onChange={pickCampus} isLoading={campusesQuery.isLoading} />
              </div>
              <div className="fg m-0">
                <label className="lbl">Programme</label>
                <SearchSelect placeholder={form.campusGuid ? 'All programmes' : 'Choose a campus first'} options={programOptions} value={form.programGuid} onChange={pickProgram} disabled={!form.campusGuid} isLoading={programsQuery.isFetching} />
              </div>
              <div className="fg m-0">
                <label className="lbl">Semester</label>
                <SearchSelect placeholder={form.programGuid ? 'All semesters' : 'Choose a programme first'} options={semesterOptions} value={form.semesterGuid} onChange={pickSemester} disabled={!form.programGuid} isLoading={semestersQuery.isFetching} />
              </div>
              <div className="fg m-0">
                <label className="lbl">Batch</label>
                <SearchSelect placeholder={form.semesterGuid ? 'All batches' : 'Choose a semester first'} options={batchOptions} value={form.batchGuid} onChange={v => setField('batchGuid', v)} disabled={!form.semesterGuid} isLoading={batchesQuery.isFetching} />
              </div>
              <div className="fg m-0">
                <label className="lbl">Intake</label>
                {/* A chosen batch decides who is checked, so the intake is
                    ignored then — disabled to say so. */}
                <SearchSelect placeholder="Current intake" options={intakeOptions} value={form.batchGuid ? '' : form.intakeGuid} onChange={v => setField('intakeGuid', v)} disabled={!!form.batchGuid} isLoading={intakesQuery.isLoading} />
                {form.batchGuid && <p className="text-g400" style={{ fontSize: 12, marginTop: 4 }}>The chosen batch decides who is checked.</p>}
              </div>
              <div className="fg m-0">
                <label className="lbl">Sponsor</label>
                <SearchSelect placeholder="All sponsors" options={sponsorOptions} value={form.sponsorCategoryGuid} onChange={v => setField('sponsorCategoryGuid', v)} isLoading={sponsorsQuery.isLoading} />
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Status</label>
                <MultiSelect placeholder="Registered, Yet to Register, Yet to Clear" options={STATUS_OPTIONS} value={form.regStatuses} onChange={v => setField('regStatuses', v)} />
              </div>
              <div className="fg m-0 span2">
                <label className="lbl" htmlFor="rpt-search">Search</label>
                <div className="inp-wrap">
                  <i className="lni lni-search-alt inp-icon" aria-hidden="true" />
                  <input
                    id="rpt-search"
                    className="ctrl"
                    placeholder="Reg no or name…"
                    maxLength={OUTSTANDING_REPORT_MAX_SEARCH}
                    value={form.search}
                    onChange={e => setField('search', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !processing) handleProcess() }}
                    style={errors.search ? { borderColor: 'var(--red)' } : undefined}
                  />
                </div>
                {errors.search && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.search}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-g400 mr-auto" style={{ fontSize: 'var(--fs-sm)' }}>Every filter is optional. Empty checks the current intake with the default statuses.</span>
              <button type="button" className="btn btn-neu btn-sm" onClick={handleReset}>Reset</button>
              {/* Page 1 takes several seconds on a whole intake: loading state,
                  and disabled until the response arrives. */}
              <button type="button" className="btn btn-primary btn-sm" onClick={handleProcess} disabled={processing} aria-busy={processing}>
                <i className={`lni ${processing ? 'lni-spinner-arrow spin' : 'lni-play'}`} aria-hidden="true" /> {processing ? 'Processing…' : 'Process'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-g500" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Showing</span>
            <div className="rpt-recap" style={{ flex: 1 }}>
              {recap.map(c => <span key={c.label} className="rpt-chip"><span className="rpt-chip-lbl">{c.label}</span>{c.value}</span>)}
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
            <div style={{ fontSize: 13 }}>Students who still owe fees appear here, with totals per currency.</div>
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
            <div style={{ fontSize: 13 }}>This can take several seconds for a whole intake.</div>
          </div>
        ) : isEmpty ? (
          <div className="rpt-empty">
            <i className="lni lni-checkmark-circle" aria-hidden="true" />
            <div className="rpt-empty-title">No students with outstanding fees for these filters</div>
            <div style={{ fontSize: 13 }}>Try another intake, more statuses or fewer filters.</div>
          </div>
        ) : (
          <>
            <div className="rpt-results-hdr">
              <div className="rpt-count">
                <strong>{fmtReportCount(summary?.totalStudents ?? totalCount)}</strong> students
              </div>
              <ReportExportControls
                resetKey={runId}
                mockFileName="Outstanding_Fee_Report.xlsx"
                startExport={() => exportOutstandingReport(saved)}
              />
            </div>

            <ScrollTable className="rpt-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Student No</th><th>Student Name</th><th>Campus</th><th>Programme</th><th>Semester</th>
                    <th>Batch</th><th>Sponsor</th><th>Status</th><th>Currency</th>
                    <th className="num">Fee</th><th className="num">Paid</th><th className="num">Discount</th>
                    <th className="num">Outstanding</th><th className="num">Previous Outstanding</th><th className="num">Total Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    // A student billed in two currencies shows two lines in
                    // the amount cells; the student columns appear once.
                    const lines = owingLines(r)
                    return (
                      <tr key={r.studentGuid}>
                        <td className="rpt-mono">{r.studentNumber}</td>
                        <td>{r.studentName}</td>
                        <td>{r.campusCode}</td>
                        <td>{r.programName}</td>
                        <td>{r.semesterName}</td>
                        <td className="rpt-mono">{r.batchCode}</td>
                        <td>{r.sponsorCategory}</td>
                        <td><span className="badge badge-grey">{r.regStatusName}</span></td>
                        <td>{lines.map(a => <div key={a.currencyCode} className="rpt-line">{a.currencyCode}</div>)}</td>
                        <td className="num"><AmountLines lines={lines} field="fee" /></td>
                        <td className="num"><AmountLines lines={lines} field="paid" /></td>
                        <td className="num"><AmountLines lines={lines} field="discount" /></td>
                        <td className="num"><AmountLines lines={lines} field="outstanding" /></td>
                        <td className="num"><AmountLines lines={lines} field="previousOutstanding" /></td>
                        <td className="num"><AmountLines lines={lines} field="totalOutstanding" strong /></td>
                      </tr>
                    )
                  })}
                  <tr ref={sentinelRef} className="rpt-foot-row">
                    <td colSpan={COLS}>
                      {nextPageFailed ? (
                        <span className="inline-flex items-center gap-3">
                          <span style={{ color: 'var(--red)' }}>Couldn’t load more students.</span>
                          <button className="btn btn-neu btn-sm" onClick={() => preview.fetchNextPage()}><i className="lni lni-reload" aria-hidden="true" /> Retry</button>
                        </span>
                      ) : preview.hasNextPage ? (
                        <span className="inline-flex items-center gap-2"><i className="lni lni-spinner-arrow spin" aria-hidden="true" /> Loading more…</span>
                      ) : (
                        <span>End of report · {fmtReportCount(rows.length)} students</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollTable>

            {/* Pinned summary from page 1. Built from the currencies in the
                response (not a fixed list); never added across currencies,
                and student counts aren't summed either. */}
            {summary && (
              <ReportCurrencySummary
                title="Summary by currency"
                note="Totals per programme are in the Excel file"
                rows={summary.byCurrency}
                columns={[
                  { label: 'Students', value: c => fmtReportCount(c.studentCount) },
                  { label: 'Fee', value: c => fmtReportAmount(c.fee) },
                  { label: 'Paid', value: c => fmtReportAmount(c.paid) },
                  { label: 'Discount', value: c => fmtReportAmount(c.discount) },
                  { label: 'Outstanding', value: c => fmtReportAmount(c.outstanding) },
                  { label: 'Previous', value: c => fmtReportAmount(c.previousOutstanding) },
                  { label: 'Total outstanding', value: c => fmtReportAmount(c.totalOutstanding), key: true },
                ]}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
