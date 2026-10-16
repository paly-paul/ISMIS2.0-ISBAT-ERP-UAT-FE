'use client'
import { useEffect, useState } from 'react'
import { BulkEmailJobDto, BulkEmailJobStatus, BulkEmailRecipientStatus, isJobActive } from '@/hooks/student/useBulkEmail'

// Friendly labels for the job statuses. The raw enum names stay the
// ?status= filter values.
export const JOB_STATUS_DISPLAY: Record<BulkEmailJobStatus, { label: string; badge: string; busy?: boolean }> = {
  Draft: { label: 'Queued', badge: 'badge-grey' },
  Resolving: { label: 'Preparing', badge: 'badge-blue', busy: true },
  Processing: { label: 'Sending', badge: 'badge-blue', busy: true },
  Completed: { label: 'Completed', badge: 'badge-green' },
  PartiallyFailed: { label: 'Partially failed', badge: 'badge-amber' },
  Failed: { label: 'Failed', badge: 'badge-red' },
}

export const RECIPIENT_STATUS_BADGE: Record<BulkEmailRecipientStatus, string> = {
  Queued: 'badge-grey',
  Sending: 'badge-blue',
  Sent: 'badge-green',
  Failed: 'badge-red',
  Suppressed: 'badge-amber',
}

export function JobStatusBadge({ status }: { status: BulkEmailJobStatus }) {
  const d = JOB_STATUS_DISPLAY[status]
  return (
    <span className={`badge ${d.badge} cm-status`}>
      {d.busy && <i className="lni lni-spinner-arrow cm-spin"></i>}
      {d.label}
    </span>
  )
}

export function jobProgress(job: Pick<BulkEmailJobDto, 'sentCount' | 'failedCount' | 'suppressedCount' | 'totalRecipients'>) {
  const done = job.sentCount + job.failedCount + job.suppressedCount
  const total = job.totalRecipients
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 }
}

// Segmented bar: sent green, failed red, suppressed grey. While the job is
// still Draft/Resolving the total is 0, so it shows an indeterminate bar
// instead of 0%.
export function ProgressBar({ job, large = false }: { job: BulkEmailJobDto; large?: boolean }) {
  const { total } = jobProgress(job)
  const indeterminate = total === 0 && isJobActive(job.status)
  const pct = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%')
  return (
    <div className={`cm-bar${large ? ' cm-bar-lg' : ''}${indeterminate ? ' cm-bar-indet' : ''}`}>
      {!indeterminate && (
        <>
          <span className="cm-bar-seg cm-bar-sent" style={{ width: pct(job.sentCount) }}></span>
          <span className="cm-bar-seg cm-bar-failed" style={{ width: pct(job.failedCount) }}></span>
          <span className="cm-bar-seg cm-bar-supp" style={{ width: pct(job.suppressedCount) }}></span>
        </>
      )}
    </div>
  )
}

// The API returns UTC timestamps; a value without an explicit offset is
// treated as UTC so it converts to local time correctly.
export function parseUtc(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "28 Sep 2026, 11:16"
export function formatStamp(iso: string | null | undefined): string {
  const d = parseUtc(iso)
  if (!d) return '—'
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Gmail-style list date: time for today, "Sep 12" for this year,
// "12/09/24" otherwise. `now` is null until mount so server and client
// render the same text.
export function formatWhen(iso: string | null | undefined, now: Date | null): string {
  const d = parseUtc(iso)
  if (!d) return '—'
  if (now && d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (!now || d.getFullYear() === now.getFullYear()) return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
}

export function useNow() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])
  return now
}

// Search boxes wait ~400 ms after the last keystroke before querying.
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// Shown while a poll has failed but earlier data is still on screen.
export function ReconnectingHint() {
  return <span className="cm-reconnecting"><i className="lni lni-spinner-arrow cm-spin"></i> Reconnecting…</span>
}
