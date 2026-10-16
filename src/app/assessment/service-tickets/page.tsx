'use client'

import { useEffect, useMemo, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { Pagination } from '@/components/Pagination'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EmptyState } from '@/components/EmptyState'
import { Toast } from '@/components/Toast'
import { useServiceCategories } from '@/hooks/student/useServiceCategories'
import {
  useServiceTicket,
  useServiceTicketQueue,
  useTicketStatuses,
  useUpdateServiceTicket,
  type TicketStatusOption,
} from '@/hooks/student/useServiceTickets'

// Service Tickets (service-ticket-staff-page.md) — staff triage console for
// student service tickets. Any staff member with
// students.serviceticket.manage sees every ticket in every category, can
// reassign its category, change its status and write a response. Every save
// notifies the student in-app and by email. APIs are not deployed yet; the
// data comes from the mock branch of lib/api/student/serviceTickets.ts.

const PAGE_SIZE = 10
const MAX_RESPONSE = 5000

// Badge colours follow the student portal page: Open yellow, InProgress
// blue, Closed green, Pending orange.
const STATUS_BADGE: Record<string, string> = {
  Open: 'badge-amber',
  InProgress: 'badge-blue',
  Closed: 'badge-green',
  Pending: 'badge-orange',
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

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function errCode(err: unknown) { return (err as { code?: string } | null)?.code }
function errMsg(err: unknown, fallback: string) { return (err as { message?: string } | null)?.message || fallback }

export default function ServiceTicketsPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  // ── Filters ──────────────────────────────────────────────────────────────
  // No status filter by default (doc: product decision) — every ticket shows.
  const [status, setStatus] = useState('')
  const [categoryGuid, setCategoryGuid] = useState('')
  const [page, setPage] = useState(1)

  const { data: statuses = [], isLoading: statusesLoading } = useTicketStatuses()
  const { data: categoriesData, isLoading: categoriesLoading } = useServiceCategories()
  const categories = useMemo(() => categoriesData?.items ?? [], [categoriesData])

  const statusOptions = [{ value: '', label: 'All statuses' }, ...statuses.map(s => ({ value: String(s.value), label: statusLabel(s.name) }))]
  const categoryOptions = [{ value: '', label: 'All categories' }, ...categories.map(c => ({ value: c.serviceCategoryGuid, label: c.categoryName ?? '—' }))]
  const hasFilters = !!status || !!categoryGuid

  function changeStatus(v: string) { setStatus(v); setPage(1) }
  function changeCategory(v: string) { setCategoryGuid(v); setPage(1) }
  function clearFilters() { setStatus(''); setCategoryGuid(''); setPage(1) }

  // ── Queue ────────────────────────────────────────────────────────────────
  const queueQuery = useServiceTicketQueue({
    status: status === '' ? undefined : Number(status),
    categoryGuid: categoryGuid || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const rows = queueQuery.data?.items ?? []
  const totalCount = queueQuery.data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // A save can drop the last row of the last page out of the filter.
  useEffect(() => {
    if (queueQuery.data && rows.length === 0 && totalCount > 0 && page > totalPages) setPage(totalPages)
  }, [queueQuery.data, rows.length, totalCount, page, totalPages])

  // ── Triage panel ─────────────────────────────────────────────────────────
  const [openGuid, setOpenGuid] = useState<string | null>(null)

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div>
            <div className="pg-title">Service Tickets</div>
            <div className="pg-sub">Student service requests — triage, respond and close</div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div className="fg mb-0">
              <label className="lbl">Status</label>
              <SearchSelect options={statusOptions} value={status} onChange={changeStatus} disabled={statusesLoading} />
            </div>
            <div className="fg mb-0">
              <label className="lbl">Category</label>
              <SearchSelect options={categoryOptions} value={categoryGuid} onChange={changeCategory} disabled={categoriesLoading} />
            </div>
            <button className="btn btn-neu" onClick={clearFilters} disabled={!hasFilters}>
              <i className="lni lni-close"></i> Clear
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-title">
              <span className="ctitle-icon"><i className="lni lni-ticket"></i></span> Ticket Queue
              {queueQuery.data && <span className="badge badge-grey" style={{ marginLeft: 8 }}>{totalCount}</span>}
            </div>
          </div>

          {queueQuery.isError ? (
            // Load error: no stale rows (doc, States).
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-title">Couldn&apos;t load tickets</div>
              <div className="empty-sub">{errMsg(queueQuery.error, 'Please try again.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => queueQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : (
            <ScrollTable>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Action</th>
                    <th>Ticket Code</th>
                    <th>Student</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody style={{ opacity: queueQuery.isFetching && !queueQuery.isLoading ? 0.6 : 1 }}>
                  {queueQuery.isLoading ? (
                    <TableLoadingState colSpan={6} title="Loading tickets..." />
                  ) : rows.length === 0 ? (
                    <EmptyState
                      colSpan={6}
                      title="No tickets"
                      subtitle="No tickets match the current filters."
                      hasFilters={hasFilters}
                      onClearFilters={clearFilters}
                    />
                  ) : (
                    rows.map(t => (
                      <tr key={t.ticketGuid}>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => setOpenGuid(t.ticketGuid)}>
                            <i className="lni lni-eye"></i> Open
                          </button>
                        </td>
                        <td className="font-mono font-bold text-b700">{t.ticketCode}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{t.studentName ?? '—'}</div>
                          <div className="font-mono" style={{ fontSize: 11.5, color: 'var(--g500)' }}>{t.studentRegNo ?? '—'}</div>
                        </td>
                        <td>{t.categoryName ?? '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.ticketDate)}</td>
                        <td><StatusBadge name={t.statusName} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollTable>
          )}

          {!queueQuery.isError && totalCount > 0 && (
            <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="tickets" onPageChange={setPage} />
          )}
        </div>
      </div>

      {openGuid && (
        <TriagePanel
          ticketGuid={openGuid}
          statuses={statuses}
          categoryOptions={categoryOptions.slice(1)}
          onClose={() => setOpenGuid(null)}
          onSaved={code => {
            setOpenGuid(null)
            showToast(`Ticket ${code} updated — the student has been notified.`, 'success')
          }}
          onStale={msg => {
            // 404: ticket, category or student is gone — stale data.
            setOpenGuid(null)
            showToast(msg, 'error')
            queueQuery.refetch()
          }}
        />
      )}
      <Toast toast={toast} />
    </>
  )
}

// ── Triage panel ───────────────────────────────────────────────────────────

interface TriagePanelProps {
  ticketGuid: string
  statuses: TicketStatusOption[]
  categoryOptions: { value: string; label: string }[]
  onClose: () => void
  onSaved: (ticketCode: string) => void
  onStale: (message: string) => void
}

function TriagePanel({ ticketGuid, statuses, categoryOptions, onClose, onSaved, onStale }: TriagePanelProps) {
  // Errors that keep the panel open show here, above the overlay.
  const [localToast, setLocalToast] = useState<{ msg: string; type: string } | null>(null)
  function showLocalToast(msg: string, type = 'error') { setLocalToast({ msg, type }); setTimeout(() => setLocalToast(null), 4000) }

  const detailQuery = useServiceTicket(ticketGuid)
  const ticket = detailQuery.data
  const updateMut = useUpdateServiceTicket()

  const [categoryGuid, setCategoryGuid] = useState('')
  const [status, setStatus] = useState('')
  const [responseText, setResponseText] = useState('')

  // Pre-fill once the detail arrives.
  useEffect(() => {
    if (!ticket) return
    setCategoryGuid(ticket.serviceCategoryGuid)
    setStatus(String(ticket.status))
    setResponseText(ticket.responseText ?? '')
  }, [ticket])

  // 404 on open: the ticket is gone — stale queue.
  useEffect(() => {
    if (detailQuery.isError && errCode(detailQuery.error) === 'not_found') onStale(errMsg(detailQuery.error, 'This ticket no longer exists.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.isError, detailQuery.error])

  const selectedStatus = statuses.find(s => String(s.value) === status)
  const statusOptions = statuses.map(s => ({ value: String(s.value), label: statusLabel(s.name) }))
  const dirty = !!ticket && (
    categoryGuid !== ticket.serviceCategoryGuid ||
    status !== String(ticket.status) ||
    responseText !== (ticket.responseText ?? '')
  )
  // Reopening clears closedDate server-side, so hide it as soon as the
  // status moves away from Closed in the panel (doc, Notes).
  const showClosedDate = !!ticket?.closedDate && selectedStatus?.name === 'Closed'

  function handleSave() {
    if (!ticket || !dirty || !selectedStatus) return
    if (!categoryGuid) { showLocalToast('Select a category.'); return }
    if (responseText.length > MAX_RESPONSE) { showLocalToast(`The response can be at most ${MAX_RESPONSE} characters.`); return }
    updateMut.mutate(
      { ticketGuid, payload: { serviceCategoryGuid: categoryGuid, status: selectedStatus.name, responseText } },
      {
        onSuccess: () => onSaved(ticket.ticketCode),
        onError: err => {
          const code = errCode(err)
          if (code === 'not_found') onStale(errMsg(err, 'The ticket, category or student was not found. The queue has been refreshed.'))
          else if (code === 'forbidden') showLocalToast('You no longer have access to manage service tickets.')
          else showLocalToast(errMsg(err, 'Could not save the ticket.'))
        },
      },
    )
  }

  const saving = updateMut.isPending

  return (
    <div className="modal-overlay open">
      {/* .modal-flex fixes height at 85vh; size to content instead, capped there. */}
      <div className="modal modal-flex" style={{ maxWidth: 720, borderRadius: 12, height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
          <div className="modal-title text-white font-medium text-base" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="lni lni-ticket" style={{ fontSize: 18 }}></i> Ticket {ticket?.ticketCode ?? ''}
          </div>
          <button
            className="modal-close text-white hover:text-white/80 transition-colors"
            onClick={onClose}
            disabled={saving}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <i className="lni lni-close" style={{ fontSize: 18 }}></i>
          </button>
        </div>

        {/* Content */}
        <div className="modal-scroll p-6 bg-white flex-1 overflow-y-auto">
          {detailQuery.isLoading ? (
            <div className="flex items-center justify-center text-g400" style={{ minHeight: 180 }}>
              <i className="lni lni-spinner-solid animate-spin text-xl mr-2"></i> Loading ticket…
            </div>
          ) : detailQuery.isError ? (
            <div className="empty">
              <div className="empty-icon"><i className="lni lni-warning"></i></div>
              <div className="empty-sub">{errMsg(detailQuery.error, 'Could not load the ticket.')}</div>
              <button className="btn btn-neu btn-sm mt-3" onClick={() => detailQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
            </div>
          ) : ticket ? (
            <>
              {/* Student + ticket (read-only) */}
              <div className="p-4 mb-5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center rounded-full text-white font-semibold flex-shrink-0"
                      style={{ width: 40, height: 40, background: 'var(--b500)', fontSize: 15 }}
                    >
                      {(ticket.studentName || '?').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900 truncate">{ticket.studentName ?? '—'}</div>
                      <div className="font-mono text-sm text-slate-500">{ticket.studentRegNo ?? '—'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge name={ticket.statusName} />
                    <div className="text-xs text-slate-500 mt-1">Raised {fmtDateTime(ticket.ticketDate)}</div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-g500 uppercase tracking-wide mb-1">Original Request · {ticket.categoryName ?? '—'}</div>
                  <div className="text-sm text-g900" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ticket.serviceText}</div>
                </div>
              </div>

              {/* Triage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="lbl">Category <span className="text-red-500">*</span></label>
                  <SearchSelect options={categoryOptions} value={categoryGuid} onChange={setCategoryGuid} className="w-full mt-1" disabled={saving} />
                </div>
                <div>
                  <label className="lbl">Status <span className="text-red-500">*</span></label>
                  <SearchSelect options={statusOptions} value={status} onChange={setStatus} className="w-full mt-1" disabled={saving} />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="lbl mb-0">Response</label>
                    <span className="text-xs" style={{ color: responseText.length > MAX_RESPONSE * 0.9 ? 'var(--amber)' : 'var(--g500)' }}>
                      {responseText.length.toLocaleString()} / {MAX_RESPONSE.toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    className="ctrl w-full mt-1"
                    rows={5}
                    maxLength={MAX_RESPONSE}
                    placeholder="Write a response to the student…"
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    disabled={saving}
                  />
                </div>

                {showClosedDate && (
                  <div>
                    <div className="text-[11.5px] font-bold text-g500 uppercase tracking-wide mb-1.5">Closed Date</div>
                    <div className="text-[14px] text-g900 font-semibold px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
                      {fmtDateTime(ticket.closedDate)}
                    </div>
                  </div>
                )}
              </div>

              <div className="info-box mt-5">
                <i className="lni lni-envelope"></i>
                <span>Saving notifies the student in-app and by email (personal and university address), including the status and your response.</span>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-200">
                <button className="btn btn-neu" onClick={onClose} disabled={saving}>Cancel</button>
                <span title={!dirty ? 'Nothing has changed.' : undefined}>
                  <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving}>
                    <i className="lni lni-checkmark"></i> {saving ? 'Saving...' : 'Save & Notify'}
                  </button>
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <Toast toast={localToast} />
    </div>
  )
}
