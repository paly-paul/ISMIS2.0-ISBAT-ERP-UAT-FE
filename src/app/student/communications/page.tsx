'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'
// import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { BulkEmailJobStatus, JOB_STATUSES } from '@/hooks/student/useBulkEmail'
import { EMPTY_LIST_FILTERS, ListFilters, MailList } from './_components/MailList'
import { MailDetail } from './_components/MailDetail'
import { Compose } from './_components/Compose'

// Student bulk email — per student-bulk-email-page.md. Three views on one
// route, chosen by the query string so browser Back works and the list keeps
// its filters/page when returning from a job:
//   (none)              mail list
//   ?job={jobGuid}      mail detail
//   ?view=compose       compose
// The list filters (status, q, from, to, page) ride along in the query too.

function readListFilters(params: URLSearchParams): ListFilters {
  const status = params.get('status') ?? ''
  return {
    status: (JOB_STATUSES as readonly string[]).includes(status) ? status as BulkEmailJobStatus : '',
    search: params.get('q') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    page: Math.max(1, Number(params.get('page')) || 1),
  }
}

function listQuery(f: ListFilters): URLSearchParams {
  const q = new URLSearchParams()
  if (f.status) q.set('status', f.status)
  if (f.search) q.set('q', f.search)
  if (f.from) q.set('from', f.from)
  if (f.to) q.set('to', f.to)
  if (f.page > 1) q.set('page', String(f.page))
  return q
}

function CommunicationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Permission checks disabled for now — every action is allowed. Restore the
  // line below (and the import above) to gate actions by the menu permissions again.
  // const permissions = usePagePermissions()
  const permissions = { add: true, edit: true, delete: true }
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }

  const jobGuid = searchParams.get('job')
  const composing = searchParams.get('view') === 'compose'
  const listFilters = readListFilters(searchParams)
  const canCompose = !!permissions.add

  function go(q: URLSearchParams, replace = false) {
    const url = q.toString() ? `/student/communications?${q.toString()}` : '/student/communications'
    if (replace) router.replace(url, { scroll: false })
    else router.push(url, { scroll: false })
  }

  function openJob(guid: string) { const q = listQuery(listFilters); q.set('job', guid); go(q) }
  function openCompose() { const q = listQuery(listFilters); q.set('view', 'compose'); go(q) }
  function backToList() { go(listQuery(listFilters)) }

  function handleSent(selectedRecipients: number) {
    showToast(`Email queued for ${selectedRecipients.toLocaleString()} students. Sending in the background.`, 'ok')
    // Back to the first page of the list, where the new job appears on top.
    go(listQuery({ ...listFilters, page: 1 }))
  }

  return (
    <>
      <div className="page active">
        <div className="pg-hdr">
          <div><div className="pg-title">Communications</div><div className="pg-sub">Email a filtered group of students and track delivery</div></div>
          {!composing && !jobGuid && canCompose && (
            <button className="cm-compose-btn cm-compose-btn-hdr" onClick={openCompose}><i className="lni lni-pencil"></i> Compose</button>
          )}
        </div>

        {composing && canCompose ? (
          <Compose onCancel={backToList} onSent={handleSent} showToast={showToast} />
        ) : jobGuid ? (
          <MailDetail jobGuid={jobGuid} onBack={backToList} />
        ) : (
          <MailList
            filters={listFilters}
            onFiltersChange={f => go(listQuery(f), true)}
            onOpen={openJob}
            onCompose={openCompose}
            canCompose={canCompose}
          />
        )}
      </div>
      <Toast toast={toast} />
    </>
  )
}

export default function Page() {
  return (
    <Suspense>
      <CommunicationsContent />
    </Suspense>
  )
}
