'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ScrollTable } from '@/components/ScrollTable'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { Toast } from '@/components/Toast'
import { EmptyState } from '@/components/EmptyState'
import { SearchSelect } from '@/components/SearchSelect'
import DatePicker from '@/components/DatePicker'
import TimePicker from '@/components/TimePicker'
import { useExamRules } from '@/hooks/assessment/useExamRules'
import { ExamRuleLookupModal } from '@/app/assessment/ia-creation/_components/ExamRuleLookupModal'
import {
  RESIT_SCHEDULING_KEYS,
  useResitSchedules,
  useResitScheduleCourseUnits,
  useCreateResitSchedule,
  useUpdateResitSchedule,
  useResitSchedule,
  useResitCwSchedule,
  useUpdateResitCwSchedule,
  useResitCtSchedule,
  useUpdateResitCtSchedule,
} from '@/hooks/assessment/useResitScheduling'
import type {
  ResitScheduleCourseUnitDto,
  ResitScheduleSaveCommand,
  ResitCtScheduleResponse,
  ResitCwScheduleResponse,
} from '@/lib/api/assessment/resitScheduling'

// Resit Scheduling (resit-scheduling-page.md) — one page for everything the
// exam office schedules for the active resit of the current intake:
// University Exam (one per unit and part), Class Test and Coursework (one
// window each). There is no resit or intake selector.

type TabId = 'exam' | 'ct' | 'cw'
const TAB_IDS: TabId[] = ['exam', 'ct', 'cw']
const PAGE_SIZE = 10
const NO_RESIT_MSG = 'There is no active resit in this academic intake. Scheduling not possible.'
const UNSAVED_MSG = 'You have unsaved changes. Discard them?'

// ── Helpers ────────────────────────────────────────────────────────────────

function errCode(err: unknown) { return (err as { code?: string } | null)?.code }
function errMsg(err: unknown, fallback: string) { return (err as { message?: string } | null)?.message || fallback }
// 400 validation_error carries every message in errors[]; others use errors[0].
function errList(err: unknown, fallback: string): string[] {
  const all = (err as { errors?: string[] } | null)?.errors
  return all?.length ? all : [errMsg(err, fallback)]
}

// GET /exam-rules is paged ({ items, ... }); the picker lists active rules only
// (status 3 = NotActive), same as the IA schedule modals.
function useActiveExamRules() {
  const { data } = useExamRules(1, 100, '')
  return (data?.items ?? []).filter(r => r.status !== 3)
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Dates: from 01 Jan 2000, at most 2 years ahead (past dates allowed).
const MIN_YMD = '2000-01-01'
function maxYmd() { const d = new Date(); d.setFullYear(d.getFullYear() + 2); return ymd(d) }
function inRange(day: string) { return day >= MIN_YMD && day <= maxYmd() }
function rangeMsg(what: string) { return `${what} must be between 01 Jan 2000 and ${fmtDate(maxYmd())}.` }

// A server value without a zone designator is UTC.
function parseUtc(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
  return isNaN(d.getTime()) ? null : d
}

// UTC → { date: yyyy-mm-dd, time: HH:mm } in local time.
function utcToLocalParts(iso: string | null | undefined) {
  const d = parseUtc(iso)
  if (!d) return { date: '', time: '' }
  return { date: ymd(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
}

// Local date + time → ISO 8601 in UTC (never without a zone).
function localPartsToUtc(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString()
}

// yyyy-mm-dd → "16 Oct 2026"
function fmtDate(day: string | null | undefined) {
  if (!day) return '—'
  const d = new Date(`${day.slice(0, 10)}T00:00:00`)
  return isNaN(d.getTime()) ? day : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// HH:mm[:ss] → "01:30 PM"
function fmt12h(hhmm: string | null | undefined) {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return hhmm
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// Window for the cards, in local time: "10–15 Mar", "28 Feb – 3 Mar".
function fmtWindow(startIso: string, endIso: string) {
  const s = parseUtc(startIso), e = parseUtc(endIso)
  if (!s || !e) return '—'
  const mon = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
  const yr = (d: Date) => (s.getFullYear() !== e.getFullYear() ? ` ${d.getFullYear()}` : '')
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return s.getDate() === e.getDate() ? `${s.getDate()} ${mon(s)}` : `${s.getDate()}–${e.getDate()} ${mon(s)}`
  }
  return `${s.getDate()} ${mon(s)}${yr(s)} – ${e.getDate()} ${mon(e)}${yr(e)}`
}
function fmtLocalDateTime(iso: string) {
  const d = parseUtc(iso)
  return d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}

const testTypeLabel = (t: number | null | undefined) => (t === 0 ? 'Online' : t === 1 ? 'Offline' : '—')
const publishLabel = (p: number | null | undefined) => (p === 1 ? 'Published' : 'Not published')

// ── Shared bits ────────────────────────────────────────────────────────────

function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 600 }} onClick={e => { e.stopPropagation(); onKeep() }}>
      <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
        <div className="perm-delete-icon"><i className="lni lni-warning"></i></div>
        <div className="perm-delete-title">Discard changes?</div>
        <div className="perm-delete-sub">{UNSAVED_MSG}</div>
        <div className="perm-delete-actions">
          <button className="btn btn-neu" onClick={onKeep}>Keep editing</button>
          <button className="btn btn-danger" onClick={onDiscard}>Discard</button>
        </div>
      </div>
    </div>
  )
}

function FormErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <div className="mb-5 px-4 py-3 rounded-lg text-sm" role="alert" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-bd)', color: 'var(--red)' }}>
      {errors.length === 1 ? (
        <div className="flex gap-2"><i className="lni lni-warning mt-0.5"></i><span>{errors[0]}</span></div>
      ) : (
        <ul className="list-disc pl-5 space-y-0.5">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
      )}
    </div>
  )
}

