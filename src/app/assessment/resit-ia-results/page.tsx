'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { Toast } from '@/components/Toast'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useResitConfigs } from '@/hooks/assessment/useResitConfigs'
import { useCampusDropdown } from '@/hooks/config/useCampuses'
import { useResitIaResults } from '@/hooks/assessment/useResitIaResults'
import { getAllResitIaResults, type ResitIaCategory } from '@/lib/api/assessment/resitIaResults'
import { saveBlob, writeWorkbook } from '@/lib/xlsx'

// Resit IA Result (resit-ia-results/get-resit-ia-results.md) — read-only
// list of submitted resit IA marks for an academic session, filtered by
// assessment type, resit and campus. Port of the legacy "Resit IA Result"
// screen (Academic Session / Campus / Assessment Type + Students Mark List
// with Export to Excel). Export has no API of its own: it pages through the
// list endpoint and builds the workbook in the browser.

const CATEGORY_OPTIONS = [
  { value: '1', label: 'Class Test' },
  { value: '2', label: 'Course Work' },
]
const PAGE_SIZES = [10, 25, 50, 100]

function fmtMark(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

function errMsg(err: unknown, fallback: string) {
  return (err as { message?: string } | null)?.message || fallback
}

// mark / max as a small bar: red under 40%, amber 40–59%, green 60%+.
function PercentBar({ mark, max }: { mark: number | null | undefined; max: number | null | undefined }) {
  if (mark === null || mark === undefined || !max) return null
  const pct = Math.round((mark / max) * 100)
  const color = pct < 40 ? 'var(--red)' : pct < 60 ? 'var(--amber)' : 'var(--green)'
  return (
    <div className="flex items-center justify-end gap-2 mt-1">
      <div className="prog-bar-track" style={{ height: 5, width: 64 }}>
        <div className="prog-bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
      <span className="text-[11px]" style={{ color, minWidth: 34 }}>{pct}%</span>
    </div>
  )
}

export default function ResitIaResultsPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ── Filters ──────────────────────────────────────────────────────────────
  const [intakeGuid, setIntakeGuid] = useState('')
  const [category, setCategory] = useState<ResitIaCategory>(1)
  const [resitConfigGuid, setResitConfigGuid] = useState('')
  const [campusGuid, setCampusGuid] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: intakes = [], isLoading: intakesLoading } = useIntakesDropdown()
  // Preselect the current academic intake (get-intakes-dropdown.md).
  useEffect(() => {
    if (intakeGuid || !intakes.length) return
    setIntakeGuid((intakes.find(i => i.currentIntake) ?? intakes[0]).intakeGuid)
  }, [intakes, intakeGuid])
  const intakeOptions = intakes.map(i => ({ value: i.intakeGuid, label: i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode) }))

  const { data: resitConfigsData, isLoading: resitsLoading, refetch: refetchResits } = useResitConfigs(1, 50, intakeGuid || undefined)
  const resitOptions = useMemo(() => [
    { value: '', label: 'All resits' },
    ...(resitConfigsData?.items ?? []).map(r => ({ value: r.resitConfigGuid, label: r.refCode || 'Unnamed resit' })),
  ], [resitConfigsData])

  const { data: campuses = [] } = useCampusDropdown()
  const campusOptions = [{ value: '', label: 'All campuses' }, ...campuses.map(c => ({ value: c.campusGuid, label: c.campusName }))]

  useEffect(() => {
    const t = setTimeout(() => { if (searchInput.trim() !== search) { setSearch(searchInput.trim()); setPage(1) } }, 400)
    return () => clearTimeout(t)
  }, [searchInput, search])

  function changeIntake(v: string) { setIntakeGuid(v); setResitConfigGuid(''); setPage(1) }
  function changeFilter<T>(set: (v: T) => void) { return (v: T) => { set(v); setPage(1) } }

  // ── Data ─────────────────────────────────────────────────────────────────
  const baseParams = {
    intakeGuid,
    category,
    resitConfigGuid: resitConfigGuid || undefined,
    campusGuid: campusGuid || undefined,
    search: search || undefined,
  }
  const resultsQuery = useResitIaResults({ ...baseParams, page, pageSize }, !!intakeGuid)

  // 404 "Resit not found for the selected academic session": toast, reload
  // the Resit dropdown and fall back to All resits (resit-ia-result-page.md).
  const resultsNotFound = resultsQuery.isError && (resultsQuery.error as { code?: string } | null)?.code === 'not_found'
  useEffect(() => {
    if (!resultsNotFound) return
    showToast(errMsg(resultsQuery.error, 'Resit not found for the selected academic session.'), 'error')
    refetchResits()
    setResitConfigGuid('')
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsNotFound])
  const rows = resultsQuery.data?.items ?? []
  const totalCount = resultsQuery.data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const firstRow = (page - 1) * pageSize

  // ── Export ───────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  async function handleExport() {
    if (!intakeGuid || !totalCount) return
    setExporting(true)
    try {
      const all = await getAllResitIaResults(baseParams)
      const header = ['SL NO', 'STUDENT NUMBER', 'STUDENT NAME', 'PROGRAMME', 'COURSE UNIT', 'MARK SCORED', 'MAX MARK']
      const body = all.map((r, i) => [i + 1, r.studentNum ?? '', r.studentName ?? '', r.programCode ?? '', r.unitName ?? '', r.mark, r.maxMark])
      const intake = intakes.find(i => i.intakeGuid === intakeGuid)
      const type = category === 1 ? 'ClassTest' : 'CourseWork'
      saveBlob(writeWorkbook('Resit IA Result', [header, ...body]), `Resit_IA_Result_${type}_${intake?.intakeCode ?? 'session'}.xlsx`)
    } catch (err) {
      showToast(errMsg(err, 'Could not export the results.'), 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Resit IA Result</div>
            <div className="pg-sub">Submitted resit IA marks of an academic session</div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="fg mb-0">
              <label className="lbl">Academic Session <span className="req">*</span></label>
              <SearchSelect placeholder={intakesLoading ? 'Loading…' : 'Select academic session'} options={intakeOptions} value={intakeGuid} onChange={changeIntake} disabled={intakesLoading} />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Resit</label>
              <SearchSelect options={resitOptions} value={resitConfigGuid} onChange={changeFilter(setResitConfigGuid)} disabled={!intakeGuid || resitsLoading} />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Campus</label>
              <SearchSelect options={campusOptions} value={campusGuid} onChange={changeFilter(setCampusGuid)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between flex-wrap gap-2" style={{ paddingRight: 16, borderBottom: '1px solid var(--g200)' }}>
            {/* Assessment type tabs (resit-ia-result-page.md) */}
            <div className="tab-bar" style={{ borderBottom: 'none' }} role="tablist">
              {CATEGORY_OPTIONS.map(c => (
                <button
                  key={c.value}
                  role="tab"
                  aria-selected={String(category) === c.value}
                  className={`tab-btn${String(category) === c.value ? ' active' : ''}`}
                  onClick={() => changeFilter(setCategory)(Number(c.value) as ResitIaCategory)}
                >
                  <i className={`lni ${c.value === '1' ? 'lni-pencil-alt' : 'lni-folder'}`}></i> {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap py-2">
              <div className="inp-wrap w-64">
                <i className="lni lni-search-alt inp-icon"></i>
                <input className="ctrl" placeholder="Student no., name, programme or unit…" maxLength={100} value={searchInput} onChange={e => setSearchInput(e.target.value)} />
              </div>
              <button className="btn btn-neu btn-sm" onClick={handleExport} disabled={exporting || !totalCount}>
                <i className="lni lni-download"></i> {exporting ? 'Exporting…' : 'Export to Excel'}
              </button>
            </div>
          </div>

          {resultsQuery.isError ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-title">Couldn&apos;t load results</div>
              <div className="empty-sub">{errMsg(resultsQuery.error, 'Please try again.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => resultsQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : !intakeGuid || resultsQuery.isLoading ? (
            <div className="empty"><div className="empty-sub">Loading results…</div></div>
          ) : rows.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-folder"></i></div>
              <div className="empty-title">No results</div>
              <div className="empty-sub">
                {search
                  ? 'No students, programmes or units match your search.'
                  : `No resit ${category === 1 ? 'class test' : 'course work'} marks submitted for this session yet.`}
              </div>
            </div>
          ) : (
            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 56 }}>#</th>
                    <th>Student</th>
                    <th>Programme</th>
                    <th>Course Unit</th>
                    <th style={{ textAlign: 'right' }}>Mark</th>
                  </tr>
                </thead>
                <tbody style={{ opacity: resultsQuery.isFetching ? 0.6 : 1 }}>
                  {rows.map((r, i) => (
                    <tr key={`${r.studentNum}-${r.unitName}-${i}`}>
                      <td className="text-g500">{firstRow + i + 1}</td>
                      <td>
                        <strong>{r.studentName ?? '—'}</strong>
                        <div className="text-xs text-g500 font-mono">{r.studentNum ?? '—'}</div>
                      </td>
                      <td>{r.programCode ?? '—'}</td>
                      <td><div className="truncate max-w-[280px]" title={r.unitName ?? undefined}>{r.unitName ?? <span className="text-g400">Unit unavailable</span>}</div></td>
                      <td className="font-mono" style={{ textAlign: 'right', minWidth: 130 }}>
                        <strong>{fmtMark(r.mark)}</strong> <span className="text-g400">/ {fmtMark(r.maxMark)}</span>
                        <PercentBar mark={r.mark} max={r.maxMark} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}

          {totalCount > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm text-g600" style={{ paddingLeft: 16 }}>
                Show
                <select className="ctrl" style={{ width: 80, height: 32 }} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
                  {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                entries
              </label>
              <div style={{ flex: 1 }}>
                <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="results" onPageChange={setPage} />
              </div>
            </div>
          )}
        </div>
      </div>
      <Toast toast={toast} />
    </>
  )
}
