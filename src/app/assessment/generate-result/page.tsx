'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { Toast } from '@/components/Toast'
import { TableSearch, type TableSearchResult } from '@/components/TableSearch'
import {
  useApplyModeration,
  useDeleteResults,
  useExportResults,
  useGeneratedResults,
  useGenerateResultCourseUnits,
  useGenerateResultInit,
  useGenerateResults,
  useGenerateResultSemesters,
  usePublishResults,
  type GenerateResultResponse,
  type GenerateWarning,
  type ModerationField,
  type ResultFilters,
  type ResultOperator,
} from '@/hooks/assessment/useGenerateResult'

// Generate Result (generate-result/*.md) — port of the legacy Generate Result
// screen. The legacy page put every button in one row; here they are grouped
// by what they act on:
// - Intake actions (Generate, Publish, Withdraw, Delete) — the whole intake;
//   the programme / semester / unit / total filters are not used.
// - Show Result, Moderation, Export — exactly the rows the applied filters
//   select (the three APIs take the same filters).

const PAGE_SIZES = [10, 25, 50, 100]

const OPERATOR_OPTIONS: { value: '' | ResultOperator; label: string }[] = [
  { value: '', label: 'Any' },
  { value: '=', label: '=' },
  { value: '<>', label: '≠' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
]

interface Draft {
  intakeGuid: string
  programGuid: string
  semesterGuid: string
  courseUnitGuid: string
  iaOperator: '' | ResultOperator
  iaValue: string
  ueOperator: '' | ResultOperator
  ueValue: string
  studentName: string
}

const EMPTY_DRAFT: Omit<Draft, 'intakeGuid'> = {
  programGuid: '',
  semesterGuid: '',
  courseUnitGuid: '',
  iaOperator: '',
  iaValue: '',
  ueOperator: '',
  ueValue: '',
  studentName: '',
}

type ConfirmState = { title: string; body: React.ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void } | null

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// UE / UE practical are display strings: "ABS", "62.00" or null.
function UeCell({ value }: { value: string | null }) {
  if (value === null || value === '') return <span className="text-g400">—</span>
  if (value.toUpperCase() === 'ABS') return <span className="badge badge-red">ABS</span>
  const n = Number(value)
  return <>{Number.isFinite(n) ? fmt(n) : value}</>
}

function errMsg(err: unknown, fallback: string) { return (err as { message?: string } | null)?.message || fallback }

// Draft → API filters; null with a message when a total filter is half-filled.
function toFilters(d: Draft): { filters: ResultFilters } | { error: string } {
  if (!d.intakeGuid) return { error: 'Select an Academic Intake.' }
  const total = (op: '' | ResultOperator, raw: string, label: string) => {
    if (!op && raw.trim() === '') return {}
    if (!op) return { error: `Choose an operator for the ${label} filter.` }
    if (raw.trim() === '' || !Number.isInteger(Number(raw))) return { error: `Enter a whole number for the ${label} filter.` }
    return { op, value: Number(raw) }
  }
  const ia = total(d.iaOperator, d.iaValue, 'IA Total')
  if ('error' in ia) return { error: ia.error! }
  const ue = total(d.ueOperator, d.ueValue, 'UE Total')
  if ('error' in ue) return { error: ue.error! }
  const s = d.studentName.trim() || undefined
  return {
    filters: {
      intakeGuid: d.intakeGuid,
      programGuid: d.programGuid || undefined,
      semesterGuid: d.semesterGuid || undefined,
      courseUnitGuid: d.courseUnitGuid || undefined,
      iaOperator: ia.op, iaValue: ia.value,
      ueOperator: ue.op, ueValue: ue.value,
      studentName: s,
      search: s,
    },
  }
}

function warningText(w: GenerateWarning) {
  if (typeof w === 'string') return { unit: null, message: w, rows: null }
  const unit = [w.unitCode, w.unitName].filter(Boolean).join(' · ') || null
  return { unit, message: w.message ?? '', rows: w.rowCount ?? null }
}

export default function GenerateResultPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 4500) }

  // ── Dropdowns ────────────────────────────────────────────────────────────
  const { data: init, isLoading: initLoading } = useGenerateResultInit()
  const intakes = useMemo(() => init?.intakes ?? [], [init])
  const programs = init?.programs ?? []

  const [draft, setDraft] = useState<Draft>({ intakeGuid: '', ...EMPTY_DRAFT })
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))

  useEffect(() => {
    if (draft.intakeGuid || !intakes.length) return
    set('intakeGuid', (intakes.find(i => i.currentIntake) ?? intakes[intakes.length - 1]).intakeGuid)
  }, [intakes, draft.intakeGuid])

  const { data: semesters = [], isFetching: semLoading } = useGenerateResultSemesters(draft.programGuid)
  const { data: units = [], isFetching: unitsLoading } = useGenerateResultCourseUnits(draft.programGuid, draft.semesterGuid)

  const intake = intakes.find(i => i.intakeGuid === draft.intakeGuid)
  const intakeLabel = intake ? `${intake.description} (${intake.intakeCode})` : 'the selected intake'

  // ── Applied filters (Show Result) ────────────────────────────────────────
  // The grid, moderation and export use the filters applied with Show
  // Result — never the half-edited draft — so they act on the rows shown.
  const [applied, setApplied] = useState<ResultFilters | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // ── Table Search (Results Table Filter) ──────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      if (trimmed !== search) {
        setSearch(trimmed)
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search])

  const draftResult = toFilters(draft)
  const draftFilters = 'filters' in draftResult ? draftResult.filters : null
  const filtersChanged = !!applied && (
    draft.programGuid !== (applied.programGuid || '') ||
    draft.semesterGuid !== (applied.semesterGuid || '') ||
    draft.courseUnitGuid !== (applied.courseUnitGuid || '') ||
    draft.iaOperator !== (applied.iaOperator || '') ||
    draft.iaValue !== (applied.iaValue !== undefined ? String(applied.iaValue) : '') ||
    draft.ueOperator !== (applied.ueOperator || '') ||
    draft.ueValue !== (applied.ueValue !== undefined ? String(applied.ueValue) : '')
  )

  function changeIntake(v: string) {
    set('intakeGuid', v)
    setApplied(null) // grid belongs to one intake
    setSearchInput('')
    setSearch('')
  }

  function showResult() {
    const r = toFilters(draft)
    if ('error' in r) { showToast(r.error, 'error'); return }
    setApplied(r.filters)
    const term = draft.studentName.trim()
    setSearchInput(term)
    setSearch(term)
    setPage(1)
  }

  function resetFilters() {
    setDraft(d => ({ ...d, ...EMPTY_DRAFT }))
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  function handleTableSearchChange(val: string) {
    setSearchInput(val)
    setDraft(d => ({ ...d, studentName: val }))
  }

  function clearSearch() {
    setSearchInput('')
    setSearch('')
    setDraft(d => ({ ...d, studentName: '' }))
    setPage(1)
  }

  const effectiveFilters = useMemo<ResultFilters | null>(() => {
    if (!applied) return null
    const term = search.trim()
    return {
      ...applied,
      ...(term ? { search: term, studentName: term } : { search: undefined, studentName: undefined }),
    }
  }, [applied, search])

  // When filtering by student name, request a larger page size (200) from server so that
  // if the backend returns unfiltered rows, client-side filtering can inspect the full batch
  const isSearchActive = !!search.trim()
  const fetchPageSize = isSearchActive ? Math.max(pageSize, 200) : pageSize
  const fetchPage = isSearchActive ? 1 : page
  const resultsQuery = useGeneratedResults(effectiveFilters, fetchPage, fetchPageSize)
  const rawRows = resultsQuery.data?.items ?? []

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rawRows
    return rawRows.filter(r =>
      (r.studentName && r.studentName.toLowerCase().includes(q)) ||
      (r.studentNum && r.studentNum.toLowerCase().includes(q)) ||
      (r.programCode && r.programCode.toLowerCase().includes(q)) ||
      (r.unitCode && r.unitCode.toLowerCase().includes(q)) ||
      (r.unitName && r.unitName.toLowerCase().includes(q))
    )
  }, [rawRows, search])

  const totalCount = isSearchActive ? filteredRows.length : (resultsQuery.data?.totalCount ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Sliced page rows when client-filtering, or rawRows when server-paginated
  const rows = useMemo(() => {
    if (!isSearchActive) return rawRows
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [isSearchActive, rawRows, filteredRows, page, pageSize])

  const searchResults: TableSearchResult[] = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    if (!q || !rawRows.length) return []
    const seen = new Set<string>()
    const items: TableSearchResult[] = []
    for (const r of rawRows) {
      const primary = r.studentName || r.studentNum || ''
      if (!primary || seen.has(primary)) continue
      const match =
        (r.studentName && r.studentName.toLowerCase().includes(q)) ||
        (r.studentNum && r.studentNum.toLowerCase().includes(q))
      if (match) {
        seen.add(primary)
        items.push({
          id: r.examResultGuid,
          primary,
          secondary: [r.studentNum, r.programCode, r.unitCode].filter(Boolean).join(' · '),
        })
        if (items.length >= 8) break
      }
    }
    return items
  }, [rawRows, searchInput])

  // ── Actions ──────────────────────────────────────────────────────────────
  const generateMut = useGenerateResults()
  const publishMut = usePublishResults()
  const deleteMut = useDeleteResults()
  const moderateMut = useApplyModeration()
  const exportMut = useExportResults()
  const busy = generateMut.isPending || publishMut.isPending || deleteMut.isPending || moderateMut.isPending

  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [generated, setGenerated] = useState<GenerateResultResponse | null>(null)

  function doGenerate() {
    if (!draft.intakeGuid) { showToast('Select an Academic Intake.', 'error'); return }
    setConfirm({
      title: 'Generate results?',
      body: <>Results will be generated for <strong>every registered student</strong> of <strong>{intakeLabel}</strong>. The programme, semester and unit filters are not used. This can be done once per intake.</>,
      confirmLabel: 'Generate',
      onConfirm: () => generateMut.mutate(draft.intakeGuid, {
        onSuccess: res => {
          setGenerated(res)
          // Show the new results straight away and ensure applied state is updated
          const term = draft.studentName?.trim() || ''
          setApplied({
            intakeGuid: draft.intakeGuid,
            ...(draft.programGuid ? { programGuid: draft.programGuid } : {}),
            ...(draft.semesterGuid ? { semesterGuid: draft.semesterGuid } : {}),
            ...(draft.courseUnitGuid ? { courseUnitGuid: draft.courseUnitGuid } : {}),
            ...(term ? { studentName: term, search: term } : {}),
          })
          setSearchInput(term)
          setSearch(term)
          setPage(1)
        },
        onError: err => showToast(errMsg(err, 'Could not generate the results.'), 'error'),
      }),
    })
  }

  function doPublish(publish: boolean) {
    if (!draft.intakeGuid) { showToast('Select an Academic Intake.', 'error'); return }
    setConfirm({
      title: publish ? 'Publish results to students?' : 'Withdraw results from students?',
      body: publish
        ? <>Every result of <strong>{intakeLabel}</strong> becomes visible to students. Published results can&apos;t be deleted until they are withdrawn.</>
        : <>Students of <strong>{intakeLabel}</strong> will no longer see these results.</>,
      confirmLabel: publish ? 'Publish' : 'Withdraw',
      onConfirm: () => publishMut.mutate({ intakeGuid: draft.intakeGuid, publish }, {
        onSuccess: res => showToast(res.isPublished
          ? `Result published to students (${res.rowsUpdated.toLocaleString()} rows).`
          : `Result withdrawn from students (${res.rowsUpdated.toLocaleString()} rows).`, 'success'),
        onError: err => showToast(errMsg(err, 'Could not update the publish state.'), 'error'),
      }),
    })
  }

  function doDelete() {
    if (!draft.intakeGuid) { showToast('Select an Academic Intake.', 'error'); return }
    setConfirm({
      title: 'Delete generated results?',
      body: <>All generated results of <strong>{intakeLabel}</strong> will be deleted so they can be generated again, including any moderation applied. Published results can&apos;t be deleted.</>,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteMut.mutate(draft.intakeGuid, {
        onSuccess: res => showToast(`${res.rowsDeleted.toLocaleString()} result rows deleted.`, 'success'),
        onError: err => showToast(errMsg(err, 'Could not delete the results.'), 'error'),
      }),
    })
  }

  // ── Moderation ───────────────────────────────────────────────────────────
  const [modField, setModField] = useState<ModerationField>(1)
  const [modValue, setModValue] = useState('')

  function doModerate() {
    if (!effectiveFilters) return
    if (modValue.trim() === '' || !Number.isInteger(Number(modValue))) { showToast('Please enter Moderation value before proceeding!!', 'error'); return }
    const value = Number(modValue)
    const part = modField === 1 ? 'IA' : 'UE'
    setConfirm({
      title: `Add ${value} to the ${part} total?`,
      body: <>Moderation is applied to the <strong>{totalCount.toLocaleString()} row{totalCount === 1 ? '' : 's'}</strong> the current filters show. A total is never raised above 50% of its maximum; rows already at that limit are skipped.</>,
      confirmLabel: 'Apply moderation',
      onConfirm: () => moderateMut.mutate({ filters: effectiveFilters, field: modField, value }, {
        onSuccess: res => {
          setModValue('')
          showToast(res.rowsModerated > 0
            ? `Moderation applied to ${res.rowsModerated.toLocaleString()} of ${res.rowsMatched.toLocaleString()} rows${res.rowsSkipped ? ` (${res.rowsSkipped.toLocaleString()} skipped at the limit)` : ''}.`
            : 'No rows were changed.', res.rowsModerated > 0 ? 'success' : 'warn')
        },
        onError: err => showToast(errMsg(err, 'Could not apply the moderation.'), 'error'),
      }),
    })
  }

  // ── Export ───────────────────────────────────────────────────────────────
  function doExport() {
    if (!effectiveFilters) return
    exportMut.mutate(effectiveFilters, {
      onSuccess: res => {
        const a = document.createElement('a')
        a.href = res.url
        a.download = `Exam_Result_${intake?.intakeCode ?? ''}.xlsx`
        a.target = '_blank'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      },
      onError: err => showToast(errMsg(err, 'Could not export the results.'), 'error'),
    })
  }

  const programOptions = [{ value: '', label: 'All programmes' }, ...programs.map(p => ({ value: p.programGuid, label: `${p.programName} (${p.programCode})` }))]
  const semesterOptions = [{ value: '', label: 'All semesters' }, ...semesters.map(s => ({ value: s.semesterGuid, label: s.semName }))]
  const unitOptions = [{ value: '', label: 'All course units' }, ...units.map(u => ({ value: u.courseUnitGuid, label: `${u.unitCode} - ${u.unitName}` }))]

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Generate Result</div>
            <div className="pg-sub">Generate, moderate and publish the exam results of an academic intake</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ padding: 20 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="fg mb-0">
              <label className="lbl">Academic Intake <span className="req">*</span></label>
              <SearchSelect
                placeholder={initLoading ? 'Loading…' : 'Select academic intake'}
                options={intakes.map(i => ({ value: i.intakeGuid, label: `${i.description} (${i.intakeCode})` }))}
                value={draft.intakeGuid}
                onChange={changeIntake}
                disabled={initLoading}
              />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Programme</label>
              <SearchSelect
                options={programOptions}
                value={draft.programGuid}
                onChange={v => setDraft(d => ({ ...d, programGuid: v, semesterGuid: '', courseUnitGuid: '' }))}
                disabled={initLoading}
              />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Semester</label>
              <SearchSelect
                options={semesterOptions}
                value={draft.semesterGuid}
                onChange={v => setDraft(d => ({ ...d, semesterGuid: v, courseUnitGuid: '' }))}
                disabled={!draft.programGuid || semLoading}
              />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Course Unit</label>
              <SearchSelect
                options={unitOptions}
                value={draft.courseUnitGuid}
                onChange={v => set('courseUnitGuid', v)}
                disabled={!draft.semesterGuid || unitsLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr_auto] gap-4 items-end mt-4">
            {(['ia', 'ue'] as const).map(k => (
              <div className="fg mb-0" key={k}>
                <label className="lbl">{k === 'ia' ? 'IA Total' : 'UE Total'}</label>
                <div className="flex gap-2">
                  <div style={{ width: 96, flexShrink: 0 }}>
                    <SearchSelect
                      options={OPERATOR_OPTIONS}
                      value={draft[`${k}Operator`]}
                      onChange={v => setDraft(d => ({ ...d, [`${k}Operator`]: v as '' | ResultOperator, ...(v === '' ? { [`${k}Value`]: '' } : {}) }))}
                    />
                  </div>
                  <input
                    className="ctrl"
                    type="number"
                    step={1}
                    placeholder={draft[`${k}Operator`] ? 'Marks' : 'Any total'}
                    value={draft[`${k}Value`]}
                    disabled={!draft[`${k}Operator`]}
                    onChange={e => set(`${k}Value`, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') showResult() }}
                  />
                </div>
              </div>
            ))}
            <div className="fg mb-0">
              <label className="lbl">Student Name / Number</label>
              <input
                className="ctrl"
                placeholder="Search by student name or number…"
                value={draft.studentName}
                onChange={e => set('studentName', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') showResult() }}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-neu" onClick={resetFilters}><i className="lni lni-reload"></i> Reset</button>
              <button className="btn btn-primary" onClick={showResult} disabled={!draft.intakeGuid}><i className="lni lni-search-alt"></i> Show Result</button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="card" style={{ padding: 20, marginBottom: 0 }}>
            <div className="card-title mb-1"><span className="ctitle-icon"><i className="lni lni-cogs"></i></span> Intake Actions</div>
            <div className="text-xs text-g500 mb-4">
              Applies to the whole of <strong>{intakeLabel}</strong>; the programme, semester, unit and total filters are not used.
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={doGenerate} disabled={busy || !draft.intakeGuid}>
                <i className="lni lni-bolt"></i> {generateMut.isPending ? 'Generating…' : 'Generate Result'}
              </button>
              <button className="btn btn-neu" onClick={() => doPublish(true)} disabled={busy || !draft.intakeGuid}>
                <i className="lni lni-eye"></i> Publish
              </button>
              <button className="btn btn-neu" onClick={() => doPublish(false)} disabled={busy || !draft.intakeGuid}>
                <i className="lni lni-close"></i> Withdraw
              </button>
              <button className="btn btn-neu" style={{ color: 'var(--red)' }} onClick={doDelete} disabled={busy || !draft.intakeGuid}>
                <i className="lni lni-trash-can"></i> {deleteMut.isPending ? 'Deleting…' : 'Delete Result'}
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 20, marginBottom: 0 }}>
            <div className="card-title mb-1"><span className="ctitle-icon"><i className="lni lni-pencil-alt"></i></span> Apply Moderation</div>
            <div className="text-xs text-g500 mb-4">
              Adds marks to the rows the results below show, up to 50% of the maximum. A negative value lowers the total.
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="lbl">Add to</label>
                <div className="flex gap-4 mt-2">
                  {([1, 2] as const).map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="modField" checked={modField === f} onChange={() => setModField(f)} />
                      {f === 1 ? 'IA Total' : 'UE Total'}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ width: 120 }}>
                <label className="lbl">Marks</label>
                <input className="ctrl" type="number" step={1} placeholder="e.g. 5" value={modValue} onChange={e => setModValue(e.target.value)} />
              </div>
              <span title={!applied ? 'Click Show Result first.' : filtersChanged ? 'The filters changed. Click Show Result first.' : undefined}>
                <button className="btn btn-primary" onClick={doModerate} disabled={busy || !applied || filtersChanged || totalCount === 0}>
                  <i className="lni lni-checkmark"></i> {moderateMut.isPending ? 'Applying…' : 'Apply Moderation'}
                </button>
              </span>
            </div>
            {filtersChanged && (
              <div className="text-xs mt-3" style={{ color: 'var(--amber)' }}>
                <i className="lni lni-warning"></i> The filters changed since the results were shown. Click <strong>Show Result</strong> so moderation acts on the rows you see.
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon"><i className="lni lni-bar-chart"></i></span> Results
              {applied && resultsQuery.data && <span className="badge badge-grey" style={{ marginLeft: 8 }}>{totalCount.toLocaleString()}</span>}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {filtersChanged && <span className="text-xs" style={{ color: 'var(--amber)' }}>Filters changed — click Show Result</span>}
              <div className="flex items-center gap-1.5">
                <TableSearch
                  className="w-56 sm:w-64"
                  placeholder="Filter by student name…"
                  value={searchInput}
                  onChange={handleTableSearchChange}
                  disabled={!applied}
                  onEnter={() => { setSearch(searchInput.trim()); setPage(1) }}
                  results={searchResults.length > 0 ? searchResults : undefined}
                  onSelect={r => {
                    handleTableSearchChange(r.primary)
                    setSearch(r.primary)
                    setPage(1)
                  }}
                />
                {search && (
                  <button
                    className="btn btn-neu btn-sm"
                    title="Clear search"
                    onClick={clearSearch}
                  >
                    <i className="lni lni-close"></i>
                  </button>
                )}
              </div>
              <button className="btn btn-neu btn-sm" onClick={doExport} disabled={!applied || totalCount === 0 || exportMut.isPending}>
                <i className="lni lni-download"></i> {exportMut.isPending ? 'Exporting…' : 'Export to Excel'}
              </button>
            </div>
          </div>

          {!applied ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-search-alt"></i></div>
              <div className="empty-title">No results shown</div>
              <div className="empty-sub">Choose the filters and click <strong>Show Result</strong>.</div>
            </div>
          ) : resultsQuery.isError ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-title">Couldn&apos;t load results</div>
              <div className="empty-sub">{errMsg(resultsQuery.error, 'Please try again.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => resultsQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : (
            <ScrollTable className="no-sticky-col">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', width: 48 }}>#</th>
                    <th>Student</th>
                    <th>Programme</th>
                    <th style={{ textAlign: 'center' }}>Sem</th>
                    <th>Course Unit</th>
                    <th style={{ textAlign: 'right' }} title="Mid-semester class test">CT</th>
                    <th style={{ textAlign: 'right' }} title="Coursework">CW</th>
                    <th style={{ textAlign: 'right' }} title="Continuous assessment">CA</th>
                    <th style={{ textAlign: 'right' }} title="Last IA moderation applied">IA Mod</th>
                    <th style={{ textAlign: 'right' }}>IA Total</th>
                    <th style={{ textAlign: 'right' }}>UE</th>
                    <th style={{ textAlign: 'right' }} title="UE practical">UE Pr.</th>
                    <th style={{ textAlign: 'right' }} title="Last UE moderation applied">UE Mod</th>
                    <th style={{ textAlign: 'right' }}>UE Total</th>
                  </tr>
                </thead>
                <tbody style={{ opacity: resultsQuery.isFetching && !resultsQuery.isLoading ? 0.6 : 1 }}>
                  {resultsQuery.isLoading ? (
                    <TableLoadingState colSpan={14} title="Loading results..." />
                  ) : rows.length === 0 ? (
                    <EmptyState
                      colSpan={14}
                      title={isSearchActive ? 'No matching students found' : 'No results'}
                      subtitle={
                        isSearchActive
                          ? `No results match the student name or number "${search}". Try adjusting the filter or clearing it.`
                          : applied.programGuid || applied.semesterGuid || applied.courseUnitGuid || applied.iaOperator || applied.ueOperator
                          ? 'No results match the selected filters.'
                          : `No results have been generated for ${intakeLabel} yet. Use Generate Result.`
                      }
                      hasFilters={isSearchActive || !!applied.programGuid || !!applied.semesterGuid || !!applied.courseUnitGuid || !!applied.iaOperator || !!applied.ueOperator}
                      onClearFilters={
                        isSearchActive
                          ? clearSearch
                          : applied.programGuid || applied.semesterGuid || applied.courseUnitGuid || applied.iaOperator || applied.ueOperator
                          ? () => { resetFilters(); showResult() }
                          : undefined
                      }
                    />
                  ) : (
                    rows.map((r, i) => (
                      <tr key={r.examResultGuid}>
                        <td className="text-g500" style={{ textAlign: 'left' }}>{(page - 1) * pageSize + i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.studentName ?? '—'}</div>
                          <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--g500)' }}>{r.studentNum ?? '—'}</div>
                        </td>
                        <td className="font-mono" style={{ fontSize: 12.5 }}>{r.programCode ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>{r.semCode ?? '—'}</td>
                        <td style={{ maxWidth: 240 }}>
                          <div className="font-mono font-semibold" style={{ fontSize: 12.5 }}>{r.unitCode ?? '—'}</div>
                          <div className="truncate" style={{ fontSize: 11.5, color: 'var(--g500)' }} title={r.unitName ?? undefined}>{r.unitName ?? '—'}</div>
                        </td>
                        <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(r.midSem)}</td>
                        <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(r.cw1)}</td>
                        <td className="font-mono" style={{ textAlign: 'right' }}>{fmt(r.cw2)}</td>
                        <td className="font-mono" style={{ textAlign: 'right', color: r.iaMod ? 'var(--b700)' : undefined }}>{r.iaMod ? `+${fmt(r.iaMod)}` : '—'}</td>
                        <td className="font-mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{fmt(r.iaTotal)}</strong><span className="text-g400"> / {fmt(r.iaMax)}</span></td>
                        <td className="font-mono" style={{ textAlign: 'right' }}><UeCell value={r.ue} /></td>
                        <td className="font-mono" style={{ textAlign: 'right' }}><UeCell value={r.uePractical} /></td>
                        <td className="font-mono" style={{ textAlign: 'right', color: r.ueMod ? 'var(--b700)' : undefined }}>{r.ueMod ? `+${fmt(r.ueMod)}` : '—'}</td>
                        <td className="font-mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{fmt(r.ueTotal)}</strong><span className="text-g400"> / {fmt(r.ueMax)}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollTable>
          )}

          {applied && !resultsQuery.isError && totalCount > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm text-g600" style={{ paddingLeft: 16 }}>
                Show
                <select className="ctrl" style={{ width: 80, height: 32 }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                rows
              </label>
              <div style={{ flex: 1 }}>
                <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="results" onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 600 }} onClick={() => setConfirm(null)}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon" style={confirm.danger ? undefined : { background: 'var(--b50)', color: 'var(--b700)' }}>
              <i className={`lni ${confirm.danger ? 'lni-trash-can' : 'lni-question-circle'}`}></i>
            </div>
            <div className="perm-delete-title">{confirm.title}</div>
            <div className="perm-delete-sub">{confirm.body}</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => { const fn = confirm.onConfirm; setConfirm(null); fn() }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate summary */}
      {generated && (
        <div className="modal-overlay open">
          <div className="modal modal-flex" style={{ maxWidth: 620, borderRadius: 12, height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
              <div className="modal-title text-white font-medium text-base" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className={`lni ${generated.rowsGenerated > 0 ? 'lni-checkmark-circle' : 'lni-warning'}`} style={{ fontSize: 18 }}></i>
                {generated.rowsGenerated > 0 ? 'Result generated successfully' : 'No results were generated'}
              </div>
              <button className="modal-close text-white hover:text-white/80 transition-colors" onClick={() => setGenerated(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <i className="lni lni-close" style={{ fontSize: 18 }}></i>
              </button>
            </div>
            <div className="modal-scroll p-6 bg-white flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[['Rows generated', generated.rowsGenerated], ['Students', generated.studentCount], ['Course units', generated.unitCount]].map(([label, n]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <div className="text-2xl font-bold text-slate-900">{Number(n).toLocaleString()}</div>
                    <div className="text-xs text-g500 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              {generated.warnings.length > 0 ? (
                <>
                  <div className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <i className="lni lni-warning" style={{ color: 'var(--amber)' }}></i> {generated.warnings.length} warning{generated.warnings.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-xs text-g500 mb-3">These did not stop the generation. Check the affected units&apos; settings.</div>
                  <div className="flex flex-col gap-2">
                    {generated.warnings.map((w, i) => {
                      const t = warningText(w)
                      return (
                        <div key={i} className="rounded-lg px-4 py-3 text-sm" style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)' }}>
                          {t.unit && <div className="font-semibold text-slate-800">{t.unit}{t.rows !== null && <span className="font-normal text-g500"> · {t.rows} row{t.rows === 1 ? '' : 's'}</span>}</div>}
                          <div className="text-slate-700">{t.message}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="info-box"><i className="lni lni-checkmark-circle"></i><span>No warnings. Review the results, apply any moderation, then publish them to students.</span></div>
              )}
              <div className="flex justify-end mt-6 pt-5 border-t border-slate-200">
                <button className="btn btn-primary" onClick={() => setGenerated(null)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
