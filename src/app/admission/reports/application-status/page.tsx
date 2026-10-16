'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { MultiSelect } from '@/components/MultiSelect'
import DatePicker from '@/components/DatePicker'
import { ReportExportControls } from '@/components/finance/ReportExportControls'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useProgramDropdown } from '@/hooks/academic/useProgramMaster'
import { getCampusDropdown } from '@/lib/api/academic/campus'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import {
  APPLICATION_STAGES, APP_STATUS_MAX_CAMPUSES, APP_STATUS_MAX_INTAKES, APP_STATUS_MAX_PROGRAMMES, NOT_ASSIGNED, STAGE_IN_PROGRESS,
  ApplicationStatusReportFilters, ApplicationStatusRow,
  exportApplicationStatusReport, getApplicationStatusPreview,
} from '@/lib/api/admission/applicationStatusReport'
import { fmtReportCount, fmtReportDate, reportErrorMessage } from '@/lib/reportFormat'

// Application Status Report — erp-docs/pages/admission/application-status-report-page.md.
// Works like the Enquiry Report: Process → page 1 (stage counts + 15 rows) →
// infinite scroll (includeSummary=false) → Export to Excel in the background.
// The stage counts are clickable: a shortcut for Stage = that stage + Process.

interface FormState {
  intakeGuids: string[]
  fromDate: string
  toDate: string
  stages: string[]          // MultiSelect values; sent as numbers
  campusGuids: string[]
  programGuids: string[]
}
const EMPTY_FORM: FormState = { intakeGuids: [], fromDate: '', toDate: '', stages: [], campusGuids: [], programGuids: [] }
const STAGE_OPTIONS = APPLICATION_STAGES.map(s => ({ value: String(s.value), label: s.label }))

function toFilters(f: FormState): ApplicationStatusReportFilters {
  return {
    intakeGuids: f.intakeGuids,
    fromDate: f.fromDate || undefined,
    toDate: f.toDate || undefined,
    stages: f.stages.length ? f.stages.map(Number).sort((a, b) => a - b) : undefined,
    campusGuids: f.campusGuids.length ? f.campusGuids : undefined,
    programGuids: f.programGuids.length ? f.programGuids : undefined,
  }
}

// Stage 2 shows how far the form got: "Application in progress (Documents)".
function stageText(r: ApplicationStatusRow) {
  return r.stage === STAGE_IN_PROGRESS && r.formStep ? `${r.stageName} (${r.formStep})` : r.stageName
}

const STAGE_BADGE: Record<number, string> = { 3: 'badge-amber', 6: 'badge-red', 7: 'badge-green' }

