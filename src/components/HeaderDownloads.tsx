'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Toast } from '@/components/Toast'
import { AuthError } from '@/lib/api/client'
import { onHubReconnected, onReportStatus, ReportStatusEvent } from '@/lib/notificationsHub'
import { getReportJobs, parseUtcNoZ, ReportJob, REPORT_STATUS } from '@/lib/api/finance/discountReport'
import {
  REPORT_JOBS_KEY, downloadReportJob, getUnseen, isTrackedInline, markUnseen, setLiveLink, subscribeUnseen, updateReportJob,
} from '@/lib/reportDownloads'

// The header's Downloads icon, just before the bell: the signed-in user's
// own report exports (finance-service/reports/get-report-jobs.md).
// - Spinner + count while any export is Queued/Processing.
// - Green dot when a finished file hasn't been downloaded yet.
// - Live updates from `reportStatus` on the app's one SignalR connection;
//   the list is reloaded on page load and on reconnect, since events aren't
//   stored server-side.
// This is the ONLY subscriber to reportStatus, so "ready" toasts fire once.

function fmtCount(n: number) { return n.toLocaleString('en-US') }
function fmtBytes(n: number | null) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function HeaderDownloads() {
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const jobsQuery = useQuery({
    queryKey: REPORT_JOBS_KEY,
    queryFn: () => getReportJobs(1, 15),
    retry: false
  })
  const jobs = jobsQuery.data?.items ?? []
  const unseen = useSyncExternalStore(subscribeUnseen, getUnseen, getUnseen)
  const [open, setOpen] = useState(false)
  const [busyGuid, setBusyGuid] = useState<string | null>(null)

  const refetch = jobsQuery.refetch
  useEffect(() => onHubReconnected(() => { refetch() }), [refetch])

  useEffect(() => onReportStatus((s: ReportStatusEvent) => {
    updateReportJob(queryClient, s.reportJobGuid, prev => ({
      reportJobGuid: s.reportJobGuid,
      reportType: prev?.reportType ?? '',
      reportName: s.reportName,
      status: { value: s.status, name: s.statusName },
      isExpired: false,
      fileName: s.fileName ?? prev?.fileName ?? null,
      fileSizeBytes: prev?.fileSizeBytes ?? null,
      rowCount: prev?.rowCount ?? null,
      errorMessage: s.errorMessage,
      requestedAt: prev?.requestedAt ?? s.occurredAtUtc.replace(/Z$/, ''),
      completedAt: s.status === REPORT_STATUS.Completed ? s.occurredAtUtc.replace(/Z$/, '') : prev?.completedAt ?? null,
      expiresAt: prev?.expiresAt ?? null,
    }))
    // No toast for a job a page is already showing inline (its own button).
    const inline = isTrackedInline(s.reportJobGuid)
    if (s.status === REPORT_STATUS.Completed) {
      if (s.downloadUrl && s.downloadUrlExpiresAtUtc) setLiveLink(s.reportJobGuid, s.downloadUrl, s.downloadUrlExpiresAtUtc)
      markUnseen(s.reportJobGuid)
      if (!inline) showToast(`${s.reportName} is ready. Open Downloads to save it.`, 'success')
    } else if (s.status === REPORT_STATUS.Failed && !inline) {
      showToast(s.errorMessage || `${s.reportName} could not be generated`, 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [queryClient])

  const running = jobs.filter(j => j.status.value === REPORT_STATUS.Queued || j.status.value === REPORT_STATUS.Processing).length

  // Close on outside click or Escape.
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function handleDownload(job: ReportJob) {
    setBusyGuid(job.reportJobGuid)
    try {
      const opened = await downloadReportJob(job.reportJobGuid)
      if (!opened) showToast('Mock mode: no real file to download', 'info')
    } catch (err) {
      if (err instanceof AuthError && err.code === 'report_expired') {
        showToast('This report has expired. Please export it again.', 'error')
        refetch()
      } else {
        showToast(err instanceof Error && err.message ? err.message : 'Couldn’t get the download link. Please try again.', 'error')
      }
    } finally {
      setBusyGuid(null)
    }
  }

  const label = running
    ? `Downloads, ${running} export${running > 1 ? 's' : ''} in progress`
    : unseen.size ? 'Downloads, new file ready' : 'Downloads'

  return (
    <div className="hdr-dl-wrap" ref={wrapRef}>
      <button
        type="button"
        className="hdr-bell"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title="Downloads"
        onClick={() => setOpen(o => !o)}
      >
        <i className={`lni ${running ? 'lni-spinner-arrow spin' : 'lni-download'}`} aria-hidden="true" />
        {running > 0 && <span className="hdr-dl-count">{running}</span>}
        {running === 0 && unseen.size > 0 && <span className="hdr-dl-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="rpt-dl-pop" role="dialog" aria-label="Downloads">
          <div className="rpt-dl-pop-hdr">
            <span>Downloads</span>
            <span className="text-g400" style={{ fontSize: 'var(--fs-xs)', fontWeight: 500 }}>Your exports · kept 30 days</span>
          </div>
          <div className="rpt-dl-list">
            {jobsQuery.isLoading && <div className="rpt-dl-item"><span className="rpt-dl-item-meta">Loading your exports…</span></div>}
            {jobsQuery.isError && jobs.length === 0 && (
              <div className="rpt-dl-item">
                <span className="rpt-dl-item-meta err" style={{ flex: 1 }}>Couldn’t load your exports.</span>
                <button className="btn btn-neu btn-sm" onClick={() => refetch()}>Retry</button>
              </div>
            )}
            {jobsQuery.isSuccess && jobs.length === 0 && (
              <div className="rpt-dl-item"><span className="rpt-dl-item-meta">No exports yet. Reports you export to Excel appear here.</span></div>
            )}
            {jobs.map(job => (
              <DownloadRow key={job.reportJobGuid} job={job} busy={busyGuid === job.reportJobGuid} isNew={unseen.has(job.reportJobGuid)} onDownload={() => handleDownload(job)} />
            ))}
          </div>
        </div>
      )}
      <Toast toast={toast} />
    </div>
  )
}

function DownloadRow({ job, busy, isNew, onDownload }: { job: ReportJob; busy: boolean; isNew: boolean; onDownload: () => void }) {
  const status = job.status.value
  const requested = parseUtcNoZ(job.requestedAt)
  const running = status === REPORT_STATUS.Queued || status === REPORT_STATUS.Processing

  let meta: React.ReactNode
  if (running) meta = status === REPORT_STATUS.Queued ? 'Queued…' : 'Processing…'
  else if (status === REPORT_STATUS.Failed) meta = job.errorMessage || 'The report could not be generated.'
  else if (job.isExpired) meta = 'Expired'
  else meta = [job.rowCount != null ? `${fmtCount(job.rowCount)} rows` : null, fmtBytes(job.fileSizeBytes) || null].filter(Boolean).join(' · ') || 'Ready'

  return (
    <div className="rpt-dl-item">
      <div className="rpt-dl-item-main">
        <div className="rpt-dl-item-name" title={job.reportName}>{job.reportName}</div>
        <div className={`rpt-dl-item-meta${status === REPORT_STATUS.Failed ? ' err' : ''}`} title={requested ? `Requested ${requested.toLocaleString()}` : undefined}>
          {meta}
        </div>
      </div>
      {running && <i className="lni lni-spinner-arrow spin text-b500" aria-label="In progress" />}
      {status === REPORT_STATUS.Completed && !job.isExpired && (
        <button type="button" className={`btn btn-sm ${isNew ? 'btn-primary' : 'btn-neu'}`} onClick={onDownload} disabled={busy}>
          <i className={`lni ${busy ? 'lni-spinner-arrow spin' : 'lni-download'}`} aria-hidden="true" /> Download
        </button>
      )}
      {status === REPORT_STATUS.Completed && job.isExpired && <span className="badge badge-grey">Expired</span>}
    </div>
  )
}
