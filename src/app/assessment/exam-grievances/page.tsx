'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { Toast } from '@/components/Toast'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import {
  useExamGrievance,
  useExamGrievances,
  useGrievanceStatuses,
  useUpdateGrievanceStatus,
  type GrievancePaymentFilter,
  type GrievanceStatusFilter,
  type GrievanceStatusOption,
} from '@/hooks/student/useExamGrievances'

// Exam Grievance Management (exam-grievance-management-page.md). The exam
// office works through the exam grievances students raise from the portal:
// list them per academic session (active ones first), open one in a side
// panel to check the student, unit, payment and matching code, then set the
// status and write a response — saved and emailed to the student. APIs are
// not deployed yet; data comes from the mock branch of
// lib/api/student/examGrievances.ts.

const PAGE_SIZE = 10
const MAX_RESPONSE = 5000

const TABS: { key: GrievanceStatusFilter; label: string; count: 'active' | 'open' | 'inProgress' | 'pending' | 'closed' | 'all' }[] = [
  { key: 'Active', label: 'Active', count: 'active' },
  { key: 'Open', label: 'Open', count: 'open' },
  { key: 'InProgress', label: 'In Progress', count: 'inProgress' },
  { key: 'Pending', label: 'Pending', count: 'pending' },
  { key: 'Closed', label: 'Closed', count: 'closed' },
  { key: 'All', label: 'All', count: 'all' },
]

const PAYMENT_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Paid', label: 'Paid' },
  { value: 'NotPaid', label: 'Not paid' },
]

// Open amber · In Progress blue · Pending purple · Closed green (doc, Columns).
const STATUS_BADGE: Record<string, string> = {
  Open: 'badge-amber',
  InProgress: 'badge-blue',
  Pending: 'badge-purple',
  Closed: 'badge-green',
}

function statusLabel(name: string | null | undefined) {
  if (!name) return '—'
  return name === 'InProgress' ? 'In Progress' : name
}

