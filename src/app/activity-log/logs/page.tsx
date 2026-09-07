'use client'
import { useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { ScrollTable } from '@/components/ScrollTable'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import DatePicker from '@/components/DatePicker'
import { useAuditSources, useAuditLogs } from '@/hooks/audit/useAudit'
import { useEmployeeDropdown } from '@/hooks/employee/useEmployees'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const pad = (n: number) => String(n).padStart(2, '0')
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12; h = h ? h : 12
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${h}:${pad(d.getMinutes())}${ampm}`
}

function getNextDayISO(dateStr: string) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  // Master data
  const { data: sources = [] } = useAuditSources()
  const { data: employeesData } = useEmployeeDropdown()

  // Build filter options
  const entityOptions = [
    { value: '', label: '— All Entities —' },
    ...sources.flatMap(src => 
      src.pages.map(page => ({
        // We pack auditPath + entityType into the value so we can split it on apply
        value: `${src.auditPath}|${page}`,
        label: `${src.name} — ${page}`
      }))
    ).sort((a, b) => a.label.localeCompare(b.label))
  ]

  const userOptions = [
    { value: '', label: '— All Users —' },
    ...(employeesData?.map(e => ({
      value: e.employeeGuid,
      label: e.displayName
    })) ?? [])
  ]

  // ── Pending filter state (doesn't trigger search yet) ────────
  const [selectedEntityVal, setSelectedEntityVal] = useState('')
  const [selectedUserGuid,  setSelectedUserGuid]  = useState('')
  const [fromDate,          setFromDate]          = useState('')
  const [toDate,            setToDate]            = useState('')

  // ── Active filter state (passed to React Query) ──────────────
  const [activeFilters, setActiveFilters] = useState<{
    userGuid?: string
    from?: string
    to?: string
    entityType?: string
    auditPath?: string
    ready: boolean
  }>({ ready: false })

  const hasAnyPendingFilter = !!(selectedEntityVal || selectedUserGuid || fromDate || toDate)

  // Validation
  const hasUser = !!selectedUserGuid
  const hasEntity = !!selectedEntityVal
  const hasBothDates = !!(fromDate && toDate)
  
  // Validation Rules:
  // 1. If User is selected, Dates are always mandatory.
  // 2. If NO Entity is selected, it forces an 'All' (consolidated) search. 
  //    The backend requires User + Dates for a consolidated search.
  const isValid = hasEntity 
    ? (hasUser ? hasBothDates : true) // Entity selected: Date only mandatory if User is also selected
    : (hasUser && hasBothDates)       // No Entity selected: User AND Date are both mandatory

  function applyFilters() {
    if (!isValid) return

    let auditPath = ''
    let entityType = ''
    if (selectedEntityVal) {
      const parts = selectedEntityVal.split('|')
      auditPath = parts[0]
      entityType = parts[1]
    }

    setActiveFilters({
      userGuid: selectedUserGuid || undefined,
      from: fromDate ? new Date(fromDate).toISOString() : undefined,
      to: toDate ? getNextDayISO(toDate) : undefined,
      entityType: entityType || undefined,
      auditPath: auditPath || undefined,
      ready: true
    })
  }

  function clearFilters() {
    setSelectedEntityVal('')
    setSelectedUserGuid('')
    setFromDate('')
    setToDate('')
    setActiveFilters({ ready: false })
  }

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading 
  } = useAuditLogs(activeFilters, activeFilters.ready)

  const rows = data?.pages.flatMap(p => p.items) ?? []
  const isInitialLoad = isLoading && activeFilters.ready

  return (
    <div id="page-activity-log">

      <style>{`
        .al-action {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.6px;
          white-space: nowrap;
          background: #e0f2fe; color: #0369a1;
        }
      `}</style>

      {/* ── Page Header ── */}
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Audit Log</h1>
          <p className="text-sm text-g500 mt-0.5">
            Track all system events and record changes across modules
          </p>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="card mb-4">
        <h2 className="text-base font-semibold text-g800 mb-4">Filter Audit Logs</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* User */}
          <div className="fg mb-0">
            <label className="lbl">Employee (User)</label>
            <SearchSelect
              placeholder="— All Users —"
              value={selectedUserGuid}
              onChange={setSelectedUserGuid}
              options={userOptions}
            />
          </div>

          {/* Entity */}
          <div className="fg mb-0">
            <label className="lbl">Module Entity</label>
            <SearchSelect
              placeholder="— All Entities —"
              value={selectedEntityVal}
              onChange={setSelectedEntityVal}
              options={entityOptions}
            />
          </div>

          {/* From Date */}
          <div className="fg mb-0">
            <label className="lbl">From Date {hasUser && <span className="text-red-500">*</span>}</label>
            <DatePicker
              value={fromDate}
              onChange={setFromDate}
              placeholder="dd/mm/yyyy"
              maxYmd={toDate || undefined}
            />
          </div>

          {/* To Date */}
          <div className="fg mb-0">
            <label className="lbl">To Date {hasUser && <span className="text-red-500">*</span>}</label>
            <DatePicker
              value={toDate}
              onChange={setToDate}
              placeholder="dd/mm/yyyy"
            />
          </div>

        </div>

        {hasUser && !hasBothDates && (
          <div className="mt-3 text-xs text-red-600 flex items-center gap-1.5">
            <i className="lni lni-warning" />
            Please select both From Date and To Date when filtering by an Employee.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4 justify-end">
          {hasAnyPendingFilter && (
            <button className="btn btn-neu" onClick={clearFilters}>
              <i className="lni lni-close" />
              Clear Filters
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={applyFilters}
            disabled={!isValid || isInitialLoad}
          >
            <i className={`lni ${isInitialLoad ? 'lni-reload lni-spin' : 'lni-search-alt'}`} />
            {isInitialLoad ? 'Searching…' : 'Apply Filters'}
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      {activeFilters.ready && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-semibold text-g800">Audit Results</h2>
              <p className="text-xs text-g400 mt-0.5">
                {isInitialLoad ? 'Fetching audit records…' : 'Showing retrieved records'}
              </p>
            </div>
          </div>

          <ScrollTable>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Timestamp</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th style={{ minWidth: 200 }}>Summary</th>
                  <th>Changes</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {isInitialLoad
                  ? <TableLoadingState colSpan={8} />
                  : rows.length === 0
                    ? <EmptyState 
                        colSpan={8} 
                        hasFilters={true} 
                        onClearFilters={clearFilters} 
                        subtitle="No audit records match the selected filters."
                      />
                    : null}
                {rows.map(row => (
                  <tr key={row.cursor}>
                    <td className="font-mono text-xs text-g700 whitespace-nowrap">
                      {formatTimestamp(row.timestamp)}
                    </td>
                    <td>
                      <div className="font-medium text-g900 leading-tight">{row.userName || 'Unknown'}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="text-g800 font-medium">{row.module}</span>
                    </td>
                    <td className="whitespace-nowrap text-g700">{row.entityType}</td>
                    <td>
                      <span className="al-action">{row.action}</span>
                    </td>
                    <td className="text-g700 text-xs">
                      {row.summary}
                    </td>
                    <td className="text-g600 text-xs font-mono max-w-xs truncate" title={row.changes || ''}>
                      {row.changes || '—'}
                    </td>
                    <td className="font-mono text-xs text-g600 whitespace-nowrap">
                      {row.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>

          {/* Load More Pagination */}
          {!isInitialLoad && hasNextPage && (
            <div className="mt-4 flex justify-center">
              <button 
                className="btn btn-neu btn-sm" 
                onClick={() => fetchNextPage()} 
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <><i className="lni lni-reload lni-spin" /> Loading more...</>
                ) : (
                  <><i className="lni lni-chevron-down" /> Load More Records</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Initial empty state prompt ── */}
      {!activeFilters.ready && (
        <div className="card">
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <i className="lni lni-list" style={{ fontSize: 26, color: '#2E6BE6' }} />
            </div>
            <div className="text-sm font-semibold text-g700 mt-1">Select Filters to View Audit Log</div>
            <div className="text-xs text-g400 max-w-sm">
              Use the filters above to search audit logs. Note that filtering by an Employee requires a date range.
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
