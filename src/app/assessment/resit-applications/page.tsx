'use client'

import { useState, useEffect } from 'react'
import { useResitAppCourseUnits, useResitApplications } from '@/hooks/assessment/useResitApplications'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'

// Resit Applications (resit-applications-list-page.md) — read-only list of
// every resit application under the active resit of the current intake.

const PAGE_SIZE = 10
const NO_RESIT_MSG = 'There is no active resit in this academic intake.'

function errMsg(err: unknown, fallback: string) {
  return (err as { message?: string } | null)?.message || fallback
}

export default function ResitApplicationsListPage() {
  const [courseUnitGuid, setCourseUnitGuid] = useState('')
  const [feeStatus, setFeeStatus] = useState<number | undefined>(undefined)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: courseUnits, isLoading: courseUnitsLoading } = useResitAppCourseUnits()
  const appsQuery = useResitApplications({
    courseUnitGuid: courseUnitGuid || undefined,
    feeStatus,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const data = appsQuery.data
  const items = data?.applications.items ?? []
  const totalCount = data?.applications.totalCount ?? 0
  const summary = data?.summary ?? { total: 0, paid: 0, unpaid: 0 }
  const noResit = !!data && data.resit === null
  const filtered = !!courseUnitGuid || feeStatus !== undefined || !!search

  // Page past the end (e.g. rows removed meanwhile) → go back to the last page.
  useEffect(() => {
    if (data && items.length === 0 && totalCount > 0 && page > 1) {
      setPage(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)))
    }
  }, [data, items.length, totalCount, page])

  function doSearch() { setSearch(searchInput.trim()); setPage(1) }
  function doClear() { setSearchInput(''); setSearch(''); setPage(1) }

  const feeOptions: { value: number | undefined; label: string; count: number }[] = [
    { value: undefined, label: 'All', count: summary.total },
    { value: 1, label: 'Paid', count: summary.paid },
    { value: 0, label: 'Unpaid', count: summary.unpaid },
  ]

  const emptyTitle = noResit
    ? NO_RESIT_MSG
    : filtered ? 'No applications match the filters.' : 'No resit applications yet.'

  return (
    <div className="page active">
      <div className="pg-hdr">
        <div>
          <div className="pg-title">Resit Applications</div>
          <div className="pg-sub">
            {data?.resit ? <>Active resit: <strong>{data.resit.refCode}</strong></> : appsQuery.isLoading ? 'Loading the active resit…' : 'No active resit'}
          </div>
        </div>
      </div>

      {noResit && <div className="warn-box mb-5"><i className="lni lni-warning mt-0.5"></i><span>{NO_RESIT_MSG}</span></div>}

      <div className="card">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="w-full md:w-80">
              <label className="lbl">Course Unit</label>
              <SearchSelect
                placeholder="All units"
                value={courseUnitGuid}
                onChange={v => { setCourseUnitGuid(v); setPage(1) }}
                disabled={courseUnitsLoading || noResit}
                className="w-full mt-1"
                options={[
                  { value: '', label: 'All units' },
                  ...(courseUnits ?? []).map(u => ({ value: u.courseUnitGuid, label: `${u.unitName} (${u.unitCode})` })),
                ]}
              />
            </div>
            <div>
              <label className="lbl">Fee</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {feeOptions.map(o => (
                  <button
                    key={o.label}
                    className={`btn btn-sm ${feeStatus === o.value ? 'btn-primary' : 'btn-neu'}`}
                    onClick={() => { setFeeStatus(o.value); setPage(1) }}
                    disabled={noResit}
                  >
                    {o.label} <span className="font-mono">{o.count.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative w-full sm:w-96">
              <i className="lni lni-search-alt absolute left-3 top-1/2 -translate-y-1/2 text-g400 pointer-events-none"></i>
              <input
                className="ctrl w-full"
                style={{ paddingLeft: 34 }}
                placeholder="Reg no, student no, name, unit code or name"
                maxLength={100}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
                disabled={noResit}
              />
            </div>
            <button className="btn btn-neu" onClick={doSearch} disabled={noResit}>Search</button>
            <button className="btn btn-neu" onClick={doClear} disabled={!searchInput && !search}>Clear</button>
          </div>
        </div>

        {appsQuery.isError ? (
          <div className="empty">
            <div className="empty-icon"><i className="lni lni-warning"></i></div>
            <div className="empty-title">Couldn&apos;t load applications</div>
            <div className="empty-sub">{errMsg(appsQuery.error, 'Please try again.')}</div>
            <button className="btn btn-neu btn-sm mt-3" onClick={() => appsQuery.refetch()}><i className="lni lni-reload"></i> Retry</button>
          </div>
        ) : (
          <ScrollTable className="no-sticky-col">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Student No</th>
                  <th>Student Name</th>
                  <th>Programme</th>
                  <th>Campus</th>
                  <th>Code</th>
                  <th>Course Unit</th>
                  <th>Type</th>
                  <th className="text-center">CW</th>
                  <th className="text-center">UE</th>
                  <th className="text-center">Fee</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody style={{ opacity: appsQuery.isFetching && !appsQuery.isLoading ? 0.6 : 1 }}>
                {appsQuery.isLoading ? (
                  <TableLoadingState colSpan={12} title="Loading applications..." />
                ) : items.length === 0 ? (
                  <EmptyState colSpan={12} title={emptyTitle} hasFilters={filtered && !noResit} onClearFilters={() => { setCourseUnitGuid(''); setFeeStatus(undefined); doClear() }} />
                ) : (
                  items.map(app => (
                    <tr key={app.resitApplicationGuid}>
                      <td className="font-mono whitespace-nowrap" style={{ textAlign: 'left' }}>{app.studentRegNo || '—'}</td>
                      <td><strong>{app.studentName || '—'}</strong></td>
                      <td><div className="truncate max-w-[220px]" title={app.programName}>{app.programName || '—'}</div></td>
                      <td><div className="truncate max-w-[180px]" title={app.campusName}>{app.campusName || '—'}</div></td>
                      <td className="font-mono whitespace-nowrap">{app.unitCode}</td>
                      <td><div className="truncate max-w-[220px]" title={app.unitName}>{app.unitName}</div></td>
                      <td>{app.unitTypeName || '—'}</td>
                      <td className="text-center">{app.cw ? <span className="badge badge-blue">Yes</span> : <span className="text-g400">No</span>}</td>
                      <td className="text-center">{app.ue ? <span className="badge badge-blue">Yes</span> : <span className="text-g400">No</span>}</td>
                      <td className="text-center">
                        {app.feeStatus === 1 ? <span className="badge badge-green">Paid</span> : <span className="badge badge-amber">Unpaid</span>}
                      </td>
                      <td>{app.email ? <a href={`mailto:${app.email}`} className="text-blue hover:underline">{app.email}</a> : '—'}</td>
                      <td className="whitespace-nowrap">{app.phone ? <a href={`tel:${app.phone}`} className="text-blue hover:underline">{app.phone}</a> : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollTable>
        )}

        {totalCount > PAGE_SIZE && (
          <Pagination page={page} totalPages={Math.ceil(totalCount / PAGE_SIZE)} totalCount={totalCount} itemLabel="applications" onPageChange={setPage} />
        )}
      </div>
    </div>
  )
}