function StatusBadge({ name }: { name: string | null | undefined }) {
  return (
    <span className={`badge ${STATUS_BADGE[name ?? ''] ?? 'badge-grey'}`}>
      <span className="bdot"></span> {statusLabel(name)}
    </span>
  )
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function errCode(err: unknown) { return (err as { code?: string } | null)?.code }
function errMsg(err: unknown, fallback: string) { return (err as { message?: string } | null)?.message || fallback }

export default function ExamGrievancesPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 4000) }

  // ── Filters ──────────────────────────────────────────────────────────────
  const [intakeGuid, setIntakeGuid] = useState('')
  const [tab, setTab] = useState<GrievanceStatusFilter>('Active')
  const [payment, setPayment] = useState<'' | GrievancePaymentFilter>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: intakes = [], isLoading: intakesLoading } = useIntakesDropdown()
  useEffect(() => {
    if (intakeGuid || !intakes.length) return
    setIntakeGuid((intakes.find(i => i.currentIntake) ?? intakes[0]).intakeGuid)
  }, [intakes, intakeGuid])
  const intakeOptions = intakes.map(i => ({ value: i.intakeGuid, label: i.description ? `${i.description} (${i.intakeCode})` : String(i.intakeCode) }))

  // Debounced search; resets to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim().slice(0, 100)
      if (next !== search) { setSearch(next); setPage(1) }
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput, search])

  const { data: statuses = [] } = useGrievanceStatuses()

  // ── List ─────────────────────────────────────────────────────────────────
  const listQuery = useExamGrievances({
    intakeGuid,
    status: tab,
    paymentStatus: payment || undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const summary = listQuery.data?.summary
  const rows = listQuery.data?.grievances.items ?? []
  const totalCount = listQuery.data?.grievances.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // A save can move the last row of the last page out of the tab.
  useEffect(() => {
    if (listQuery.data && rows.length === 0 && totalCount > 0 && page > totalPages) setPage(totalPages)
  }, [listQuery.data, rows.length, totalCount, page, totalPages])

  const filtered = !!payment || !!search
  let emptyMessage = 'No grievances match your filters.'
  if (!filtered && summary?.all === 0) emptyMessage = 'No exam grievances have been raised for this session.'
  else if (!filtered && tab === 'Active' && (summary?.all ?? 0) > 0) emptyMessage = 'All grievances for this session are closed.'

  function changeTab(t: GrievanceStatusFilter) { setTab(t); setPage(1) }
  function clearFilters() { setPayment(''); setSearchInput(''); setSearch(''); setPage(1) }

  // ── Side panel ───────────────────────────────────────────────────────────
  const [openGuid, setOpenGuid] = useState<string | null>(null)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Exam Grievance Management</div>
            <div className="pg-sub">Review exam grievances raised by students and respond to them</div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_0.8fr_1.5fr] gap-4 items-end">
            <div className="fg mb-0">
              <label className="lbl">Academic Session <span className="req">*</span></label>
              <SearchSelect
                placeholder={intakesLoading ? 'Loading…' : 'Select academic session'}
                options={intakeOptions}
                value={intakeGuid}
                onChange={v => { setIntakeGuid(v); setPage(1) }}
                disabled={intakesLoading}
              />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Payment</label>
              <SearchSelect options={PAYMENT_OPTIONS} value={payment} onChange={v => { setPayment(v as '' | GrievancePaymentFilter); setPage(1) }} />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Search</label>
              <div className="inp-wrap">
                <i className="lni lni-search-alt inp-icon"></i>
                <input
                  className="ctrl"
                  placeholder="Code, student, unit…"
                  maxLength={100}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="tab-bar" style={{ borderBottom: '1px solid var(--g200)', overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => changeTab(t.key)} style={{ whiteSpace: 'nowrap' }}>
                {t.label} <span className={`badge ${tab === t.key ? 'badge-blue' : 'badge-grey'}`}>{summary ? summary[t.count] : '–'}</span>
              </button>
            ))}
          </div>

          {listQuery.isError ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-title">Couldn&apos;t load grievances</div>
              <div className="empty-sub">{errMsg(listQuery.error, 'Please try again.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => listQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : (
            // No action column — the whole row opens the grievance, so opt out
            // of the sticky, centred first-column styling.
            <ScrollTable className="no-sticky-col">
              <table>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Code</th>
                    <th>Student</th>
                    <th>Programme / Batch</th>
                    <th>Course Unit</th>
                    <th>Status</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody style={{ opacity: listQuery.isFetching && !listQuery.isLoading ? 0.6 : 1 }}>
                  {!intakeGuid || listQuery.isLoading ? (
                    <TableLoadingState colSpan={6} title="Loading grievances..." />
                  ) : rows.length === 0 ? (
                    <EmptyState colSpan={6} title="No grievances" subtitle={emptyMessage} hasFilters={filtered} onClearFilters={clearFilters} />
                  ) : (
                    rows.map(g => (
                      <tr
                        key={g.grievanceGuid}
                        onClick={() => setOpenGuid(g.grievanceGuid)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenGuid(g.grievanceGuid) } }}
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        title="Open grievance"
                      >
                        <td style={{ textAlign: 'left' }}>
                          <div className="font-mono font-bold text-b700" style={{ whiteSpace: 'nowrap' }}>{g.grievanceCode}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--g500)' }}>{fmtDate(g.grievanceDate)}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{g.studentName ?? '—'}</div>
                          <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--g500)' }}>{g.studentNum ?? '—'}</div>
                        </td>
                        <td>
                          <div>{g.programCode ?? '—'}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--g500)' }}>{g.batchCode ?? '—'}</div>
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          <div className="truncate" title={g.unitName ?? undefined}>{g.unitName ?? '—'}</div>
                          <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--g500)' }}>{g.unitCode ?? '—'}</div>
                        </td>
                        <td><StatusBadge name={g.statusName} /></td>
                        <td>
                          {g.receiptNumber
                            ? <span className="font-mono">{g.receiptNumber}</span>
                            : <span style={{ color: 'var(--red)', fontWeight: 600 }}>Not paid</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollTable>
          )}

          {!listQuery.isError && totalCount > 0 && (
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="grievances" onPageChange={setPage} />
          )}
        </div>
      </div>

      {openGuid && (
        <GrievancePanel
          grievanceGuid={openGuid}
          statuses={statuses}
          onClose={() => setOpenGuid(null)}
          onSaved={msg => { setOpenGuid(null); showToast(msg, 'success') }}
          onStale={msg => {
            // 404: the student may have deleted it — close and reload.
            setOpenGuid(null)
            showToast(msg, 'error')
            listQuery.refetch()
          }}
        />
      )}
      <Toast toast={toast} />
    </>
  )
}

// ── Grievance side panel ───────────────────────────────────────────────────

interface GrievancePanelProps {
  grievanceGuid: string
  statuses: GrievanceStatusOption[]
  onClose: () => void
  onSaved: (message: string) => void
  onStale: (message: string) => void
}