export default function ApplicationStatusReportPage() {
  // ── Filter dropdowns (step 1) ───────────────────────────────────────────
  const intakesQuery = useIntakesDropdown()
  const campusesQuery = useQuery({ queryKey: ['academic', 'campus', 'dropdown'], queryFn: getCampusDropdown })
  const programsQuery = useProgramDropdown()

  const intakeOptions = useMemo(() => (intakesQuery.data ?? []).map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}${i.currentIntake ? ' (current)' : ''}` })), [intakesQuery.data])
  const campusOptions = useMemo(() => (campusesQuery.data ?? []).map(c => ({ value: c.campusGuid, label: c.campusName })), [campusesQuery.data])
  const programOptions = useMemo(() => (programsQuery.data ?? []).map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` })), [programsQuery.data])

  // ── Form ────────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [filtersOpen, setFiltersOpen] = useState(true)
  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => (prev[k] ? { ...prev, [k]: '' } : prev))
  }

  // Preselect the current intake once the list arrives (if nothing picked yet).
  const currentIntakeGuid = intakesQuery.data?.find(i => i.currentIntake)?.intakeGuid ?? ''
  useEffect(() => {
    if (currentIntakeGuid) setForm(prev => (prev.intakeGuids.length ? prev : { ...prev, intakeGuids: [currentIntakeGuid] }))
  }, [currentIntakeGuid])

  const datesInvalid = !!(form.fromDate && form.toDate && form.fromDate > form.toDate)

  // ── Process: the saved copy of the filters ──────────────────────────────
  const [saved, setSaved] = useState<ApplicationStatusReportFilters | null>(null)
  const [savedForm, setSavedForm] = useState<FormState | null>(null)
  const [runId, setRunId] = useState(0)

  function validate(f: FormState): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!f.intakeGuids.length) e.intakeGuids = 'Select at least one intake.'
    else if (f.intakeGuids.length > APP_STATUS_MAX_INTAKES) e.intakeGuids = `Select at most ${APP_STATUS_MAX_INTAKES} intakes (now ${f.intakeGuids.length})`
    if (f.fromDate && f.toDate && f.fromDate > f.toDate) e.toDate = 'To date can’t be before the from date'
    if (f.campusGuids.length > APP_STATUS_MAX_CAMPUSES) e.campusGuids = `Select at most ${APP_STATUS_MAX_CAMPUSES} campuses`
    if (f.programGuids.length > APP_STATUS_MAX_PROGRAMMES) e.programGuids = `Select at most ${APP_STATUS_MAX_PROGRAMMES} programmes (now ${f.programGuids.length})`
    setErrors(e)
    if (Object.keys(e).length) { scrollToFirstError(e); return false }
    return true
  }

  // Takes the form explicitly so a stage chip can process its own version
  // without waiting for setForm to land.
  function runProcess(f: FormState) {
    if (!validate(f)) return
    setSaved(toFilters(f))
    setSavedForm(f)
    setRunId(r => r + 1)
    setFiltersOpen(false)
  }
  function handleProcess() { runProcess(form) }

  // Stage chip: Stage filter = that stage only, then Process — on top of the
  // filters the current result was built from.
  function handleStageChip(stage: number) {
    const next = { ...(savedForm ?? form), stages: [String(stage)] }
    setForm(next)
    runProcess(next)
  }

  function handleReset() {
    setForm({ ...EMPTY_FORM, intakeGuids: currentIntakeGuid ? [currentIntakeGuid] : [] })
    setErrors({})
  }

  // ── Preview: page 1 with summary, then infinite scroll ──────────────────
  const preview = useInfiniteQuery({
    queryKey: ['admissions', 'application-status-report', runId, saved],
    queryFn: ({ pageParam }) => getApplicationStatusPreview(saved as ApplicationStatusReportFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.rows.items.length, 0)
      return loaded < last.rows.totalCount && last.rows.items.length > 0 ? all.length + 1 : undefined
    },
    enabled: !!saved,
    gcTime: 0,
  })

  const pages = preview.data?.pages ?? []
  const rows: ApplicationStatusRow[] = useMemo(() => pages.flatMap(p => p.rows.items), [pages])
  const summary = pages[0]?.summary ?? null
  const totalCount = pages[0]?.rows.totalCount ?? 0
  const hasResult = pages.length > 0
  const isEmpty = hasResult && totalCount === 0
  const firstPageFailed = preview.isError && !hasResult
  const nextPageFailed = preview.isFetchNextPageError
  const processing = preview.isFetching && !preview.isFetchingNextPage
  // The chip of a result filtered to exactly one stage is shown as active.
  const activeStage = saved?.stages?.length === 1 ? saved.stages[0] : null

  // Next page as the sentinel nears the bottom — never while a request is
  // running, never automatically after a failure (that waits for Retry).
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
    const many = (opts: { value: string; label: string }[], vals: string[], noun: string) =>
      vals.length === 1 ? (opts.find(o => o.value === vals[0])?.label ?? '1 selected') : `${vals.length} ${noun}`
    const chips: { label: string; value: string }[] = []
    chips.push({ label: 'Intakes', value: many(intakeOptions, f.intakeGuids, 'intakes') })
    if (f.fromDate || f.toDate) chips.push({ label: 'Paid', value: `${f.fromDate ? fmtReportDate(f.fromDate) : 'Start'} – ${f.toDate ? fmtReportDate(f.toDate) : 'Today'}` })
    if (f.stages.length) chips.push({ label: 'Stage', value: many(STAGE_OPTIONS, f.stages, 'stages') })
    if (f.campusGuids.length) chips.push({ label: 'Campus', value: many(campusOptions, f.campusGuids, 'campuses') })
    if (f.programGuids.length) chips.push({ label: 'Programme', value: many(programOptions, f.programGuids, 'programmes') })
    return chips
  }, [savedForm, intakeOptions, campusOptions, programOptions])

  const COLS = 10

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Application Status Report</div>
          <div className="pg-sub">Where every applicant of the chosen intakes is in the admission pipeline · from payment to registration</div>
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
              <div className="fg m-0 span2">
                <label className="lbl">Intake <span className="req">*</span></label>
                <MultiSelect placeholder="Select intakes" options={intakeOptions} value={form.intakeGuids} onChange={v => setField('intakeGuids', v)} isLoading={intakesQuery.isLoading} />
                {errors.intakeGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.intakeGuids}</p>}
              </div>
              <div className="fg m-0">
                <label className="lbl">Payment from</label>
                <DatePicker value={form.fromDate} onChange={v => setField('fromDate', v)} maxYmd={form.toDate || undefined} rangeMessage="From date can’t be after the to date" />
              </div>
              <div className="fg m-0">
                <label className="lbl">Payment to</label>
                <DatePicker value={form.toDate} onChange={v => setField('toDate', v)} minYmd={form.fromDate || undefined} rangeMessage="To date can’t be before the from date" hasError={!!errors.toDate || datesInvalid} />
                {(errors.toDate || datesInvalid) && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>To date can’t be before the from date</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Stage</label>
                <MultiSelect placeholder="All stages" options={STAGE_OPTIONS} value={form.stages} onChange={v => setField('stages', v)} />
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Campus</label>
                <MultiSelect placeholder="All campuses" options={campusOptions} value={form.campusGuids} onChange={v => setField('campusGuids', v)} isLoading={campusesQuery.isLoading} />
                {errors.campusGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.campusGuids}</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Programme</label>
                <MultiSelect placeholder="All programmes" options={programOptions} value={form.programGuids} onChange={v => setField('programGuids', v)} isLoading={programsQuery.isLoading} />
                {errors.programGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.programGuids}</p>}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-g400 mr-auto" style={{ fontSize: 'var(--fs-sm)' }}>Intake is required. Every other filter is optional.</span>
              <button type="button" className="btn btn-neu btn-sm" onClick={handleReset}>Reset</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleProcess} disabled={processing || datesInvalid} aria-busy={processing}>
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
            <div className="rpt-empty-title">Choose intakes, then Process</div>
            <div style={{ fontSize: 13 }}>Each applicant’s stage appears here, with the count per stage.</div>
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
        ) : (
          <>
            <div className="rpt-results-hdr">
              <div className="rpt-count">
                <strong>{fmtReportCount(summary?.totalApplicants ?? totalCount)}</strong> applicants
              </div>
              {!isEmpty && (
                <ReportExportControls
                  resetKey={runId}
                  mockFileName="Application_Status_Report.xlsx"
                  startExport={() => exportApplicationStatusReport(saved)}
                />
              )}
            </div>

            {/* Stage counts from page 1, in the order returned. Clicking one
                narrows the report to that stage. */}
            {summary && summary.byStage.length > 0 && (
              <div className="rpt-stage-chips" role="group" aria-label="Applicants per stage">
                {summary.byStage.map(s => (
                  <button
                    key={s.stage}
                    type="button"
                    className={`rpt-stage-chip${activeStage === s.stage ? ' active' : ''}${s.count === 0 ? ' zero' : ''}`}
                    aria-pressed={activeStage === s.stage}
                    disabled={processing}
                    onClick={() => handleStageChip(s.stage)}
                    title={`Show only “${s.stageName}”`}
                  >
                    <span className="rpt-stage-chip-name">{s.stageName}</span>
                    <span className="rpt-stage-chip-count">{fmtReportCount(s.count)}</span>
                  </button>
                ))}
              </div>
            )}

            {isEmpty ? (
              <div className="rpt-empty">
                <i className="lni lni-search-alt" aria-hidden="true" />
                <div className="rpt-empty-title">No applicants for these filters</div>
                <div style={{ fontSize: 13 }}>Try more intakes, another stage or fewer filters.</div>
              </div>
            ) : (
              <ScrollTable className="rpt-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>App Ref No</th><th>Payment Date</th><th>Student Name</th><th>Phone</th><th>Intake</th>
                      <th>Campus</th><th>Programme</th><th>Stage</th><th>Assigned To</th><th>Registrar Action On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      // Stage-1 rows have no applicationGuid; appRefNo is unique.
                      <tr key={r.applicationGuid ?? `${r.appRefNo}-${i}`}>
                        <td className="rpt-mono">{r.appRefNo}</td>
                        <td>{r.paymentDate ? fmtReportDate(r.paymentDate) : '—'}</td>
                        <td>{r.studentName}</td>
                        <td className="rpt-mono">{r.phone ?? '—'}</td>
                        <td>{r.intakeName ?? '—'}</td>
                        <td>{r.campusName ?? '—'}</td>
                        <td>{r.programName ?? '—'}</td>
                        <td><span className={`badge ${STAGE_BADGE[r.stage] ?? 'badge-blue'}`}>{stageText(r)}</span></td>
                        <td>{!r.advisorGuid || r.assignedTo === NOT_ASSIGNED
                          ? <span className="text-g400">{NOT_ASSIGNED}</span>
                          : r.assignedTo}
                        </td>
                        <td>{r.registrarActionDate ? fmtReportDate(r.registrarActionDate) : '—'}</td>
                      </tr>
                    ))}
                    <tr ref={sentinelRef} className="rpt-foot-row">
                      <td colSpan={COLS}>
                        {nextPageFailed ? (
                          <span className="inline-flex items-center gap-3">
                            <span style={{ color: 'var(--red)' }}>Couldn’t load more applicants.</span>
                            <button className="btn btn-neu btn-sm" onClick={() => preview.fetchNextPage()}><i className="lni lni-reload" aria-hidden="true" /> Retry</button>
                          </span>
                        ) : preview.hasNextPage ? (
                          <span className="inline-flex items-center gap-2"><i className="lni lni-spinner-arrow spin" aria-hidden="true" /> Loading more…</span>
                        ) : (
                          <span>End of report · {fmtReportCount(rows.length)} applicants</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </ScrollTable>
            )}
          </>
        )}
      </div>
    </div>
  )
}
