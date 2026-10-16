'use client'

import { useState, useEffect } from 'react'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { useIntakesDropdown } from '@/hooks/academic/useIntakes'
import { useResitConfigs } from '@/hooks/assessment/useResitConfigs'
import { useResitMarkUpdates, usePushResitMarkUpdate } from '@/hooks/assessment/useResitMarkUpdates'
import type { ResitMarkUpdateItem, ResitMarkUpdatePart } from '@/lib/api/assessment/resitMarkUpdates'
import { useQueryClient } from '@tanstack/react-query'
import { RESIT_MARK_UPDATES_KEYS } from '@/hooks/assessment/useResitMarkUpdates'

// Marks show up to 2 decimals ("30", "13.30"); null (no exam result) shows —.
function fmtMark(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// Ready part whose resit mark won't beat the current one — the push keeps
// the current mark. Only decidable when both marks exist.
function isNotHigher(part: ResitMarkUpdatePart) {
  return part.newMark !== null && part.currentMark !== null && part.newMark <= part.currentMark
}

export default function ResitMarkUpdatePage() {
  const queryClient = useQueryClient()
  const [intakeGuid, setIntakeGuid] = useState<string>('')
  const [resitConfigGuid, setResitConfigGuid] = useState<string>('')
  const [statusTab, setStatusTab] = useState<number>(0)
  const [search, setSearch] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 10

  const { data: intakes, isLoading: intakesLoading } = useIntakesDropdown()

  useEffect(() => {
    if (intakes && intakes.length > 0 && !intakeGuid) {
      const current = intakes.find(i => i.currentIntake) || intakes[0]
      if (current) setIntakeGuid(current.intakeGuid)
    }
  }, [intakes, intakeGuid])

  const { data: resitConfigsData, isLoading: configsLoading, refetch: refetchConfigs } = useResitConfigs(1, 50, intakeGuid || undefined)

  useEffect(() => {
    if (resitConfigsData && resitConfigsData.items.length > 0 && intakeGuid) {
      const active = resitConfigsData.items.find(r => r.isActive) || resitConfigsData.items[0]
      if (active) setResitConfigGuid(active.resitConfigGuid)
    } else if (resitConfigsData && resitConfigsData.items.length === 0) {
      setResitConfigGuid('')
    }
  }, [resitConfigsData, intakeGuid])

  const { data: markUpdatesData, isLoading: updatesLoading, isError: updatesFailed, error: updatesError, refetch: refetchUpdates } = useResitMarkUpdates({
    intakeGuid,
    resitConfigGuid,
    status: statusTab,
    search: search || undefined,
    page,
    pageSize
  }, !!intakeGuid && !!resitConfigGuid)

  // Server-side search (max 100 chars, per the spec): debounced, or at once on Enter.
  function applySearch(text: string) {
    const next = text.trim().slice(0, 100)
    if (next !== search) { setSearch(next); setPage(1) }
  }

  useEffect(() => {
    const timer = setTimeout(() => applySearch(searchInput), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search])

  // Push only exists on the Ready tab (resit-mark-update-page.md, Columns).
  const showAction = statusTab === 0
  const colCount = showAction ? 5 : 4
  const firstColStyle = showAction ? undefined : { textAlign: 'left' as const }

  const summary = markUpdatesData?.summary || { ready: 0, pending: 0, pushed: 0 }
  const noResit = !!resitConfigsData && resitConfigsData.items.length === 0
  const listNotFound = updatesFailed && (updatesError as { code?: string } | null)?.code === 'not_found'

  // 404 on the list = the resit doesn't belong to this session any more:
  // reload the Resit dropdown (its effect re-selects the active one).
  useEffect(() => {
    if (listNotFound) refetchConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listNotFound])

  // Clear the resit too: until the new intake's resits load, the list would
  // otherwise query the new intake with the old intake's resit (→ 404). The
  // effect above selects the new intake's active resit once they arrive.
  const handleIntakeChange = (val: string) => {
    setIntakeGuid(val)
    setResitConfigGuid('')
    setPage(1)
  }

  const handleResitChange = (val: string) => {
    setResitConfigGuid(val)
    setPage(1)
  }

  const [pushModalData, setPushModalData] = useState<ResitMarkUpdateItem | null>(null)
  const pushMutation = usePushResitMarkUpdate()
  const [toastMsg, setToastMsg] = useState<{msg: string, type: 'success' | 'error'} | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToastMsg({ msg, type })
    setTimeout(() => setToastMsg(null), 5000)
  }

  const handlePush = () => {
    if (!pushModalData) return
    pushMutation.mutate(pushModalData.resitApplicationGuid, {
      onSuccess: (res) => {
        const iaMsg = res.ia.status === 3 ? `IA updated to ${res.ia.newMark}.` : res.ia.status === 4 ? `IA not updated — mark not higher.` : `IA stays pending.`
        const ueMsg = res.ue.status === 3 ? `UE updated to ${res.ue.newMark}.` : res.ue.status === 4 ? `UE not updated — mark not higher.` : `UE stays pending.`
        showToast(`${iaMsg} ${ueMsg}`, 'success')
        setPushModalData(null)
      },
      // 400 / 409: the server's message; 404: the application is gone. Reload
      // the list either way (resit-mark-update-page.md, Error handling).
      onError: (err: any) => {
        showToast(err?.code === 'not_found' ? 'This application no longer exists.' : err?.message || 'Error pushing marks', 'error')
        setPushModalData(null)
        queryClient.invalidateQueries({ queryKey: RESIT_MARK_UPDATES_KEYS.lists() })
      }
    })
  }

  const renderMarkCell = (part: ResitMarkUpdatePart) => {
    switch (part.status) {
      case 0:
        return (
          <div>
            <div className="text-gray-400 font-medium">—</div>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] uppercase font-semibold">Not applied</span>
          </div>
        )
      case 1:
        return (
          <div>
            <div className="font-medium">{fmtMark(part.currentMark)} <span className="text-gray-400 font-normal">· waiting</span></div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] uppercase font-semibold">Pending</span>
          </div>
        )
      case 2:
        return (
          <div>
            <div className="font-medium text-blue-600">{fmtMark(part.currentMark)} → {fmtMark(part.newMark)} / {fmtMark(part.maxMark)}</div>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] uppercase font-semibold inline-flex items-center gap-1">
              Ready
              {isNotHigher(part) && <span className="text-gray-500 lowercase font-normal">(lower)</span>}
            </span>
          </div>
        )
      case 3:
        return (
          <div>
            <div className="font-medium text-emerald-600">{fmtMark(part.currentMark)} / {fmtMark(part.maxMark)}</div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] uppercase font-semibold">Updated</span>
          </div>
        )
      case 4:
        return (
          <div>
            <div className="font-medium text-gray-500">{fmtMark(part.currentMark)} / {fmtMark(part.maxMark)}</div>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] uppercase font-semibold">Not updated - lower</span>
          </div>
        )
      default: return null
    }
  }

  return (
    <div className="page active">
      <Toast toast={toastMsg} />
      <div className="pg-hdr flex justify-between items-end">
        <div>
          <h1 className="pg-title">Resit Mark Update</h1>
          <p className="pg-sub">Copy resit marks into exam results</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="w-64">
            <label className="block text-xs font-medium text-gray-600 mb-1">Academic Session</label>
            <SearchSelect
              placeholder="Select Intake..."
              value={intakeGuid}
              onChange={handleIntakeChange}
              disabled={intakesLoading}
              options={(intakes || []).map(i => ({
                value: i.intakeGuid,
                label: `${i.description || 'Intake'} (${i.intakeCode})`
              }))}
            />
          </div>
          <div className="w-64">
            <label className="block text-xs font-medium text-gray-600 mb-1">Resit</label>
            <SearchSelect
              placeholder={configsLoading ? "Loading..." : (resitConfigsData?.items.length === 0 ? "No resit found" : "Select Resit...")}
              value={resitConfigGuid}
              onChange={handleResitChange}
              disabled={configsLoading || !resitConfigsData?.items.length}
              options={(resitConfigsData?.items || []).map(r => ({
                value: r.resitConfigGuid,
                label: r.refCode || 'Unnamed Resit'
              }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
            <button 
              onClick={() => { setStatusTab(0); setPage(1) }}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${statusTab === 0 ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Ready ({summary.ready})
            </button>
            <button 
              onClick={() => { setStatusTab(1); setPage(1) }}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${statusTab === 1 ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Pending ({summary.pending})
            </button>
            <button 
              onClick={() => { setStatusTab(2); setPage(1) }}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-md transition-all ${statusTab === 2 ? 'bg-white shadow-sm text-primary' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Pushed ({summary.pushed})
            </button>
          </div>
          <TableSearch
            className="w-full sm:w-64"
            placeholder="Search student or unit..."
            value={searchInput}
            onChange={v => setSearchInput(v.slice(0, 100))}
            onEnter={() => applySearch(searchInput)}
            results={[]}
            minChars={999}
          />
        </div>

        {/* Without the Action column, Student is the first column: opt out of the
            global sticky + centred action-column styling (.tbl-wrap td:first-child). */}
        <ScrollTable className={showAction ? undefined : 'no-sticky-col'}>
          <table>
            <thead>
              <tr>
                {showAction && <th className="w-24">Action</th>}
                <th style={firstColStyle}>Student</th>
                <th>Course unit</th>
                <th>IA</th>
                <th>UE</th>
              </tr>
            </thead>
            <tbody>
              {noResit ? (
                <EmptyState colSpan={colCount} title="No resit found for this academic session." hasFilters={false} />
              ) : updatesFailed ? (
                <tr><td colSpan={colCount} className="text-center py-8 text-sm">
                  <span style={{ color: 'var(--red)' }}>
                    {listNotFound ? 'Resit not found for the selected academic session.' : (updatesError as { message?: string } | null)?.message || 'Could not load the list.'}
                  </span>{' '}
                  {!listNotFound && <button className="btn btn-neu btn-sm ml-2" onClick={() => refetchUpdates()}><i className="lni lni-reload"></i> Retry</button>}
                </td></tr>
              ) : updatesLoading ? (
                <TableLoadingState colSpan={colCount} title="Loading updates..." />
              ) : !markUpdatesData || markUpdatesData.rows.items.length === 0 ? (
                <EmptyState
                  colSpan={colCount}
                  title={search ? 'No results found' : 'No data yet'}
                  subtitle={
                    search ? 'No students or units match your search.' :
                    statusTab === 0 ? 'Nothing to push — no new resit marks yet.' :
                    statusTab === 1 ? 'No students waiting for resit marks.' :
                    statusTab === 2 ? 'No marks pushed yet for this resit.' :
                    'There are no records to display at the moment.'
                  }
                  hasFilters={!!search}
                  onClearFilters={search ? () => { setSearchInput(''); setSearch(''); setPage(1); } : undefined}
                />
              ) : (
                markUpdatesData?.rows.items.map((row) => (
                  <tr key={row.resitApplicationGuid}>
                    {showAction && (
                      <td className="align-middle">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setPushModalData(row)}
                          disabled={!!row.warning}
                          title={row.warning || 'Push Marks'}
                        >
                          Push
                        </button>
                      </td>
                    )}
                    <td style={firstColStyle}>
                      <div className="font-semibold text-gray-800">{row.studentName}</div>
                      <div className="text-xs text-gray-500">{row.studentNum || row.studentRegNo}</div>
                      <div className="text-xs text-gray-500">{row.programmeName}</div>
                      {row.warning && (
                        <div className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <i className="lni lni-warning"></i> {row.warning}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="font-medium text-gray-800">{row.unitCode} · {row.unitTypeName}</div>
                      <div className="text-sm text-gray-600">{row.unitName}</div>
                    </td>
                    <td>{renderMarkCell(row.ia)}</td>
                    <td>{renderMarkCell(row.ue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollTable>

        {markUpdatesData && markUpdatesData.rows.totalCount > pageSize && (
          <Pagination
            page={page}
            totalPages={Math.ceil(markUpdatesData.rows.totalCount / pageSize)}
            totalCount={markUpdatesData.rows.totalCount}
            itemLabel="rows"
            onPageChange={setPage}
          />
        )}
      </div>

      {pushModalData && (
        <div className="modal-overlay open">
          <div className="modal modal-flex" style={{ maxWidth: 560, borderRadius: 12, height: 'auto', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-hdr modal-hdr-blue" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px' }}>
              <div className="modal-title text-white font-medium text-base" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="lni lni-upload" style={{ fontSize: 18 }}></i> Push Resit Marks
              </div>
              <button
                className="modal-close text-white hover:text-white/80 transition-colors"
                onClick={() => setPushModalData(null)}
                disabled={pushMutation.isPending}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <i className="lni lni-close" style={{ fontSize: 18 }}></i>
              </button>
            </div>

            {/* Content */}
            <div className="modal-scroll p-6 bg-white flex-1 overflow-y-auto">
              {/* Student + unit */}
              <div className="p-4 mb-5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-base font-semibold text-slate-900">{pushModalData.studentName}</span>
                  <span className="font-mono text-sm text-slate-500">{pushModalData.studentNum || pushModalData.studentRegNo}</span>
                </div>
                <div className="text-sm text-slate-600 mt-1">
                  <span className="font-mono font-semibold text-blue">{pushModalData.unitCode}</span>
                  {pushModalData.unitTypeName && <span className="badge badge-grey" style={{ marginLeft: 6 }}>{pushModalData.unitTypeName}</span>}
                  <div className="mt-0.5">{pushModalData.unitName}</div>
                </div>
              </div>

              {/* One tile per applied part (resit-mark-update-page.md, Push confirmation) */}
              <div className="flex flex-col gap-3">
                {([['IA', pushModalData.ia, 'coursework evaluation'], ['UE', pushModalData.ue, 'exam mark']] as const).map(([label, part, waitingFor]) => {
                  if (part.status === 0) return null
                  const pending = part.status === 1
                  const kept = part.status === 2 && isNotHigher(part)
                  const outcome = pending
                    ? { text: 'Stays pending', cls: 'badge-amber' }
                    : kept
                      ? { text: 'Current mark kept', cls: 'badge-grey' }
                      : { text: 'Will be updated', cls: 'badge-green' }
                  return (
                    <div key={label} className="flex items-center gap-4 p-4 rounded-xl border border-slate-200">
                      <span className="badge badge-blue" style={{ minWidth: 36, justifyContent: 'center' }}>{label}</span>
                      <div className="flex-1 min-w-0 text-sm">
                        {pending ? (
                          <span className="text-slate-600">Waiting for the resit {waitingFor}.</span>
                        ) : kept ? (
                          <span className="text-slate-600">
                            Resit <strong>{fmtMark(part.newMark)}</strong> is not higher than <strong>{fmtMark(part.currentMark)}</strong>.
                          </span>
                        ) : (
                          <span className="font-mono text-slate-800">
                            <span className="text-slate-500">{fmtMark(part.currentMark)}</span>
                            <i className="lni lni-arrow-right mx-2 text-slate-400" style={{ fontSize: 12 }}></i>
                            <strong className="text-base" style={{ color: 'var(--green)' }}>{fmtMark(part.newMark)}</strong>
                            <span className="text-slate-500"> / {fmtMark(part.maxMark)}</span>
                          </span>
                        )}
                      </div>
                      <span className={`badge ${outcome.cls}`}>{outcome.text}</span>
                    </div>
                  )
                })}
              </div>

              <div className="info-box mt-5">
                <i className="lni lni-information"></i>
                <span>The exam result is only changed when the resit mark is higher. This updates the student&apos;s IA/UE totals straight away.</span>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-200">
                <button className="btn btn-neu" onClick={() => setPushModalData(null)} disabled={pushMutation.isPending}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handlePush} disabled={pushMutation.isPending}>
                  {pushMutation.isPending ? 'Pushing...' : 'Push Marks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
