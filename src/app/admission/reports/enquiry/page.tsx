'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { MultiSelect } from '@/components/MultiSelect'
import DatePicker from '@/components/DatePicker'
import { ReportExportControls } from '@/components/finance/ReportExportControls'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { scrollToFirstError } from '@/lib/scrollToFirstError'
import { getEmployeeDropdown } from '@/lib/api/employee/employee'
import {
  ENQUIRY_REPORT_MAX_ADVISORS, ENQUIRY_REPORT_MAX_INTAKES, ENQUIRY_REPORT_MAX_STATUSES, NOT_ASSIGNED,
  EnquiryReportFilters, EnquiryReportRow,
  exportEnquiryReport, getEnquiryReportPreview, getEnquiryStatusDropdown, getFollowUpStatusDropdown,
} from '@/lib/api/admission/enquiryReport'
import { fmtReportCount, fmtReportDate, reportErrorMessage } from '@/lib/reportFormat'

// Enquiry Report — erp-docs/pages/admission/enquiry-report-page.md.
// Works like the finance report pages: Process → page 1 (summary + 15 rows)
// → infinite scroll (includeSummary=false) → Export to Excel in the
// background, delivered through the shared Downloads list.

interface FormState {
  intakeGuids: string[]
  fromDate: string
  toDate: string
  enquiryStatusGuids: string[]
  followUpStatusGuids: string[]
  advisorGuids: string[]
}
const EMPTY_FORM: FormState = { intakeGuids: [], fromDate: '', toDate: '', enquiryStatusGuids: [], followUpStatusGuids: [], advisorGuids: [] }

function toFilters(f: FormState): EnquiryReportFilters {
  return {
    intakeGuids: f.intakeGuids,
    fromDate: f.fromDate || undefined,
    toDate: f.toDate || undefined,
    enquiryStatusGuids: f.enquiryStatusGuids.length ? f.enquiryStatusGuids : undefined,
    followUpStatusGuids: f.followUpStatusGuids.length ? f.followUpStatusGuids : undefined,
    advisorGuids: f.advisorGuids.length ? f.advisorGuids : undefined,
  }
}

// Empty status → "—" (many enquiries have none yet).
function statusText(s: string | null) { return s?.trim() ? s : '—' }

