'use client'
import { useEffect, useState } from 'react'
import { SearchSelect } from '@/components/SearchSelect'
import { BulkEmailJobStatus, JOB_STATUSES, isJobActive, useBulkEmails } from '@/hooks/student/useBulkEmail'
import { JOB_STATUS_DISPLAY, JobStatusBadge, ProgressBar, ReconnectingHint, formatWhen, jobProgress, useDebounced, useNow } from './shared'

export const LIST_PAGE_SIZE = 20

export interface ListFilters {
  status: BulkEmailJobStatus | ''
  search: string
  // yyyy-mm-dd, as the date inputs hold them.
  from: string
  to: string
  page: number
}

export const EMPTY_LIST_FILTERS: ListFilters = { status: '', search: '', from: '', to: '', page: 1 }

// Date inputs are local dates. `from` becomes the start of that day and `to`
// the END of that day — otherwise jobs created on the `to` day are left out.
function toIsoStart(ymd: string) { return ymd ? new Date(`${ymd}T00:00:00`).toISOString() : null }
function toIsoEnd(ymd: string) { return ymd ? new Date(`${ymd}T23:59:59.999`).toISOString() : null }

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...JOB_STATUSES.map(s => ({ value: s, label: JOB_STATUS_DISPLAY[s].label }))]

interface Props {
  filters: ListFilters
  onFiltersChange: (next: ListFilters) => void
  onOpen: (jobGuid: string) => void
  onCompose: () => void
  canCompose: boolean
}

export function MailList({ filters, onFiltersChange, onOpen, onCompose, canCompose }: Props) {
  const now = useNow()
  const [searchInput, setSearchInput] = useState(filters.search)
  const debouncedSearch = useDebounced(searchInput)

  // Any filter change goes back to page 1.
  useEffect(() => {
    if (debouncedSearch !== filters.search) onFiltersChange({ ...filters, search: debouncedSearch, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const { data, isLoading, isError, refetch, isFetching } = useBulkEmails({
    page: filters.page,
    size: LIST_PAGE_SIZE,
    status: filters.status || null,
    search: filters.search,
    from: toIsoStart(filters.from),
    to: toIsoEnd(filters.to),
  })

  const rows = data?.items ?? []
  const total = data?.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE))
  const hasFilters = !!(filters.status || filters.search || filters.from || filters.to)
  // Hide the Suppressed counter when no visible row has any.
  const showSuppressed = rows.some(r => r.suppressedCount > 0)

  function set(patch: Partial<ListFilters>) { onFiltersChange({ ...filters, ...patch, page: 1 }) }

  return (
    <section className="cm-main">
      <div className="cm-toolbar">
        <label className="cm-search">
          <i className="lni lni-search-alt"></i>
          <input placeholder="Search by subject" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          {searchInput && <button className="cm-icon-btn cm-icon-btn-sm" title="Clear search" onClick={() => setSearchInput('')}><i className="lni lni-close"></i></button>}
        </label>
        <div className="cm-tool-filter" style={{ width: 170 }}>
          <SearchSelect options={STATUS_OPTIONS} value={filters.status} onChange={v => set({ status: v as BulkEmailJobStatus | '' })} />
        </div>
        <div className="cm-date-range">
          <input type="date" className="ctrl" title="Created from" value={filters.from} max={filters.to || undefined} onChange={e => set({ from: e.target.value })} />
          <span>–</span>
          <input type="date" className="ctrl" title="Created to" value={filters.to} min={filters.from || undefined} onChange={e => set({ to: e.target.value })} />
        </div>
        {isError && data && <ReconnectingHint />}
        <div className="cm-pager">
          <span>{total ? `${(filters.page - 1) * LIST_PAGE_SIZE + 1}–${Math.min(filters.page * LIST_PAGE_SIZE, total)} of ${total.toLocaleString()}` : '0 of 0'}</span>
          <button className="cm-icon-btn" title="Newer" disabled={filters.page <= 1} onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}><i className="lni lni-chevron-left"></i></button>
          <button className="cm-icon-btn" title="Older" disabled={filters.page >= pageCount} onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}><i className="lni lni-chevron-right"></i></button>
        </div>
      </div>

      {hasFilters && (
        <div className="cm-chips">
          {filters.status && <span className="cm-chip">Status: {JOB_STATUS_DISPLAY[filters.status].label}<button title="Remove filter" onClick={() => set({ status: '' })}><i className="lni lni-close"></i></button></span>}
          {filters.search && <span className="cm-chip">Subject: {filters.search}<button title="Remove filter" onClick={() => setSearchInput('')}><i className="lni lni-close"></i></button></span>}
          {(filters.from || filters.to) && <span className="cm-chip">Created: {filters.from || '…'} – {filters.to || '…'}<button title="Remove filter" onClick={() => set({ from: '', to: '' })}><i className="lni lni-close"></i></button></span>}
        </div>
      )}

      <div className="cm-list">
        {isLoading ? (
          <div className="empty" style={{ padding: 48 }}>
            <div className="empty-icon"><i className="lni lni-spinner-arrow cm-spin"></i></div>
            <div className="empty-title">Loading bulk emails…</div>
          </div>
        ) : isError && !data ? (
          // Never show stale data as current after a failed load.
          <div className="empty" style={{ padding: 48 }}>
            <div className="empty-icon"><i className="lni lni-warning"></i></div>
            <div className="empty-title">Could not load bulk emails</div>
            <div className="empty-sub">Check your connection and try again.</div>
            <button className="btn btn-neu btn-sm" style={{ marginTop: 12 }} onClick={() => refetch()} disabled={isFetching}><i className="lni lni-reload"></i> Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty" style={{ padding: 48 }}>
            <div className="empty-icon"><i className="lni lni-inbox"></i></div>
            <div className="empty-title">{hasFilters ? 'No bulk emails match these filters' : 'No bulk emails have been sent yet.'}</div>
            {!hasFilters && canCompose && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={onCompose}><i className="lni lni-pencil"></i> Compose</button>}
          </div>
        ) : rows.map(job => {
          const { done, total: recipients } = jobProgress(job)
          const resolving = job.status === 'Draft' || job.status === 'Resolving'
          return (
            <div key={job.jobGuid} className="cm-row cm-job-row" onClick={() => onOpen(job.jobGuid)}>
              <div><JobStatusBadge status={job.status} /></div>
              <div className="cm-row-text">
                <span className="cm-row-subj">{job.subject || '(no subject)'}</span>
                {job.hasAttachment && <i className="lni lni-paperclip cm-clip" title="Has an attachment"></i>}
              </div>
              <div className="cm-job-progress">
                <ProgressBar job={job} />
                <span>{resolving ? '—' : `${done.toLocaleString()} / ${recipients.toLocaleString()}`}</span>
              </div>
              <div className="cm-job-counts">
                <span className="cm-count-sent" title="Sent"><i className="lni lni-checkmark-circle"></i> {job.sentCount.toLocaleString()}</span>
                <span className={job.failedCount > 0 ? 'cm-count-failed' : 'cm-count-zero'} title="Failed"><i className="lni lni-cross-circle"></i> {job.failedCount.toLocaleString()}</span>
                {showSuppressed && <span className="cm-count-zero" title="Suppressed"><i className="lni lni-circle-minus"></i> {job.suppressedCount.toLocaleString()}</span>}
              </div>
              <div className="cm-row-when" title={isJobActive(job.status) ? 'Still sending' : undefined}>{formatWhen(job.createdDate, now)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
