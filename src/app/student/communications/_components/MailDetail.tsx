'use client'
import { useEffect, useRef, useState } from 'react'
import { Pagination } from '@/components/Pagination'
import { ScrollTable } from '@/components/ScrollTable'
import { TableLoadingState } from '@/components/TableLoadingState'
import {
  BulkEmailRecipientStatus,
  RECIPIENT_STATUSES,
  isJobActive,
  useBulkEmail,
  useBulkEmailRecipients,
  useRefreshBulkEmailRecipients,
} from '@/hooks/student/useBulkEmail'
import { JobStatusBadge, ProgressBar, RECIPIENT_STATUS_BADGE, ReconnectingHint, formatStamp, jobProgress, useDebounced } from './shared'

const RECIPIENT_PAGE_SIZE = 50
const MAX_ATTEMPTS = 5

// The body is user-authored HTML — rendered in a sandboxed iframe (no
// scripts, separate origin) rather than injected into the ERP page.
function bodyDocument(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:18px 20px;font:14px/1.7 Inter,-apple-system,sans-serif;color:#334155}a{color:#4869c5}img{max-width:100%}</style></head><body>${html}</body></html>`
}

export function MailDetail({ jobGuid, onBack }: { jobGuid: string; onBack: () => void }) {
  const { data: job, isLoading, isError, error, refetch, isFetching } = useBulkEmail(jobGuid)
  const active = isJobActive(job?.status)

  const [recipientStatus, setRecipientStatus] = useState<BulkEmailRecipientStatus | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput)
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [recipientStatus, search])

  const recipients = useBulkEmailRecipients(jobGuid, { page, size: RECIPIENT_PAGE_SIZE, status: recipientStatus || null, search }, active)
  const refreshRecipients = useRefreshBulkEmailRecipients()

  // When the job finishes, fetch the recipients one last time so the table
  // matches the final counters.
  const wasActive = useRef(false)
  useEffect(() => {
    if (!job) return
    if (wasActive.current && !active) refreshRecipients(jobGuid)
    wasActive.current = active
  }, [job, active, jobGuid, refreshRecipients])

  const notFound = (error as { code?: string } | null)?.code === 'not_found' || (recipients.error as { code?: string } | null)?.code === 'not_found'

  const toolbar = (
    <div className="cm-toolbar">
      <button className="cm-icon-btn" title="Back to list" onClick={onBack}><i className="lni lni-arrow-left"></i></button>
      {job && isError && <ReconnectingHint />}
    </div>
  )

  if (notFound) {
    return (
      <section className="cm-main">
        {toolbar}
        <div className="empty" style={{ padding: 48 }}>
          <div className="empty-icon"><i className="lni lni-search-alt"></i></div>
          <div className="empty-title">This bulk email was not found.</div>
          <button className="btn btn-neu btn-sm" style={{ marginTop: 12 }} onClick={onBack}><i className="lni lni-arrow-left"></i> Back to list</button>
        </div>
      </section>
    )
  }

  if (isLoading || (!job && !isError)) {
    return (
      <section className="cm-main">
        {toolbar}
        <div className="empty" style={{ padding: 48 }}>
          <div className="empty-icon"><i className="lni lni-spinner-arrow cm-spin"></i></div>
          <div className="empty-title">Loading bulk email…</div>
        </div>
      </section>
    )
  }

  if (!job) {
    return (
      <section className="cm-main">
        {toolbar}
        <div className="empty" style={{ padding: 48 }}>
          <div className="empty-icon"><i className="lni lni-warning"></i></div>
          <div className="empty-title">Could not load this bulk email</div>
          <button className="btn btn-neu btn-sm" style={{ marginTop: 12 }} onClick={() => refetch()} disabled={isFetching}><i className="lni lni-reload"></i> Retry</button>
        </div>
      </section>
    )
  }

  const { percent } = jobProgress(job)
  const resolving = job.status === 'Draft' || job.status === 'Resolving'
  const recipientRows = recipients.data?.items ?? []
  const recipientTotal = recipients.data?.totalCount ?? 0

  return (
    <section className="cm-main">
      {toolbar}
      <div className="cm-read">
        <div className="cm-read-subj">
          {job.subject}
          <JobStatusBadge status={job.status} />
        </div>

        <div className="cm-stamps">
          <span><strong>Created</strong> {formatStamp(job.createdDate)}</span>
          <span><strong>Started</strong> {formatStamp(job.startedDate)}</span>
          <span><strong>Completed</strong> {active ? '—' : formatStamp(job.completedDate)}</span>
        </div>

        {job.lastError && (
          <div className="danger-box" style={{ marginTop: 16 }}>
            <i className="lni lni-warning" style={{ color: 'var(--red)', fontSize: 15, flexShrink: 0 }}></i>
            <div style={{ fontSize: 12.5 }}><strong>Could not prepare the recipient list.</strong> {job.lastError}</div>
          </div>
        )}
        {job.status === 'Completed' && job.totalRecipients === 0 && (
          <div className="warn-box" style={{ marginTop: 16 }}>
            <i className="lni lni-warning" style={{ color: 'var(--amber)', fontSize: 15, flexShrink: 0 }}></i>
            <div style={{ fontSize: 12.5 }}>None of the selected students had an email address on file, so nothing was sent.</div>
          </div>
        )}

        <div className="cm-progress-card">
          <div className="cm-progress-head">
            <span>{resolving ? 'Preparing the recipient list…' : `${percent}% processed`}</span>
            {active && <span className="cm-live"><span className="cm-live-dot"></span> Live</span>}
          </div>
          <ProgressBar job={job} large />
          <div className="cm-stats">
            <div className="cm-stat"><strong>{resolving ? '—' : job.totalRecipients.toLocaleString()}</strong>Recipients</div>
            <div className="cm-stat"><strong style={{ color: 'var(--green)' }}>{job.sentCount.toLocaleString()}</strong>Sent</div>
            <div className="cm-stat"><strong style={{ color: job.failedCount ? 'var(--red)' : undefined }}>{job.failedCount.toLocaleString()}</strong>Failed</div>
            <div className="cm-stat"><strong style={{ color: 'var(--g500)' }}>{job.suppressedCount.toLocaleString()}</strong>Suppressed</div>
            <div className="cm-stat"><strong>{resolving ? '—' : job.pendingCount.toLocaleString()}</strong>Pending</div>
          </div>
        </div>

        {job.attachmentFileName && (
          <div className="cm-attach-row">
            <span className="cm-file-chip"><i className="lni lni-paperclip"></i> {job.attachmentFileName}</span>
            <span className="cm-hint">Attachments are stored but not yet included in the email.</span>
          </div>
        )}

        <div className="cm-section-title">Message</div>
        <iframe className="cm-body-frame" title="Email body preview" sandbox="" srcDoc={bodyDocument(job.bodyHtml)} />

        <div className="cm-section-title">Recipients</div>
        <div className="cm-recipient-bar">
          <div className="cm-status-tabs">
            {(['', ...RECIPIENT_STATUSES] as const).map(s => (
              <button key={s || 'all'} className={`cm-status-tab${recipientStatus === s ? ' active' : ''}`} onClick={() => setRecipientStatus(s)}>{s || 'All'}</button>
            ))}
          </div>
          <label className="cm-search" style={{ maxWidth: 280 }}>
            <i className="lni lni-search-alt"></i>
            <input placeholder="Search email address" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </label>
        </div>

        <ScrollTable>
          <table>
            <thead><tr><th>Email</th><th>Status</th><th>Attempts</th><th>Error</th><th>Processed</th></tr></thead>
            <tbody>
              {recipients.isLoading ? (
                <TableLoadingState colSpan={5} title="Loading recipients…" />
              ) : recipients.isError && !recipients.data ? (
                <tr><td colSpan={5} className="tbl-empty-cell"><div className="tbl-empty-inner">
                  <div className="tbl-empty-title">Could not load recipients</div>
                  <button className="btn btn-neu btn-sm" style={{ marginTop: 8 }} onClick={() => recipients.refetch()}><i className="lni lni-reload"></i> Retry</button>
                </div></td></tr>
              ) : recipientRows.length === 0 ? (
                <tr><td colSpan={5} className="tbl-empty-cell"><div className="tbl-empty-inner">
                  <div className="tbl-empty-title">{resolving ? 'Recipients appear once the list is prepared' : 'No recipients match'}</div>
                </div></td></tr>
              ) : recipientRows.map(r => (
                <tr key={r.recipientGuid}>
                  <td>{r.toEmail}</td>
                  <td><span className={`badge ${RECIPIENT_STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                  {/* A Queued row with attempts > 0 is waiting for a retry. */}
                  <td>{r.status === 'Queued' && r.attempts > 0 ? `${r.attempts} / ${MAX_ATTEMPTS}` : r.attempts}</td>
                  <td className="cm-err-cell" title={r.lastError ?? undefined}>
                    {r.lastError ? (r.status === 'Queued' ? <span className="text-g400">Retrying: {r.lastError}</span> : r.lastError) : '—'}
                  </td>
                  <td>{r.status === 'Queued' || r.status === 'Sending' ? '—' : formatStamp(r.processedDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(recipientTotal / RECIPIENT_PAGE_SIZE))} totalCount={recipientTotal} itemLabel="recipients" onPageChange={setPage} />
      </div>
    </section>
  )
}