export default function EnquiryReportPage() {
  // ── Filter dropdowns (step 1) ───────────────────────────────────────────
  const intakesQuery = useIntakesDropdown()
  const enquiryStatusesQuery = useQuery({ queryKey: ['admissions', 'enquiry-statuses', 'dropdown'], queryFn: getEnquiryStatusDropdown })
  const followUpStatusesQuery = useQuery({ queryKey: ['admissions', 'follow-up-statuses', 'dropdown'], queryFn: getFollowUpStatusDropdown })
  const employeesQuery = useQuery({ queryKey: ['users', 'employees', 'dropdown'], queryFn: getEmployeeDropdown })

  const intakeOptions = useMemo(() => (intakesQuery.data ?? []).map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}${i.currentIntake ? ' (current)' : ''}` })), [intakesQuery.data])
  const enquiryStatusOptions = useMemo(() => (enquiryStatusesQuery.data ?? []).map(s => ({ value: s.enquiryStatusGuid, label: s.enquiryStatusName })), [enquiryStatusesQuery.data])
  const followUpStatusOptions = useMemo(() => (followUpStatusesQuery.data ?? []).map(s => ({ value: s.followUpStatusGuid, label: s.followUpStatusName })), [followUpStatusesQuery.data])
  const employeeOptions = useMemo(() => (employeesQuery.data ?? []).map(e => ({ value: e.employeeGuid, label: e.displayName })), [employeesQuery.data])

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

  // Process is disabled while From is after To (the calendars also block it).
  const datesInvalid = !!(form.fromDate && form.toDate && form.fromDate > form.toDate)

  // ── Process: the saved copy of the filters ──────────────────────────────
  const [saved, setSaved] = useState<EnquiryReportFilters | null>(null)
  const [savedForm, setSavedForm] = useState<FormState | null>(null)
  const [runId, setRunId] = useState(0)

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.intakeGuids.length) e.intakeGuids = 'Select at least one intake.'
    else if (form.intakeGuids.length > ENQUIRY_REPORT_MAX_INTAKES) e.intakeGuids = `Select at most ${ENQUIRY_REPORT_MAX_INTAKES} intakes (now ${form.intakeGuids.length})`
    if (datesInvalid) e.toDate = 'To date can’t be before the from date'
    if (form.enquiryStatusGuids.length > ENQUIRY_REPORT_MAX_STATUSES) e.enquiryStatusGuids = `Select at most ${ENQUIRY_REPORT_MAX_STATUSES} statuses`
    if (form.followUpStatusGuids.length > ENQUIRY_REPORT_MAX_STATUSES) e.followUpStatusGuids = `Select at most ${ENQUIRY_REPORT_MAX_STATUSES} statuses`
    if (form.advisorGuids.length > ENQUIRY_REPORT_MAX_ADVISORS) e.advisorGuids = `Select at most ${ENQUIRY_REPORT_MAX_ADVISORS} staff (now ${form.advisorGuids.length})`
    setErrors(e)
    if (Object.keys(e).length) { scrollToFirstError(e); return false }
    return true
  }

  function handleProcess() {
    if (!validate()) return
    setSaved(toFilters(form))
    setSavedForm(form)
    setRunId(r => r + 1)
    setFiltersOpen(false)
  }

  function handleReset() {
    setForm({ ...EMPTY_FORM, intakeGuids: currentIntakeGuid ? [currentIntakeGuid] : [] })
    setErrors({})
  }

  // ── Preview: page 1 with summary, then infinite scroll ──────────────────
  const preview = useInfiniteQuery({
    queryKey: ['admissions', 'enquiry-report', runId, saved],
    queryFn: ({ pageParam }) => getEnquiryReportPreview(saved as EnquiryReportFilters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.rows.items.length, 0)
      return loaded < last.rows.totalCount && last.rows.items.length > 0 ? all.length + 1 : undefined
    },
    enabled: !!saved,
    gcTime: 0,
  })

  const pages = preview.data?.pages ?? []
  const rows: EnquiryReportRow[] = useMemo(() => pages.flatMap(p => p.rows.items), [pages])
  const summary = pages[0]?.summary ?? null
  const totalCount = pages[0]?.rows.totalCount ?? 0
  const hasResult = pages.length > 0
  const isEmpty = hasResult && totalCount === 0
  const firstPageFailed = preview.isError && !hasResult
  const nextPageFailed = preview.isFetchNextPageError
  const processing = preview.isFetching && !preview.isFetchingNextPage

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
    if (f.fromDate || f.toDate) chips.push({ label: 'Dates', value: `${f.fromDate ? fmtReportDate(f.fromDate) : 'Start'} – ${f.toDate ? fmtReportDate(f.toDate) : 'Today'}` })
    if (f.enquiryStatusGuids.length) chips.push({ label: 'Enquiry status', value: many(enquiryStatusOptions, f.enquiryStatusGuids, 'statuses') })
    if (f.followUpStatusGuids.length) chips.push({ label: 'Follow-up status', value: many(followUpStatusOptions, f.followUpStatusGuids, 'statuses') })
    if (f.advisorGuids.length) chips.push({ label: 'Assigned to', value: many(employeeOptions, f.advisorGuids, 'staff') })
    return chips
  }, [savedForm, intakeOptions, enquiryStatusOptions, followUpStatusOptions, employeeOptions])

  const COLS = 13

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Enquiry Report</div>
          <div className="pg-sub">Every enquiry for the chosen intakes · who it’s assigned to, and its enquiry and follow-up status</div>
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
                <label className="lbl">From date</label>
                <DatePicker value={form.fromDate} onChange={v => setField('fromDate', v)} maxYmd={form.toDate || undefined} rangeMessage="From date can’t be after the to date" />
              </div>
              <div className="fg m-0">
                <label className="lbl">To date</label>
                <DatePicker value={form.toDate} onChange={v => setField('toDate', v)} minYmd={form.fromDate || undefined} rangeMessage="To date can’t be before the from date" hasError={!!errors.toDate || datesInvalid} />
                {(errors.toDate || datesInvalid) && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>To date can’t be before the from date</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Enquiry status</label>
                <MultiSelect placeholder="All enquiry statuses" options={enquiryStatusOptions} value={form.enquiryStatusGuids} onChange={v => setField('enquiryStatusGuids', v)} isLoading={enquiryStatusesQuery.isLoading} />
                {errors.enquiryStatusGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.enquiryStatusGuids}</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Follow-up status</label>
                <MultiSelect placeholder="All follow-up statuses" options={followUpStatusOptions} value={form.followUpStatusGuids} onChange={v => setField('followUpStatusGuids', v)} isLoading={followUpStatusesQuery.isLoading} />
                {errors.followUpStatusGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.followUpStatusGuids}</p>}
              </div>
              <div className="fg m-0 span2">
                <label className="lbl">Assigned to</label>
                <MultiSelect placeholder="All staff" options={employeeOptions} value={form.advisorGuids} onChange={v => setField('advisorGuids', v)} isLoading={employeesQuery.isLoading} />
                {form.advisorGuids.length > 0 && <p className="text-g400" style={{ fontSize: 12, marginTop: 4 }}>Only enquiries assigned to these staff — unassigned enquiries are left out.</p>}
                {errors.advisorGuids && <p className="field-err" style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>{errors.advisorGuids}</p>}
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
            <div style={{ fontSize: 13 }}>The enquiries appear here, with how many are assigned.</div>
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
            <div className="rpt-empty-title">No enquiries for these filters</div>
            <div style={{ fontSize: 13 }}>Try more intakes, a wider date range or fewer filters.</div>
          </div>
        ) : (
          <>
            <div className="rpt-results-hdr">
              <div className="rpt-count">
                <strong>{fmtReportCount(summary?.totalEnquiries ?? totalCount)}</strong> enquiries
              </div>
              <ReportExportControls
                resetKey={runId}
                mockFileName="Enquiry_Report.xlsx"
                startExport={() => exportEnquiryReport(saved)}
              />
            </div>

            <ScrollTable className="rpt-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Enquiry Code</th><th>Enquiry Date</th><th>Intake</th><th>Campus</th><th>Programme</th>
                    <th>Student Name</th><th>Mobile</th><th>Email</th><th>Enquiry Source</th><th>Assigned To</th>
                    <th>Enquiry Status</th><th>Follow-up Status</th><th>Next Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.enquiryGuid}>
                      <td className="rpt-mono">{r.enquiryCode}</td>
                      <td>{fmtReportDate(r.enquiryDate)}</td>
                      <td>{r.intakeName ?? '—'}</td>
                      <td>{r.campusName ?? '—'}</td>
                      <td>{r.programName ?? '—'}</td>
                      <td>{r.studentName}</td>
                      <td className="rpt-mono">{r.mobile ?? '—'}</td>
                      <td>{r.email ?? '—'}</td>
                      <td>{r.enquirySourceName ?? '—'}</td>
                      <td>{!r.advisorGuid || r.assignedTo === NOT_ASSIGNED
                        ? <span className="text-g400">{NOT_ASSIGNED}</span>
                        : r.assignedTo}
                      </td>
                      <td>{statusText(r.enquiryStatusName)}</td>
                      <td>{statusText(r.followUpStatusName)}</td>
                      <td>{r.nextFollowDate ? fmtReportDate(r.nextFollowDate) : '—'}</td>
                    </tr>
                  ))}
                  <tr ref={sentinelRef} className="rpt-foot-row">
                    <td colSpan={COLS}>
                      {nextPageFailed ? (
                        <span className="inline-flex items-center gap-3">
                          <span style={{ color: 'var(--red)' }}>Couldn’t load more enquiries.</span>
                          <button className="btn btn-neu btn-sm" onClick={() => preview.fetchNextPage()}><i className="lni lni-reload" aria-hidden="true" /> Retry</button>
                        </span>
                      ) : preview.hasNextPage ? (
                        <span className="inline-flex items-center gap-2"><i className="lni lni-spinner-arrow spin" aria-hidden="true" /> Loading more…</span>
                      ) : (
                        <span>End of report · {fmtReportCount(rows.length)} enquiries</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollTable>

            {/* Pinned summary from page 1: total, assigned, not assigned. */}
            {/* Stat tiles: total, then assigned / not assigned with their share
                of the total, and a split bar showing the same ratio. */}
            {summary && (() => {
              const total = summary.totalEnquiries
              const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
              const stats = [
                { label: 'Total enquiries', value: total, tone: 'is-blue', share: null },
                { label: 'Assigned', value: summary.assignedCount, tone: 'is-green', share: pct(summary.assignedCount) },
                { label: 'Not assigned', value: summary.notAssignedCount, tone: 'is-amber', share: pct(summary.notAssignedCount) },
              ]
              return (
                <div className="rpt-stats" role="region" aria-label="Summary">
                  <div className="rpt-stats-row">
                    {stats.map(s => (
                      <div key={s.label} className={`rpt-stat ${s.tone}`}>
                        <div className="rpt-stat-top">
                          <span className="rpt-stat-lbl">{s.label}</span>
                          {s.share != null && <span className="rpt-stat-pct">{s.share}%</span>}
                        </div>
                        <span className="rpt-stat-num">{fmtReportCount(s.value)}</span>
                        <div className="rpt-stat-bar" aria-hidden="true">
                          {s.share != null && <span style={{ width: `${s.share}%` }} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rpt-stats-foot">Counts per status and per staff are in the Excel file</div>
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}