function Radio2({ name, value, onChange, options, disabled }: {
  name: string
  value: number
  onChange: (v: number) => void
  options: { value: number; label: string; disabled?: boolean; note?: string }[]
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
      {options.map(o => (
        <label key={o.value} className={`flex items-center gap-2 text-sm ${disabled || o.disabled ? 'cursor-not-allowed text-g400' : 'cursor-pointer'}`}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} disabled={disabled || o.disabled} />
          {o.label}{o.note && <span className="text-xs text-g400">{o.note}</span>}
        </label>
      ))}
    </div>
  )
}

function LockNote({ children }: { children: React.ReactNode }) {
  return <div className="text-xs mt-1" style={{ color: 'var(--amber)' }}><i className="lni lni-lock mr-1"></i>{children}</div>
}

// Exam rule: dropdown plus 🔍 lookup with the section columns.
function ExamRuleField({ value, onChange, disabled, lockNote, hint, highlightSectionA }: {
  value: string
  onChange: (guid: string) => void
  disabled?: boolean
  lockNote?: string
  hint?: string
  highlightSectionA?: boolean
}) {
  const rules = useActiveExamRules()
  const [lookupOpen, setLookupOpen] = useState(false)
  const options = rules.map(r => ({ value: r.examRuleGuid, label: `${r.ruleCode} · ${r.ruleName}` }))
  return (
    <div>
      <label className="lbl">Exam Rule <span className="text-red-500">*</span></label>
      <div className="flex gap-2 mt-1">
        <SearchSelect options={options} value={value} onChange={onChange} placeholder="Select Exam Rule..." className="flex-1 min-w-0" disabled={disabled} />
        <button type="button" className="btn btn-neu" onClick={() => setLookupOpen(true)} disabled={disabled} title="Search exam rules" aria-label="Search exam rules">
          <i className="lni lni-search-alt"></i>
        </button>
      </div>
      {lockNote ? <LockNote>{lockNote}</LockNote> : hint ? <div className="text-xs text-g500 mt-1">{hint}</div> : null}
      {/* Portalled for the same reason as the drawer (tab panel transform). */}
      {lookupOpen && createPortal(
        <ExamRuleLookupModal isOpen onClose={() => setLookupOpen(false)} onSelect={onChange} highlightSectionA={highlightSectionA} selectedGuid={value} />,
        document.body,
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ResitSchedulingPage() {
  return (
    <Suspense>
      <ResitSchedulingContent />
    </Suspense>
  )
}

function ResitSchedulingContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab') as TabId | null
  const [activeTab, setActiveTab] = useState<TabId>(urlTab && TAB_IDS.includes(urlTab) ? urlTab : 'exam')

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const showToast = useCallback((msg: string, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Page load: the three calls in parallel ──────────────────────────────
  const examSummary = useResitSchedules({ page: 1, pageSize: PAGE_SIZE, search: '' })
  const ctQuery = useResitCtSchedule()
  const cwQuery = useResitCwSchedule()

  // Course units feed "units pending" and the Add drawer — after first paint.
  const forbidden: Record<TabId, boolean> = {
    exam: errCode(examSummary.error) === 'forbidden',
    ct: errCode(ctQuery.error) === 'forbidden',
    cw: errCode(cwQuery.error) === 'forbidden',
  }
  const unitsQuery = useResitScheduleCourseUnits(examSummary.isFetched && !forbidden.exam)

  const resit = examSummary.data?.resit ?? ctQuery.data?.resit ?? cwQuery.data?.resit ?? null
  const noResit = [examSummary.data, ctQuery.data, cwQuery.data].some(d => d && d.resit === null)
  const loading = examSummary.isLoading || ctQuery.isLoading || cwQuery.isLoading

  // Save permission is only known from a 403 on save.
  const [saveForbidden, setSaveForbidden] = useState<Record<TabId, boolean>>({ exam: false, ct: false, cw: false })
  const markSaveForbidden = useCallback((t: TabId) => setSaveForbidden(prev => ({ ...prev, [t]: true })), [])

  const visibleTabs = TAB_IDS.filter(t => !forbidden[t])

  // ── Unsaved changes ─────────────────────────────────────────────────────
  const [dirty, setDirty] = useState<Record<TabId, boolean>>({ exam: false, ct: false, cw: false })
  // Stable per tab — the forms report through effects keyed on these.
  const dirtyHandlers = useMemo(() => {
    const set = (t: TabId) => (v: boolean) => setDirty(prev => (prev[t] === v ? prev : { ...prev, [t]: v }))
    return { exam: set('exam'), ct: set('ct'), cw: set('cw') }
  }, [])
  const anyDirty = dirty.exam || dirty.ct || dirty.cw
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)

  useEffect(() => {
    if (!anyDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = UNSAVED_MSG }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [anyDirty])

  function goTab(t: TabId) {
    setDirty(prev => ({ ...prev, [activeTab]: false }))
    setActiveTab(t)
    setPendingTab(null)
    router.replace(`${pathname}?tab=${t}`, { scroll: false })
  }
  function requestTab(t: TabId) {
    if (t === activeTab) return
    if (dirty[activeTab]) setPendingTab(t)
    else goTab(t)
  }

  // Back / forward between ?tab= values.
  useEffect(() => {
    if (urlTab && TAB_IDS.includes(urlTab) && urlTab !== activeTab) setActiveTab(urlTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab])

  // Without the view permission the tab (and its card) is hidden.
  useEffect(() => {
    if (forbidden[activeTab] && visibleTabs.length) setActiveTab(visibleTabs[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forbidden.exam, forbidden.ct, forbidden.cw, activeTab])

  // ── Card / tab figures ──────────────────────────────────────────────────
  const examTotal = examSummary.data?.schedules.totalCount
  const unitsPending = unitsQuery.data ? unitsQuery.data.filter(u => !u.theoryScheduled && !u.practicalScheduled).length : null

  // Sliding tab underline.
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement>>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = tabRefs.current[activeTab]
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [activeTab, examTotal, ctQuery.data, cwQuery.data, visibleTabs.length])

  const tabLabel: Record<TabId, React.ReactNode> = {
    exam: <>University Exam{examTotal !== undefined && ` (${examTotal.toLocaleString()})`}</>,
    ct: <>Class Test{ctQuery.data && !ctQuery.data.schedule && <NotSavedDot />}</>,
    cw: <>Coursework{cwQuery.data && !cwQuery.data.schedule && <NotSavedDot />}</>,
  }
  const tabIcon: Record<TabId, string> = { exam: 'lni-graduation', ct: 'lni-pencil-alt', cw: 'lni-timer' }

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Resit Scheduling</div>
          <div className="pg-sub">
            {resit ? <>Active resit: <strong>{resit.refCode}</strong></> : loading ? 'Loading the active resit…' : 'No active resit'}
          </div>
        </div>
      </div>

      {noResit && (
        <div className="warn-box mb-5"><i className="lni lni-warning mt-0.5"></i><span>{NO_RESIT_MSG}</span></div>
      )}

      {visibleTabs.length === 0 ? (
        <div className="card p-6 text-sm text-g500">You do not have permission to view resit schedules.</div>
      ) : (
        <>
          {/* Summary cards — clicking one opens its tab */}
          <div className="stat-grid-fluid mb-5">
            {!forbidden.exam && (
              <SummaryCard label="University Exam" icon="lni-graduation" active={activeTab === 'exam'} onClick={() => requestTab('exam')}>
                {examSummary.isLoading ? <CardLoading /> : examSummary.isError ? <CardError /> : (
                  <>
                    <div className="stat-num">{(examTotal ?? 0).toLocaleString()} <span className="text-sm font-semibold text-g500">scheduled</span></div>
                    <div className="stat-lbl">
                      {unitsPending === null ? 'Counting pending units…' : `${unitsPending.toLocaleString()} unit${unitsPending === 1 ? '' : 's'} pending`}
                    </div>
                  </>
                )}
              </SummaryCard>
            )}
            {!forbidden.ct && (
              <SummaryCard label="Class Test" icon="lni-pencil-alt" active={activeTab === 'ct'} onClick={() => requestTab('ct')}>
                <WindowCardBody query={ctQuery} duration />
              </SummaryCard>
            )}
            {!forbidden.cw && (
              <SummaryCard label="Coursework" icon="lni-timer" active={activeTab === 'cw'} onClick={() => requestTab('cw')}>
                <WindowCardBody query={cwQuery} />
              </SummaryCard>
            )}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="tab-bar" role="tablist">
              {visibleTabs.map(t => (
                <button
                  key={t}
                  ref={el => { if (el) tabRefs.current[t] = el }}
                  role="tab"
                  aria-selected={activeTab === t}
                  className={`tab-btn${activeTab === t ? ' active' : ''}`}
                  onClick={() => requestTab(t)}
                >
                  <i className={`lni ${tabIcon[t]}`}></i> {tabLabel[t]}
                </button>
              ))}
              <span className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
            </div>

            <div key={activeTab} className="tab-panel-in">
              {activeTab === 'exam' && (
                <ExamTab
                  readOnly={noResit || saveForbidden.exam}
                  readOnlyReason={noResit ? NO_RESIT_MSG : saveForbidden.exam ? 'You do not have permission to save resit exam schedules.' : undefined}
                  units={unitsQuery.data}
                  unitsLoading={unitsQuery.isLoading || !unitsQuery.isFetched}
                  showToast={showToast}
                  onForbidden={() => markSaveForbidden('exam')}
                  onDirtyChange={dirtyHandlers.exam}
                />
              )}
              {activeTab === 'ct' && (
                <CtTab
                  readOnly={noResit || saveForbidden.ct}
                  readOnlyReason={noResit ? NO_RESIT_MSG : saveForbidden.ct ? 'You do not have permission to save the resit class test schedule.' : undefined}
                  showToast={showToast}
                  onForbidden={() => markSaveForbidden('ct')}
                  onDirtyChange={dirtyHandlers.ct}
                />
              )}
              {activeTab === 'cw' && (
                <CwTab
                  readOnly={noResit || saveForbidden.cw}
                  readOnlyReason={noResit ? NO_RESIT_MSG : saveForbidden.cw ? 'You do not have permission to save the resit coursework schedule.' : undefined}
                  showToast={showToast}
                  onForbidden={() => markSaveForbidden('cw')}
                  onDirtyChange={dirtyHandlers.cw}
                />
              )}
            </div>
          </div>
        </>
      )}

      {pendingTab && <DiscardConfirm onKeep={() => setPendingTab(null)} onDiscard={() => goTab(pendingTab)} />}
      <Toast toast={toast} />
    </div>
  )
}

function NotSavedDot() {
  return <span title="Not scheduled yet" aria-label="Not scheduled yet" style={{ color: 'var(--amber)', fontSize: 10, marginLeft: 2 }}>●</span>
}

// ── Summary cards ──────────────────────────────────────────────────────────

function SummaryCard({ label, icon, active, onClick, children }: { label: string; icon: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="stat-card"
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{ cursor: 'pointer', borderColor: active ? 'var(--b400)' : undefined }}
      aria-pressed={active}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-g500 uppercase tracking-wide">{label}</div>
        <i className={`lni ${icon}`} style={{ color: 'var(--b500)' }}></i>
      </div>
      {children}
    </div>
  )
}

function CardLoading() {
  return <div className="stat-lbl mt-3"><i className="lni lni-spinner-solid animate-spin mr-1"></i>Loading…</div>
}
function CardError() {
  return <div className="stat-lbl mt-3" style={{ color: 'var(--red)' }}>Could not load.</div>
}

function WindowCardBody({ query, duration }: {
  query: { data?: ResitCtScheduleResponse | ResitCwScheduleResponse; isLoading: boolean; isError: boolean }
  duration?: boolean
}) {
  if (query.isLoading) return <CardLoading />
  if (query.isError || !query.data) return <CardError />
  const { schedule, locked, studentsStarted } = query.data
  if (!schedule) return <div className="mt-2"><span className="badge badge-amber">Not scheduled</span></div>
  const mins = duration && 'durationMinutes' in schedule ? schedule.durationMinutes : null
  return (
    <>
      <div className="text-[17px] font-bold text-g900 mt-1.5" title={`${fmtLocalDateTime(schedule.startDateTime)} – ${fmtLocalDateTime(schedule.endDateTime)} (local time)`}>
        {fmtWindow(schedule.startDateTime, schedule.endDateTime)}{mins !== null && ` · ${mins} min`}
      </div>
      <div className="stat-lbl">{testTypeLabel(schedule.testType)} · {publishLabel(schedule.publishStatus)}</div>
      {locked && <div className="text-xs mt-1.5 font-semibold" style={{ color: 'var(--amber)' }}><i className="lni lni-lock mr-1"></i>{studentsStarted} started</div>}
    </>
  )
}

// ── Tab 1 — University Exam ────────────────────────────────────────────────

interface TabProps {
  readOnly: boolean
  readOnlyReason?: string
  showToast: (msg: string, type?: string) => void
  onForbidden: () => void
  onDirtyChange: (dirty: boolean) => void
}

function ExamTab({ readOnly, readOnlyReason, units, unitsLoading, showToast, onForbidden, onDirtyChange }: TabProps & {
  units: ResitScheduleCourseUnitDto[] | undefined
  unitsLoading: boolean
}) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const listQuery = useResitSchedules({ page, pageSize: PAGE_SIZE, search })
  const items = listQuery.data?.schedules.items ?? []
  const totalCount = listQuery.data?.schedules.totalCount ?? 0

  const [drawer, setDrawer] = useState<{ mode: 'add' | 'edit'; guid: string | null } | null>(null)

  function doSearch() { setSearch(searchInput.trim()); setPage(1) }
  function doClear() { setSearchInput(''); setSearch(''); setPage(1) }

  function closeDrawer() { setDrawer(null); onDirtyChange(false) }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100">
        <div className="relative w-full sm:w-72">
          <i className="lni lni-search-alt absolute left-3 top-1/2 -translate-y-1/2 text-g400 pointer-events-none"></i>
          <input
            className="ctrl w-full"
            style={{ paddingLeft: 34 }}
            placeholder="Unit code or name"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
          />
        </div>
        <button className="btn btn-neu" onClick={doSearch}>Search</button>
        <button className="btn btn-neu" onClick={doClear} disabled={!searchInput && !search}>Clear</button>
        <span className="sm:ml-auto" title={readOnlyReason}>
          <button className="btn btn-primary" onClick={() => setDrawer({ mode: 'add', guid: null })} disabled={readOnly}>
            <i className="lni lni-plus"></i> Add
          </button>
        </span>
      </div>

      <ScrollTable>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Unit</th>
              <th>Part</th>
              <th>Exam Date</th>
              <th>Start</th>
              <th>End</th>
              <th style={{ textAlign: 'right' }}>Max Mark</th>
              <th>Test Type</th>
              <th>Published</th>
              <th>Exam Rule</th>
              <th style={{ width: 52 }}></th>
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <TableLoadingState colSpan={11} />
            ) : listQuery.isError ? (
              <tr><td colSpan={11} className="text-center py-8 text-sm">
                <span style={{ color: 'var(--red)' }}>{errMsg(listQuery.error, 'Could not load the resit exam schedules.')}</span>{' '}
                <button className="btn btn-neu btn-sm ml-2" onClick={() => listQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
              </td></tr>
            ) : items.length === 0 ? (
              <EmptyState colSpan={11} hasFilters={!!search} onClearFilters={doClear} />
            ) : (
              items.map(s => (
                <tr key={s.resitScheduleGuid}>
                  <td className="font-mono text-slate-700">{s.unitCode}</td>
                  <td>{s.unitName}</td>
                  <td>{s.ueType === 1 ? 'Practical' : 'Theory'}</td>
                  <td className="whitespace-nowrap">{fmtDate(s.examDate)}</td>
                  <td className="whitespace-nowrap font-mono text-[12px]">{fmt12h(s.startTime)}</td>
                  <td className="whitespace-nowrap font-mono text-[12px]">{fmt12h(s.endTime)}</td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>{s.maxMark ?? '—'}</td>
                  <td>{testTypeLabel(s.examType)}</td>
                  <td>
                    {s.publishStatus === 1
                      ? <span className="badge badge-green">Published</span>
                      : <span className="badge badge-amber">Not published</span>}
                  </td>
                  <td className="text-[12px]" title={s.examRuleName ?? undefined}>{s.examRuleCode ?? '—'}</td>
                  <td>
                    <button
                      className="btn btn-neu btn-sm"
                      onClick={() => setDrawer({ mode: 'edit', guid: s.resitScheduleGuid })}
                      title={readOnly ? 'View' : 'Edit'}
                      aria-label={`${readOnly ? 'View' : 'Edit'} ${s.unitCode} ${s.ueType === 1 ? 'Practical' : 'Theory'}`}
                    >
                      <i className={`lni ${readOnly ? 'lni-eye' : 'lni-pencil'}`}></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollTable>

      {totalCount > PAGE_SIZE && (
        <div className="p-4 border-t border-slate-100">
          <Pagination page={page} totalPages={Math.ceil(totalCount / PAGE_SIZE)} totalCount={totalCount} itemLabel="schedules" onPageChange={setPage} />
        </div>
      )}

      {drawer && (
        <ExamScheduleDrawer
          mode={drawer.mode}
          guid={drawer.guid}
          readOnly={readOnly}
          readOnlyReason={readOnlyReason}
          units={units}
          unitsLoading={unitsLoading}
          onClose={closeDrawer}
          onSaved={msg => { closeDrawer(); showToast(msg) }}
          onStale={msg => {
            closeDrawer()
            showToast(msg, 'error')
            qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.exams() })
          }}
          onConflict={() => {
            qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.exams() })
            qc.invalidateQueries({ queryKey: RESIT_SCHEDULING_KEYS.courseUnits() })
          }}
          onForbidden={onForbidden}
          onDirtyChange={onDirtyChange}
        />
      )}
    </>
  )
}

interface ExamForm {
  courseUnitGuid: string
  ueType: number
  examDate: string
  startTime: string
  endTime: string
  maxMark: string
  examType: number
  publishStatus: number
  examRuleGuid: string
}

// Add defaults: Offline, Published.
const EXAM_DEFAULTS: ExamForm = { courseUnitGuid: '', ueType: 0, examDate: '', startTime: '', endTime: '', maxMark: '100', examType: 1, publishStatus: 1, examRuleGuid: '' }

function validateExam(f: ExamForm, isAdd: boolean): string[] {
  const out: string[] = []
  if (isAdd && !f.courseUnitGuid) out.push('Select Course Unit')
  if (!f.examDate) out.push('Enter Exam Date')
  else if (!inRange(f.examDate)) out.push(rangeMsg('Exam date'))
  if (!f.startTime || !f.endTime) out.push('Enter Start and End time')
  else if (f.endTime <= f.startTime) out.push('End time must be after start time.')
  const mark = Number(f.maxMark)
  if (f.maxMark.trim() === '' || isNaN(mark) || mark <= 0 || mark > 9999.99 || !/^\d+(\.\d{1,2})?$/.test(f.maxMark.trim())) out.push('Enter Exam Mark')
  if (!f.examRuleGuid) out.push('Select Rule')
  return out
}

function ExamScheduleDrawer({ mode, guid, readOnly, readOnlyReason, units, unitsLoading, onClose, onSaved, onStale, onConflict, onForbidden, onDirtyChange }: {
  mode: 'add' | 'edit'
  guid: string | null
  readOnly: boolean
  readOnlyReason?: string
  units: ResitScheduleCourseUnitDto[] | undefined
  unitsLoading: boolean
  onClose: () => void
  onSaved: (msg: string) => void
  onStale: (msg: string) => void
  onConflict: () => void
  onForbidden: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const isAdd = mode === 'add'
  const detailQuery = useResitSchedule(isAdd ? null : guid)
  const detail = detailQuery.data
  const createMut = useCreateResitSchedule()
  const updateMut = useUpdateResitSchedule()
  const saving = createMut.isPending || updateMut.isPending

  const [form, setForm] = useState<ExamForm>(EXAM_DEFAULTS)
  const [baseline, setBaseline] = useState<ExamForm>(EXAM_DEFAULTS)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const set = <K extends keyof ExamForm>(k: K, v: ExamForm[K]) => setForm(prev => ({ ...prev, [k]: v }))

  // Edit: fill from GET /resit-schedule/{guid} (also after a 409 reload).
  useEffect(() => {
    if (!detail) return
    const f: ExamForm = {
      courseUnitGuid: detail.courseUnitGuid,
      ueType: detail.ueType,
      examDate: detail.examDate?.slice(0, 10) ?? '',
      startTime: detail.startTime?.slice(0, 5) ?? '',
      endTime: detail.endTime?.slice(0, 5) ?? '',
      maxMark: detail.maxMark != null ? String(detail.maxMark) : '',
      examType: detail.examType ?? 1,
      publishStatus: detail.publishStatus ?? 1,
      examRuleGuid: detail.examRuleGuid ?? '',
    }
    setForm(f)
    setBaseline(f)
  }, [detail])

  // 404 on load: the schedule is gone — close and reload the list.
  useEffect(() => {
    if (detailQuery.isError && errCode(detailQuery.error) === 'not_found') onStale(errMsg(detailQuery.error, 'Resit schedule not found.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.isError])

  const dirty = !readOnly && JSON.stringify(form) !== JSON.stringify(baseline)
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  function requestClose() {
    if (saving) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (confirmDiscard) setConfirmDiscard(false)
      else requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const marksEntered = !!detail?.marksEntered
  const selectedUnit = units?.find(u => u.courseUnitGuid === form.courseUnitGuid)
  const fullyScheduled = (u: ResitScheduleCourseUnitDto) => u.theoryScheduled && (!u.isTheoryPracticalUnit || u.practicalScheduled)
  const unitOptions = (units ?? []).map(u => ({
    value: u.courseUnitGuid,
    label: `${u.unitName} (${u.unitCode})${fullyScheduled(u) ? ' — scheduled' : ''}`,
    disabled: fullyScheduled(u),
  }))

  // Pick the part still open for theory + practical units.
  function changeUnit(guidValue: string) {
    const u = units?.find(x => x.courseUnitGuid === guidValue)
    setForm(prev => ({ ...prev, courseUnitGuid: guidValue, ueType: u?.isTheoryPracticalUnit && u.theoryScheduled ? 1 : 0 }))
  }

  function showErrors(list: string[]) {
    setErrors(list)
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleError(err: unknown) {
    const code = errCode(err)
    if (code === 'validation_error') return showErrors(errList(err, 'Please correct the highlighted fields.'))
    if (code === 'not_found' && !isAdd) return onStale(errMsg(err, 'Resit schedule not found.'))
    if (code === 'conflict') { onConflict(); if (!isAdd) detailQuery.refetch() }
    if (code === 'forbidden') onForbidden()
    showErrors([errMsg(err, isAdd ? 'Could not create the resit schedule.' : 'Could not update the resit schedule.')])
  }

  function handleSave() {
    if (readOnly || saving) return
    const invalid = validateExam(form, isAdd)
    if (invalid.length) return showErrors(invalid)
    setErrors([])
    const data: ResitScheduleSaveCommand = {
      examDate: form.examDate,
      startTime: `${form.startTime}:00`,
      endTime: `${form.endTime}:00`,
      maxMark: Number(form.maxMark),
      examType: form.examType,
      publishStatus: form.publishStatus,
      examRuleGuid: form.examRuleGuid,
    }
    if (isAdd) {
      createMut.mutate({ ...data, courseUnitGuid: form.courseUnitGuid, ueType: form.ueType }, {
        onSuccess: () => onSaved('Resit schedule created successfully.'),
        onError: handleError,
      })
    } else if (guid) {
      updateMut.mutate({ guid, data }, {
        onSuccess: () => onSaved('Resit schedule updated successfully.'),
        onError: handleError,
      })
    }
  }

  const loadingDetail = !isAdd && detailQuery.isLoading
  const disabled = readOnly || saving || loadingDetail
  const title = isAdd ? 'Add Resit Exam Schedule' : readOnly ? 'Resit Exam Schedule' : 'Edit Resit Exam Schedule'

  // Portalled to <body>: the tab panel's enter animation leaves a transform
  // on its wrapper, which would otherwise trap this fixed overlay inside it.
  return createPortal(
    <div className="drawer-overlay">
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="drawer-hdr">
          <div className="flex items-center gap-2">
            <i className="lni lni-graduation" style={{ fontSize: 18 }}></i>
            <div className="font-semibold text-[15px] flex-1">{title}</div>
            <button onClick={requestClose} disabled={saving} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--white)', cursor: 'pointer', padding: 2 }}>
              <i className="lni lni-close" style={{ fontSize: 18 }}></i>
            </button>
          </div>
        </div>

        <div className="drawer-body" ref={bodyRef}>
          {readOnlyReason && <div className="warn-box mb-5 text-sm"><i className="lni lni-lock mt-0.5"></i><span>{readOnlyReason}</span></div>}
          <FormErrors errors={errors} />

          {loadingDetail ? (
            <div className="py-10 text-center text-sm text-g500"><i className="lni lni-spinner-solid animate-spin mr-2"></i>Loading schedule…</div>
          ) : !isAdd && detailQuery.isError ? (
            <div className="py-10 text-center text-sm">
              <div style={{ color: 'var(--red)' }}>{errMsg(detailQuery.error, 'Could not load the schedule.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => detailQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Course unit — read-only on Edit */}
              <div>
                <label className="lbl">Course Unit {isAdd && <span className="text-red-500">*</span>}</label>
                {isAdd ? (
                  <>
                    <SearchSelect
                      options={unitOptions}
                      value={form.courseUnitGuid}
                      onChange={changeUnit}
                      placeholder={unitsLoading ? 'Loading units…' : 'Select Course Unit…'}
                      className="w-full mt-1"
                      disabled={disabled || unitsLoading}
                    />
                    <div className="text-xs text-g500 mt-1">Fully scheduled units are disabled.</div>
                  </>
                ) : (
                  <div className="ctrl mt-1 bg-slate-50 text-g800">{detail ? `${detail.unitCode} · ${detail.unitName}` : '—'}</div>
                )}
              </div>

              {/* Part — only for theory + practical units; read-only on Edit */}
              {isAdd ? (
                selectedUnit?.isTheoryPracticalUnit && (
                  <div>
                    <label className="lbl">Part <span className="text-red-500">*</span></label>
                    <Radio2
                      name="resitUePart"
                      value={form.ueType}
                      onChange={v => set('ueType', v)}
                      disabled={disabled}
                      options={[
                        { value: 0, label: 'Theory', disabled: selectedUnit.theoryScheduled, note: selectedUnit.theoryScheduled ? '(scheduled)' : undefined },
                        { value: 1, label: 'Practical', disabled: selectedUnit.practicalScheduled, note: selectedUnit.practicalScheduled ? '(scheduled)' : undefined },
                      ]}
                    />
                  </div>
                )
              ) : (
                <div>
                  <label className="lbl">Part</label>
                  <div className="ctrl mt-1 bg-slate-50 text-g800">{detail?.ueType === 1 ? 'Practical' : 'Theory'}</div>
                </div>
              )}

              <div>
                <label className="lbl">Exam Date <span className="text-red-500">*</span></label>
                <div className="mt-1">
                  {disabled
                    ? <input className="ctrl w-full" value={fmtDate(form.examDate)} disabled />
                    : <DatePicker value={form.examDate} onChange={v => set('examDate', v)} maxYmd={maxYmd()} />}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Start <span className="text-red-500">*</span></label>
                  <div className="mt-1"><TimePicker value={form.startTime} onChange={v => set('startTime', v)} disabled={disabled} /></div>
                </div>
                <div>
                  <label className="lbl">End <span className="text-red-500">*</span></label>
                  <div className="mt-1"><TimePicker value={form.endTime} onChange={v => set('endTime', v)} disabled={disabled} /></div>
                </div>
              </div>

              <div>
                <label className="lbl">Exam Mark <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="0.01"
                  max="9999.99"
                  step="0.01"
                  className="ctrl w-full mt-1"
                  value={form.maxMark}
                  onChange={e => set('maxMark', e.target.value)}
                  disabled={disabled || marksEntered}
                />
                {marksEntered && <LockNote>Marks have been entered — the exam mark can no longer change.</LockNote>}
              </div>

              <div>
                <label className="lbl">Test Type <span className="text-red-500">*</span></label>
                <Radio2 name="resitUeTestType" value={form.examType} onChange={v => set('examType', v)} disabled={disabled}
                  options={[{ value: 1, label: 'Offline' }, { value: 0, label: 'Online' }]} />
              </div>

              <div>
                <label className="lbl">Publish <span className="text-red-500">*</span></label>
                <Radio2 name="resitUePublish" value={form.publishStatus} onChange={v => set('publishStatus', v)} disabled={disabled}
                  options={[{ value: 1, label: 'Published' }, { value: 0, label: 'Not published' }]} />
              </div>

              <ExamRuleField
                value={form.examRuleGuid}
                onChange={v => set('examRuleGuid', v)}
                disabled={disabled || marksEntered}
                lockNote={marksEntered ? 'Marks have been entered — the exam rule can no longer change.' : undefined}
              />
            </div>
          )}
        </div>

        <div className="drawer-ftr">
          <button className="btn btn-neu" onClick={requestClose} disabled={saving}>{readOnly ? 'Close' : 'Cancel'}</button>
          {!readOnly && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || loadingDetail || (!isAdd && !detail)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {confirmDiscard && <DiscardConfirm onKeep={() => setConfirmDiscard(false)} onDiscard={onClose} />}
    </div>,
    document.body,
  )
}

// ── Tabs 2 and 3 — Class Test / Coursework ─────────────────────────────────

function CtTab(props: TabProps) {
  const query = useResitCtSchedule()
  const mut = useUpdateResitCtSchedule()
  return (
    <WindowScheduleForm
      {...props}
      kind="ct"
      query={query}
      saving={mut.isPending}
      onSave={v => mut.mutateAsync({ ...v, durationMinutes: v.durationMinutes ?? 0 })}
    />
  )
}

function CwTab(props: TabProps) {
  const query = useResitCwSchedule()
  const mut = useUpdateResitCwSchedule()
  return (
    <WindowScheduleForm
      {...props}
      kind="cw"
      query={query}
      saving={mut.isPending}
      onSave={({ durationMinutes: _d, ...v }) => mut.mutateAsync(v)}
    />
  )
}

interface WindowValues {
  startDateTime: string
  endDateTime: string
  durationMinutes?: number
  testType: number
  publishStatus: number
  examRuleGuid: string
}

interface WindowForm {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  duration: string
  testType: number
  publishStatus: number
  examRuleGuid: string
}

type WindowSchedule = ResitCtScheduleResponse['schedule'] | ResitCwScheduleResponse['schedule']

// Nothing saved yet: Online, Published.
function windowFormFrom(schedule: WindowSchedule): WindowForm {
  const s = utcToLocalParts(schedule?.startDateTime)
  const e = utcToLocalParts(schedule?.endDateTime)
  return {
    startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
    duration: schedule && 'durationMinutes' in schedule ? String(schedule.durationMinutes) : '60',
    testType: schedule?.testType ?? 0,
    publishStatus: schedule?.publishStatus ?? 1,
    examRuleGuid: schedule?.examRuleGuid ?? '',
  }
}

function validateWindow(f: WindowForm, isCt: boolean): string[] {
  const out: string[] = []
  if (!f.startDate || !f.startTime || !f.endDate || !f.endTime) out.push('Enter the opening and closing date and time.')
  else {
    if (!inRange(f.startDate) || !inRange(f.endDate)) out.push(rangeMsg('Opening and closing dates'))
    const s = new Date(`${f.startDate}T${f.startTime}`).getTime()
    const e = new Date(`${f.endDate}T${f.endTime}`).getTime()
    if (e <= s) out.push('End date-time must be after start date-time.')
    else if (isCt) {
      const d = Number(f.duration)
      if (!/^\d+$/.test(f.duration.trim()) || d < 1 || d > 600) out.push('Duration must be between 1 and 600 minutes.')
      else if (d * 60000 > e - s) out.push('Duration cannot be longer than the window between start and end.')
    }
  }
  if (!f.examRuleGuid) out.push('Select Rule')
  return out
}

// One form for both window tabs (resit-scheduling-page.md, "Tabs 2 and 3").
function WindowScheduleForm({ kind, query, saving, readOnly, readOnlyReason, showToast, onForbidden, onDirtyChange, onSave }: TabProps & {
  kind: 'ct' | 'cw'
  query: {
    data?: ResitCtScheduleResponse | ResitCwScheduleResponse
    isLoading: boolean
    isError: boolean
    error: unknown
    refetch: () => Promise<{ data?: ResitCtScheduleResponse | ResitCwScheduleResponse }>
  }
  saving: boolean
  onSave: (v: WindowValues) => Promise<unknown>
}) {
  const isCt = kind === 'ct'
  const label = isCt ? 'Class Test' : 'Coursework'
  const data = query.data

  const [form, setForm] = useState<WindowForm>(() => windowFormFrom(data?.schedule ?? null))
  const [baseline, setBaseline] = useState<WindowForm>(form)
  const [errors, setErrors] = useState<string[]>([])
  const set = <K extends keyof WindowForm>(k: K, v: WindowForm[K]) => setForm(prev => ({ ...prev, [k]: v }))

  // Fill from the last loaded data — also what Reset does. Windows arrive in
  // UTC and are edited in local time.
  const fill = useCallback((schedule: WindowSchedule) => {
    const f = windowFormFrom(schedule)
    setForm(f)
    setBaseline(f)
  }, [])

  // Keyed on the schedule only: a background refetch with the same content
  // keeps its reference (structural sharing) and leaves edits alone.
  const schedule = data?.schedule ?? null
  useEffect(() => { fill(schedule) }, [schedule, fill])

  const dirty = !readOnly && JSON.stringify(form) !== JSON.stringify(baseline)
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  async function handleSave() {
    if (readOnly || saving) return
    const invalid = validateWindow(form, isCt)
    if (invalid.length) { setErrors(invalid); return }
    setErrors([])
    try {
      await onSave({
        startDateTime: localPartsToUtc(form.startDate, form.startTime),
        endDateTime: localPartsToUtc(form.endDate, form.endTime),
        durationMinutes: isCt ? Number(form.duration) : undefined,
        testType: form.testType,
        publishStatus: form.publishStatus,
        examRuleGuid: form.examRuleGuid,
      })
      showToast(`Resit ${label.toLowerCase()} schedule saved successfully.`)
    } catch (err) {
      const code = errCode(err)
      if (code === 'validation_error') { setErrors(errList(err, 'Please correct the highlighted fields.')); return }
      if (code === 'forbidden') onForbidden()
      setErrors([errMsg(err, `Could not save the ${label.toLowerCase()} schedule.`)])
      // Locked after start / changed by someone else — reload the tab.
      if (code === 'conflict') {
        const res = await query.refetch()
        if (res.data) fill(res.data.schedule)
      }
    }
  }

  if (query.isLoading) return <div className="p-10 text-center"><i className="lni lni-spinner-solid animate-spin text-2xl" style={{ color: 'var(--b500)' }}></i></div>
  if (query.isError || !data) {
    return (
      <div className="p-8 text-center text-sm">
        <div style={{ color: 'var(--red)' }}>{errMsg(query.error, `Could not load the ${label.toLowerCase()} schedule.`)}</div>
        <button className="btn btn-neu btn-sm mt-3" onClick={() => query.refetch()}><i className="lni lni-reload"></i> Retry</button>
      </div>
    )
  }

  const locked = data.locked
  const fieldsOff = readOnly || saving
  const lockedOff = fieldsOff || locked
  const lockMsg = 'Locked — students have started.'

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <div className="card-title mb-5">
        <span className="ctitle-icon"><i className={`lni ${isCt ? 'lni-pencil-alt' : 'lni-timer'}`}></i></span> {label} Schedule
        {!data.schedule && <span className="badge badge-amber" style={{ marginLeft: 8 }}>Not scheduled</span>}
      </div>

      {readOnlyReason && <div className="warn-box mb-5 text-sm"><i className="lni lni-lock mt-0.5"></i><span>{readOnlyReason}</span></div>}

      {locked && (
        <div className="warn-box mb-5 text-sm">
          <i className="lni lni-lock mt-0.5"></i>
          <span>
            <strong>{data.studentsStarted} student{data.studentsStarted === 1 ? ' has' : 's have'} started</strong> — some fields are locked.{' '}
            {isCt ? 'Exam rule, duration and test type' : 'Exam rule and test type'} can no longer change; the window and publish status can still change (extend or close early).
          </span>
        </div>
      )}

      <FormErrors errors={errors} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="lbl">Opens <span className="text-red-500">*</span> <span className="text-g400 font-normal normal-case">(local time)</span></label>
          <div className="flex gap-2 mt-1">
            <div className="flex-1 min-w-0">
              {fieldsOff ? <input className="ctrl w-full" value={fmtDate(form.startDate)} disabled /> : <DatePicker value={form.startDate} onChange={v => set('startDate', v)} maxYmd={maxYmd()} />}
            </div>
            <div className="w-[140px]"><TimePicker value={form.startTime} onChange={v => set('startTime', v)} disabled={fieldsOff} /></div>
          </div>
        </div>
        <div>
          <label className="lbl">Closes <span className="text-red-500">*</span> <span className="text-g400 font-normal normal-case">(local time)</span></label>
          <div className="flex gap-2 mt-1">
            <div className="flex-1 min-w-0">
              {fieldsOff ? <input className="ctrl w-full" value={fmtDate(form.endDate)} disabled /> : <DatePicker value={form.endDate} onChange={v => set('endDate', v)} maxYmd={maxYmd()} />}
            </div>
            <div className="w-[140px]"><TimePicker value={form.endTime} onChange={v => set('endTime', v)} disabled={fieldsOff} /></div>
          </div>
        </div>

        {isCt && (
          <div>
            <label className="lbl">Duration (min) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min={1}
              max={600}
              step={1}
              className="ctrl w-full mt-1"
              value={form.duration}
              onChange={e => set('duration', e.target.value)}
              disabled={lockedOff}
            />
            {locked ? <LockNote>{lockMsg}</LockNote> : <div className="text-xs text-g500 mt-1">1–600 minutes, within the window.</div>}
          </div>
        )}

        <div>
          <label className="lbl">Test Type <span className="text-red-500">*</span></label>
          <Radio2 name={`${kind}TestType`} value={form.testType} onChange={v => set('testType', v)} disabled={lockedOff}
            options={[{ value: 0, label: 'Online' }, { value: 1, label: 'Offline' }]} />
          {locked ? <LockNote>{lockMsg}</LockNote> : <div className="text-xs text-g500 mt-1">Offline is hidden from students.</div>}
        </div>

        <div>
          <label className="lbl">Publish <span className="text-red-500">*</span></label>
          <Radio2 name={`${kind}Publish`} value={form.publishStatus} onChange={v => set('publishStatus', v)} disabled={fieldsOff}
            options={[{ value: 1, label: 'Published' }, { value: 0, label: 'Not published' }]} />
        </div>

        <ExamRuleField
          value={form.examRuleGuid}
          onChange={v => set('examRuleGuid', v)}
          disabled={lockedOff}
          lockNote={locked ? lockMsg : undefined}
          hint={isCt ? undefined : 'Resit coursework uses Section A of the rule only.'}
          highlightSectionA={!isCt}
        />
      </div>

      {!readOnly && (
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200">
          <button className="btn btn-neu" onClick={() => { fill(data.schedule); setErrors([]) }} disabled={saving || !dirty}>Reset</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}
