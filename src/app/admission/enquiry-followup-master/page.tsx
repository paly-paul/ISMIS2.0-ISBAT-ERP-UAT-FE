'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EnquiryAssignModal } from '@/components/modals/admission/EnquiryAssignModal'
import { NewFollowUpLogModal } from '@/components/modals/admission/NewFollowUpLogModal'
import { useEnquiryFollowUps, useEnquiryFollowUpsCount, useCreateEnquiryFollowUp } from '@/hooks/admission/useEnquiryFollowUps'
import { useUpdateEnquiry } from '@/hooks/admission/useEnquiries'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

function nameBadge(name: string | null, cls: string) {
  if (!name) return <span className="badge badge-grey">—</span>
  return <span className={`badge ${cls}`}>{name}</span>
}

export default function EnquiryFollowupMasterPage() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }

  // Debounced so the backend's ?search= isn't hit on every keystroke, and
  // held at '' (falling back to the unfiltered/paginated list) until
  // MIN_SEARCH_CHARS is met — same convention as Skill/Batch/Employee
  // Master's search boxes.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length < MIN_SEARCH_CHARS) { setDebouncedSearch(''); return }
    const t = setTimeout(() => setDebouncedSearch(trimmed), 400)
    return () => clearTimeout(t)
  }, [search])

  // Real server-side pagination AND search — fetches PAGE_SIZE (10) rows at
  // a time instead of the whole table up front, and debouncedSearch is a
  // real server-side filter (confirmed live, see the note on
  // getEnquiryFollowUps), not a client-side one. Was previously a single
  // pageSize=1000 fetch of the whole table backing a client-side
  // usePagination() slice + text filter — same class of "silently misses
  // rows past the cap once the table outgrows it" issue useCourseUnits hit
  // at 1000-of-1500 rows (826 rows in the sample here, already close).
  const { data, isLoading, isFetching } = useEnquiryFollowUps(page, PAGE_SIZE, debouncedSearch)
  const rows = data?.items ?? []
  const totalCount = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const searchTrimmed = search.trim()
  const searchPending = searchTrimmed.length >= MIN_SEARCH_CHARS && (debouncedSearch !== searchTrimmed || isFetching)

  // Reset back to page 1 whenever the (debounced) search term changes — the
  // previous page offset almost never lands on a valid page of the newly-
  // filtered result set.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // Decoupled from the table's own (now paginated) rows and the search box
  // above — pageSize=1 so it doesn't pull real row data, just totalCount for
  // the stat tile.
  const { data: countData } = useEnquiryFollowUpsCount()

  const updateEnquiry = useUpdateEnquiry()
  const createFollowUp = useCreateEnquiryFollowUp()

  // programName comes back null on every row from the real API — resolve it
  // client-side, same fallback pattern as enquiry-list/page.tsx.
  const { data: programs = [] } = useProgramMasters()
  function resolveProgramName(row: { programGuid: string | null; programName: string | null }) {
    if (row.programName) return row.programName
    if (!row.programGuid) return '—'
    return programs.find(p => p.programGuid === row.programGuid)?.programName ?? '—'
  }

  const pageItems = rows

  // Live preview shown in the search dropdown as the user types — reads the
  // same server-scoped rows, capped to a handful. Empty below
  // MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on when the
  // dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? rows.slice(0, 8) : []

  // "Add Follow-up" needs a full enquiry picker to search across — the main
  // table above is now paginated 10-at-a-time and can't supply that. Fetched
  // separately (capped at 1000, only while the modal is actually open) since
  // SearchSelect (the picker's underlying component) only takes a static
  // option list, not a live server-search callback — same "capped, no async
  // picker" trade-off useAllCourseUnits documents for CourseUnitModal. The
  // real ?search= endpoint (see getEnquiryFollowUps) isn't wired into this
  // picker for that reason, even though it's confirmed to exist now.
  const followUpModalOpen = openModals.has('new-followup-log-modal')
  const { data: pickerData } = useEnquiryFollowUps(1, 1000, '', followUpModalOpen)
  const pickerEnquiries = pickerData?.items ?? []

  function openViewModal(guid: string) {
    setViewingGuid(guid)
    openModal('enquiry-assign-modal')
    setSearch('')
  }

  return (
    <div id="page-enquiry-followup-master">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Enquiry Followup Master</h1>
          <p className="text-sm text-g500 mt-0.5">Follow-up status &amp; next contact date across all enquiries</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => router.push('/admission/enquiry-list')}><i className="lni lni-arrow-left" /> Back</button>
          {permissions.add && <button className="btn btn-primary" onClick={() => openModal('new-followup-log-modal')}><i className="lni lni-plus" /> Add Follow-up</button>}
        </div>
      </div>

      {/* Only Total Enquiries is wired to real data (totalCount) — the old
          Unallocated/Due Today/High Priority tiles depended on assignedTo
          and priority fields that don't exist on the real
          EnquiryFollowUpListDto, so they're dropped rather than faked. */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-users text-b500" /><span className="text-sm text-g500">Total Follow-ups</span></div>
          <p className="text-2xl font-semibold text-g900">{(countData?.totalCount ?? 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-g800">Follow-up Register</h2>
          <TableSearch
            className="w-56"
            placeholder="Search by name, ref, status…"
            value={search}
            onChange={setSearch}
            results={searchMatches.map(r => ({ id: r.enquiryGuid, primary: r.enquiryCode, secondary: r.studentName }))}
            loading={searchPending}
            minChars={MIN_SEARCH_CHARS}
            onSelect={permissions.edit ? (r) => openViewModal(r.id) : undefined}
          />
        </div>
        <ScrollTable>
          <table>
            <thead><tr><th style={{ width: 48 }}></th><th>Enq. Ref</th><th>Student Name</th><th>Programme Interest</th><th>Enquiry Status</th><th>Follow-up Status</th><th>Source</th><th>Next Follow-up</th></tr></thead>
            <tbody>
              {(isLoading || searchPending)
                ? <TableLoadingState colSpan={999} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                  : null}
              {!(isLoading || searchPending) && pageItems.map(r => (
                <tr key={r.enquiryGuid}>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => router.push(`/admission/payment?enquiryGuid=${r.enquiryGuid}`)}><i className="lni lni-arrow-right" /> Convert</button>
                      {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.enquiryGuid)}><i className="lni lni-eye" /> View</button>}
                    </ActionMenu>
                  </td>
                  <td className="font-mono text-sm">{r.enquiryCode}</td>
                  <td>{r.studentName}</td>
                  <td>{resolveProgramName(r)}</td>
                  <td>{nameBadge(r.enquiryStatusName, 'badge-amber')}</td>
                  <td>{nameBadge(r.followUpStatusName, 'badge-blue')}</td>
                  <td>{nameBadge(r.enquirySourceName, 'badge-grey')}</td>
                  <td className="text-sm text-g600">{r.nextFollowDate ? r.nextFollowDate.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>

        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-3" style={{ fontSize: 12.5, color: 'var(--g500)' }}>
            <span>Page {page} of {totalPages} · {totalCount.toLocaleString()} follow-ups</span>
            <div className="flex gap-2">
              <button className="btn btn-neu btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <i className="lni lni-chevron-left" /> Previous
              </button>
              <button className="btn btn-neu btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                Next <i className="lni lni-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      <EnquiryAssignModal
        isOpen={openModals.has('enquiry-assign-modal')}
        onClose={() => closeModal('enquiry-assign-modal')}
        showToast={showToast}
        enquiryGuid={viewingGuid}
        updateEnquiry={updateEnquiry}
      />
      {/* intEnquiry/followUpStatus/followUpMode/enquiryStatus/interestLevel
          are sent as list position, not a confirmed backend id — see the
          note on EnquiryFollowUpInput in lib/api/admission/enquiryFollowUp.ts. */}
      <NewFollowUpLogModal
        isOpen={openModals.has('new-followup-log-modal')}
        onClose={() => closeModal('new-followup-log-modal')}
        showToast={showToast}
        enquiries={pickerEnquiries}
        createFollowUp={createFollowUp}
      />
      <Toast toast={toast} />
    </div>
  )
}
