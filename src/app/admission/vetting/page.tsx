'use client'
import { useEffect, useState } from 'react'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { Pagination } from '@/components/Pagination'
import { RejectModal } from '@/components/modals/admission/RejectModal'
import { VettingReviewModal } from '@/components/modals/admission/VettingReviewModal'
import { useVettingQueue, useVetApplication } from '@/hooks/admission/useVetting'
import { VettingQueueItem } from '@/lib/api/admission/vetting'
import { usePagination } from '@/hooks/usePagination'

// Fetches up to FETCH_SIZE rows in one request (still server-filtered by
// studentName when searching — see the comment on useVettingQueue below),
// then paginates that already-fetched set 10-at-a-time client-side via
// usePagination. A real ceiling, not "fetch the whole queue" — if a search
// genuinely matches more than FETCH_SIZE rows, only the first batch is
// available to page through.
const FETCH_SIZE = 1000
const DISPLAY_PAGE_SIZE = 10

const PIPELINE_STEPS = [
  { num: 1, label: 'Enquiry' }, { num: 2, label: 'Filing' }, { num: 3, label: 'Vetting' },
  { num: 4, label: 'Approval' }, { num: 5, label: 'Registration' },
]

// action is a byte? assembled from three different enums depending on who
// wrote it (see VettingApiDocs.md "Status values") — the queue endpoint
// currently only ever returns action==1 rows, but this covers the full
// range in case that ever changes.
function actionLabel(action: number | null): string {
  switch (action) {
    case 0: return 'Waiting'
    case 1: return 'Pending'
    case 2: return 'Approved'
    case 3: return 'Rejected'
    case 4: return 'Registered'
    default: return '—'
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const mins = Math.floor((Date.now() - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function VettingPage() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [filterProg, setFilterProg] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedApplicationGuid, setSelectedApplicationGuid] = useState<string | null>(null)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }

  // studentName is a real server-side partial-match filter (see
  // VettingApiDocs.md) — search narrows the actual queue server-side, not
  // just the currently-loaded page; always fetches page 1 at FETCH_SIZE,
  // since search changes what "the queue" even is.
  const { data, isLoading } = useVettingQueue(1, FETCH_SIZE, { studentName: search.trim() || undefined })
  const vetApplicationMutation = useVetApplication()

  useEffect(() => {
    console.log('[vetting page] render', { search, isLoading, itemCount: data?.items?.length ?? 0 })
  }, [search, isLoading, data?.items?.length])

  const items = data?.items ?? []
  const summary = data?.summary

  // The API has no programme filter param — built dynamically from whatever
  // programme names are present on the currently-fetched batch, same
  // pattern as programme-master's level/group filter options.
  const progOptions = [
    { value: 'all', label: 'All Programmes' },
    ...Array.from(new Set(items.map(i => i.programName))).map(name => ({ value: name, label: name })),
  ]
  const filteredItems = filterProg === 'all' ? items : items.filter(r => r.programName === filterProg)
  // Client-side pagination over the already-fetched (and already
  // search-filtered server-side) batch — 10 rows per page for display.
  const { page, setPage, totalPages, totalCount, pageItems: visibleRows } = usePagination(filteredItems, DISPLAY_PAGE_SIZE)

  function updateSearch(value: string) { setSearch(value); setPage(1) }

  const searchMatches = search.trim() ? items.slice(0, 8) : []

  function handleReview(row: VettingQueueItem) {
    setSelectedApplicationGuid(row.applicationGuid)
    openModal('vetting-review-modal')
  }

  function handleReject() {
    closeModal('vetting-review-modal')
    openModal('reject-modal')
  }

  return (
    <div id="page-vetting">
      <div className="pg-hdr">
        <div>
          <h1 className="text-[1.35rem] font-semibold text-g800">Stage 3 &middot; Application Vetting Desk</h1>
          <p className="text-sm text-g500 mt-1">Assistant Registrar reviews documents &amp; minimum standards</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TableSearch
            className="w-56"
            placeholder="Search Application Ref No. / Student…"
            value={search}
            onChange={updateSearch}
            results={searchMatches.map(row => ({ id: row.applicationGuid, primary: row.appRefNo, secondary: row.studentName }))}
          />
          <SearchSelect options={progOptions} value={filterProg} onChange={v => { setFilterProg(v); setPage(1) }} />
        </div>
      </div>

      <div className="pipeline">
        {PIPELINE_STEPS.map((s, i) => {
          const cls = s.num < 3 ? 'done' : s.num === 3 ? 'active' : ''
          return (
            <span key={s.num} className="contents">
              {i > 0 && <span className={`pip-line ${s.num <= 3 ? 'done' : ''}`} />}
              <div className={`pip-step ${cls}`}><span className="pip-circle">{s.num}</span><span className="text-sm font-medium">{s.label}</span></div>
            </span>
          )
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="text-base font-semibold text-g800">Vetting Queue ({summary?.pendingCount ?? 0} Pending)</h2>
          <span className="badge badge-amber">Oldest: {timeAgo(summary?.oldestSubmittedDate ?? null)}</span>
        </div>
        <ScrollTable>
          <table>
            <thead><tr><th style={{ width: 48 }}></th><th>App. Ref</th><th>Applicant Name</th><th>Programme</th><th>Type</th><th>Documents</th><th>Submitted</th><th>Status</th></tr></thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={8} />
                : visibleRows.length === 0
                  ? <EmptyState colSpan={8} hasFilters={!!search.trim() || filterProg !== 'all'} onClearFilters={() => { setSearch(''); setFilterProg('all') }} />
                  : null}
              {visibleRows.map(row => (
                <tr key={row.applicationGuid}>
                  <td><ActionMenu><button className="btn btn-neu btn-sm" onClick={() => handleReview(row)}><i className="lni lni-eye" /> Review</button></ActionMenu></td>
                  <td className="font-mono text-sm">{row.appRefNo}</td>
                  <td>{row.studentName}</td>
                  <td>{row.programName}</td>
                  <td><span className={`badge badge-${row.type === 'ODL' ? 'cyan' : 'blue'}`}>{row.type}</span></td>
                  <td>{row.documentsUploaded}/{row.documentsTotal}</td>
                  <td className="text-sm text-g500">{timeAgo(row.submittedDate)}</td>
                  <td><span className="badge badge-amber">{actionLabel(row.action)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} itemLabel="applicants" onPageChange={setPage} />
      </div>

      <VettingReviewModal
        isOpen={openModals.has('vetting-review-modal')}
        onClose={() => closeModal('vetting-review-modal')}
        showToast={showToast}
        applicationGuid={selectedApplicationGuid}
        vetApplication={vetApplicationMutation}
        onReject={handleReject}
      />
      <RejectModal
        isOpen={openModals.has('reject-modal')}
        onClose={() => closeModal('reject-modal')}
        showToast={showToast}
        applicationGuid={selectedApplicationGuid}
        vetApplication={vetApplicationMutation}
      />
      <Toast toast={toast} />
    </div>
  )
}