function GrievancePanel({ grievanceGuid, statuses, onClose, onSaved, onStale }: GrievancePanelProps) {
  const [localToast, setLocalToast] = useState<{ msg: string; type: string } | null>(null)
  function showLocalToast(msg: string, type = 'error') { setLocalToast({ msg, type }); setTimeout(() => setLocalToast(null), 4000) }

  const detailQuery = useExamGrievance(grievanceGuid)
  const g = detailQuery.data
  const updateMut = useUpdateGrievanceStatus()

  const [status, setStatus] = useState('')
  const [response, setResponse] = useState('')
  const [errors, setErrors] = useState<{ status?: string; response?: string }>({})
  const [forbidden, setForbidden] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [copied, setCopied] = useState(false)

  // Pre-select the current status; Response starts empty (doc, flow 3).
  useEffect(() => {
    if (g) setStatus(String(g.status))
  }, [g])

  // 404 on open — the student may have deleted it.
  useEffect(() => {
    if (detailQuery.isError && errCode(detailQuery.error) === 'not_found') onStale(errMsg(detailQuery.error, 'Grievance not found.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.isError, detailQuery.error])

  const saving = updateMut.isPending
  const statusOptions = useMemo(() => statuses.map(s => ({ value: String(s.value), label: statusLabel(s.name) })), [statuses])

  // Cancel / ✕ / backdrop / Esc — ask first when a response has been typed.
  function requestClose() {
    if (saving) return
    if (response.trim()) setConfirmDiscard(true)
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

  async function copyMatchingCode() {
    if (!g?.matchingCode) return
    try {
      await navigator.clipboard.writeText(g.matchingCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showLocalToast('Could not copy. Select the code and copy it manually.')
    }
  }

  function handleSave() {
    if (!g || saving || forbidden) return
    const next: typeof errors = {}
    if (!status) next.status = 'Select a status.'
    if (!response.trim()) next.response = 'Enter a response for the student.'
    else if (response.length > MAX_RESPONSE) next.response = 'Response must be 5000 characters or fewer.'
    setErrors(next)
    if (next.status || next.response) return

    updateMut.mutate(
      { grievanceGuid, payload: { status: Number(status), response } },
      {
        onSuccess: res => onSaved(
          res?.emailQueued === false
            ? `Grievance ${g.grievanceCode} updated. The student has no email address on file, so no email was sent.`
            : `Grievance ${g.grievanceCode} updated. The student has been emailed.`,
        ),
        onError: err => {
          const e = err as { code?: string; message?: string; errors?: string[] }
          if (e.code === 'not_found') {
            onStale(errMsg(err, 'Grievance not found.'))
          } else if (e.code === 'forbidden') {
            setForbidden(true)
            showLocalToast('You do not have permission to update grievances.')
          } else if (e.code === 'validation_error') {
            // Put each message under its field; keep the panel open.
            const msgs = e.errors?.length ? e.errors : [errMsg(err, 'Check the form.')]
            const fieldErrors: typeof errors = {}
            for (const m of msgs) {
              if (/status/i.test(m)) fieldErrors.status = fieldErrors.status ?? m
              else fieldErrors.response = fieldErrors.response ?? m
            }
            setErrors(fieldErrors)
          } else {
            showLocalToast(errMsg(err, 'Could not save the grievance.'))
          }
        },
      },
    )
  }

  return (
    <div className="drawer-overlay">
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Exam grievance" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-hdr">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <i className="lni lni-files" style={{ fontSize: 18 }}></i>
                <span className="font-mono font-semibold text-base">{g?.grievanceCode ?? 'Grievance'}</span>
                {g && <StatusBadge name={g.statusName} />}
              </div>
              {g && <div className="text-xs mt-1" style={{ opacity: 0.85 }}>Submitted {fmtDate(g.grievanceDate)}</div>}
            </div>
            <button onClick={requestClose} disabled={saving} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--white)', cursor: 'pointer', padding: 2 }}>
              <i className="lni lni-close" style={{ fontSize: 18 }}></i>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center text-g400" style={{ minHeight: 200 }}>
              <i className="lni lni-spinner-solid animate-spin text-xl mr-2"></i> Loading grievance…
            </div>
          ) : detailQuery.isError ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-sub">{errMsg(detailQuery.error, 'Could not load the grievance.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => detailQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : g ? (
            <div className="flex flex-col gap-5">
              {/* Student */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="text-base font-semibold text-slate-900">{g.studentName ?? '—'}</div>
                  <div className="font-mono text-sm text-slate-500">{g.studentNum ?? '—'}</div>
                </div>
                <div className="text-sm text-slate-600 mt-0.5">{g.programName ?? '—'} · {g.batchCode ?? '—'}</div>
                {(g.email || g.universityEmail || g.phone) && (
                  <div className="flex flex-col gap-1 mt-3 text-sm">
                    {g.email && <a href={`mailto:${g.email}`} className="text-b700 hover:underline truncate"><i className="lni lni-envelope mr-1.5"></i>{g.email}</a>}
                    {g.universityEmail && <a href={`mailto:${g.universityEmail}`} className="text-b700 hover:underline truncate"><i className="lni lni-envelope mr-1.5"></i>{g.universityEmail}</a>}
                    {g.phone && <a href={`tel:${g.phone.replace(/\s+/g, '')}`} className="text-b700 hover:underline"><i className="lni lni-phone mr-1.5"></i>{g.phone}</a>}
                  </div>
                )}
              </div>

              {/* Unit, payment, matching code */}
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-200 text-sm">
                <div className="flex gap-3 px-4 py-3">
                  <div className="w-28 flex-shrink-0 text-g500">Course unit</div>
                  <div className="min-w-0"><span className="font-mono font-semibold">{g.unitCode ?? '—'}</span> · {g.unitName ?? '—'}</div>
                </div>
                <div className="flex gap-3 px-4 py-3">
                  <div className="w-28 flex-shrink-0 text-g500">Receipt</div>
                  <div>{g.receiptNumber ? <span className="font-mono">{g.receiptNumber}</span> : <span style={{ color: 'var(--red)', fontWeight: 600 }}>Not paid</span>}</div>
                </div>
                <div className="flex gap-3 px-4 py-3 items-center">
                  <div className="w-28 flex-shrink-0 text-g500">Matching code</div>
                  {g.matchingCode ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono font-bold text-base tracking-wider">{g.matchingCode}</span>
                      <button className="btn btn-neu btn-sm" onClick={copyMatchingCode}>
                        <i className={`lni ${copied ? 'lni-checkmark' : 'lni-files'}`}></i> {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-g500 italic">Not available: the student has no exam result for this unit yet.</div>
                  )}
                </div>
              </div>

              {/* Grievance */}
              <div>
                <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-1.5">Grievance</div>
                <div className="text-sm text-g900 px-4 py-3 rounded-lg border border-slate-200 bg-slate-50" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {g.grievanceText}
                </div>
              </div>

              {/* Last response */}
              {g.responseText && (
                <div>
                  <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-1.5">
                    Last response · {fmtDate(g.respondedDate)}{g.respondedByName ? ` · ${g.respondedByName}` : ''}
                  </div>
                  <div className="text-sm text-g800 px-4 py-3 rounded-lg" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--b50)', borderLeft: '3px solid var(--b500)' }}>
                    {g.responseText}
                  </div>
                </div>
              )}

              {/* Status + response */}
              <div className="pt-5 border-t border-slate-200 flex flex-col gap-4">
                <div>
                  <label className="lbl">Status <span className="text-red-500">*</span></label>
                  <SearchSelect
                    options={statusOptions}
                    value={status}
                    onChange={v => { setStatus(v); setErrors(prev => ({ ...prev, status: undefined })) }}
                    className="w-full mt-1"
                    disabled={saving || forbidden}
                  />
                  {errors.status && <div className="text-xs mt-1" style={{ color: 'var(--red)' }}>{errors.status}</div>}
                </div>
                <div>
                  <label className="lbl">Response <span className="text-red-500">*</span></label>
                  <textarea
                    className="ctrl w-full mt-1"
                    rows={5}
                    maxLength={MAX_RESPONSE}
                    placeholder="Write the response the student will receive…"
                    value={response}
                    onChange={e => { setResponse(e.target.value); if (errors.response) setErrors(prev => ({ ...prev, response: undefined })) }}
                    disabled={saving || forbidden}
                    style={errors.response ? { borderColor: 'var(--red)' } : undefined}
                  />
                  <div className="flex items-start justify-between gap-3 mt-1">
                    <div className="text-xs" style={{ color: 'var(--red)' }}>{errors.response}</div>
                    <div className="text-xs flex-shrink-0" style={{ color: response.length > MAX_RESPONSE * 0.9 ? 'var(--amber)' : 'var(--g500)' }}>
                      {response.length.toLocaleString()} / {MAX_RESPONSE.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="info-box">
                  <i className="lni lni-envelope"></i>
                  <span>The student is emailed on save, at both their personal and university address.</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {g && (
          <div className="drawer-ftr">
            <button className="btn btn-neu" onClick={requestClose} disabled={saving}>Cancel</button>
            <span title={forbidden ? 'You do not have permission to update grievances.' : undefined}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || forbidden}>
                <i className="lni lni-envelope"></i> {saving ? 'Saving...' : 'Save & email'}
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Discard confirmation — same pattern as Resit Apply's delete confirm */}
      {confirmDiscard && (
        <div className="perm-delete-overlay" style={{ position: 'fixed', zIndex: 600 }} onClick={e => { e.stopPropagation(); setConfirmDiscard(false) }}>
          <div className="perm-delete-card tab-panel-in" onClick={e => e.stopPropagation()}>
            <div className="perm-delete-icon"><i className="lni lni-warning"></i></div>
            <div className="perm-delete-title">Discard this response?</div>
            <div className="perm-delete-sub">The response you typed has not been saved.</div>
            <div className="perm-delete-actions">
              <button className="btn btn-neu" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button className="btn btn-danger" onClick={onClose}>Discard</button>
            </div>
          </div>
        </div>
      )}
      <div onClick={e => e.stopPropagation()}><Toast toast={localToast} /></div>
    </div>
  )
}
