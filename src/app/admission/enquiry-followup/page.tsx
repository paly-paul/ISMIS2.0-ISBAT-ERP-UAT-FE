'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EnquiryAssignModal } from '@/components/modals/admission/EnquiryAssignModal'
import { NewFollowUpLogModal, InitialFollowUpData } from '@/components/modals/admission/NewFollowUpLogModal'
import { useEnquiryFollowUpsByAdvisor, useCreateEnquiryFollowUp } from '@/hooks/admission/useEnquiryFollowUps'
import { useUpdateEnquiry } from '@/hooks/admission/useEnquiries'
import { usePagination } from '@/hooks/usePagination'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'

const PAGE_SIZE = 10
// Fetched once at a size large enough to cover the whole advisor-scoped
// list client-side, same pattern as enquiry-followup-master/page.tsx (this
// endpoint is the advisor-filtered slice of the same data, so it's smaller).
const FETCH_ALL_PAGE_SIZE = 1000
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

function nameBadge(name: string | null, cls: string) {
  if (!name) return <span className="badge badge-grey">—</span>
  return <span className={`badge ${cls}`}>{name}</span>
}

export default function EnquiryFollowupPage() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)
  const [selectedFollowUp, setSelectedFollowUp] = useState<InitialFollowUpData | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useEnquiryFollowUpsByAdvisor(1, FETCH_ALL_PAGE_SIZE)
  const allRows = data?.items ?? []
  const updateEnquiry = useUpdateEnquiry()
  const createFollowUp = useCreateEnquiryFollowUp()

  function resolveProgramName(row: { programName: string | null; programCode: string | null }) {
    return row.programName ?? row.programCode ?? '—'
  }

  function matchesSearch(r: typeof allRows[number], term: string) {
    return `${r.enquiryCode} ${r.studentName} ${resolveProgramName(r)} ${r.enquiryStatusName ?? ''} ${r.followUpStatusName ?? ''} ${r.enquirySourceName ?? ''}`
      .toLowerCase()
      .includes(term)
  }

  const searchTrimmed = search.trim()
  const filteredRows = allRows.filter(r => searchTrimmed.length < MIN_SEARCH_CHARS || matchesSearch(r, searchTrimmed.toLowerCase()))
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS
    ? allRows.filter(r => matchesSearch(r, searchTrimmed.toLowerCase())).slice(0, 8)
    : []
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, PAGE_SIZE)

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }

  function openViewModal(guid: string) {
    setViewingGuid(guid)
    openModal('enquiry-assign-modal')
    setSearch('')
  }

  function handleCreateFollowUp(r: typeof allRows[number]) {
    setSelectedFollowUp({
      enquiryGuid: r.enquiryGuid,
      enquiryCode: r.enquiryCode,
      studentName: r.studentName,
      enquiryStatusName: r.enquiryStatusName,
      followUpStatusName: r.followUpStatusName,
      nextFollowDate: r.nextFollowDate,
    })
    openModal('new-followup-log-modal')
  }

  return (
    <div id="page-enquiry-followup">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Enquiry Followup</h1>
          <p className="text-sm text-g500 mt-0.5">Track &amp; log follow-ups allocated to staff</p>
        </div>
      </div>

      {/* Only this tile is wired to real data — the old Overdue/Due
          Today/Upcoming/Completed tiles depended on a client-only status
          bucket that doesn't exist on the real EnquiryFollowUpListDto, so
          they're dropped rather than faked. It counts this advisor's
          enquiries still in follow-up (one row per enquiry), not logs. */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-users text-b500" /><span className="text-sm text-g500">My Enquiries in Follow-up</span></div>
          <p className="text-2xl font-semibold text-g900">{allRows.length.toLocaleString()}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-g800">Allocated Follow-ups</h2>
          <TableSearch
            className="w-56"
            placeholder="Search by name, ref, status…"
            value={search}
            onChange={setSearch}
            results={searchMatches.map(r => ({ id: r.enquiryGuid, primary: r.enquiryCode, secondary: r.studentName }))}
            minChars={MIN_SEARCH_CHARS}
            onSelect={permissions.edit ? (r) => openViewModal(r.id) : undefined}
          />
        </div>
        <ScrollTable>
          <table>
            <thead><tr><th style={{ width: 48 }}></th><th>Enq. Ref</th><th>Student Name</th><th>Programme Interest</th><th>Enquiry Status</th><th>Follow-up Status</th><th>Source</th><th>Next Follow-up</th></tr></thead>
            <tbody>
              {isLoading
                ? <TableLoadingState colSpan={999} />
                : filteredRows.length === 0
                  ? <EmptyState colSpan={999} hasFilters={!!search.trim()} onClearFilters={() => setSearch('')} />
                  : null}
              {pageItems.map(r => (
                <tr key={r.enquiryGuid}>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => router.push(`/admission/payment?enquiryGuid=${r.enquiryGuid}`)}><i className="lni lni-arrow-right" /> Convert</button>
                      <button className="btn btn-neu btn-sm" onClick={() => handleCreateFollowUp(r)}>
                        <i className="lni lni-phone" /> Create Follow-up Status
                      </button>
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
      <NewFollowUpLogModal
        isOpen={openModals.has('new-followup-log-modal')}
        onClose={() => {
          closeModal('new-followup-log-modal')
          setSelectedFollowUp(null)
        }}
        showToast={showToast}
        createFollowUp={createFollowUp}
        initialData={selectedFollowUp}
      />
      <Toast toast={toast} />
    </div>
  )
}
