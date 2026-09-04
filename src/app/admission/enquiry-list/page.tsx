'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toast } from '@/components/Toast'
import { ScrollTable } from '@/components/ScrollTable'
import { ActionMenu } from '@/components/ActionMenu'
import { TableSearch } from '@/components/TableSearch'
import { SearchSelect } from '@/components/SearchSelect'
import { EmptyState } from '@/components/EmptyState'
import { TableLoadingState } from '@/components/TableLoadingState'
import { EnquiryFormModal } from '@/components/modals/admission/EnquiryFormModal'
import { EnquiryAssignModal } from '@/components/modals/admission/EnquiryAssignModal'
import { useEnquiries, useEnquiryCounts, useUpdateEnquiry } from '@/hooks/admission/useEnquiries'
import { useProgramMasters } from '@/hooks/academic/useProgramMaster'
import { useIntakes } from '@/hooks/academic/useIntakes'
import { useEnquiryStatuses } from '@/hooks/config/useEnquiryStatuses'
import { usePagePermissions } from '@/hooks/users/usePagePermissions'
import { usePagination } from '@/hooks/usePagination'

// Fetches up to FETCH_SIZE rows in one request, then paginates that
// already-fetched set 10-at-a-time client-side via usePagination — same
// "fetch a big batch once, page through it locally" pattern as Vetting
// Desk. 12000 covers the real dataset (11k+ rows per the comment on
// useEnquiries) in one request, so search/filter effectively reaches the
// whole table now rather than a capped batch — comes at the cost of a much
// heavier single fetch on every page load.
const FETCH_SIZE = 12000
const DISPLAY_PAGE_SIZE = 10
// Don't narrow the table (or open the search dropdown) until the user's
// typed at least this many characters — same convention as the other
// master pages' search boxes.
const MIN_SEARCH_CHARS = 2

// enquiryStatusGuid resolves against the real Enquiry Status master
// (useEnquiryStatuses) — same client-side resolution pattern as
// resolveProgramName below, since the enquiry row itself doesn't carry the
// status name.
function statusBadge(statusName: string | undefined) {
  if (!statusName) return <span className="badge badge-grey">—</span>
  return <span className="badge badge-blue">{statusName}</span>
}

// sourceName (from the Enquiry Source master, set via the create form's
// "Enquiry Source" dropdown) is already a real resolved string — no need to
// fall back to the raw enquirySourceGuid.
function sourceBadge(sourceName: string | null) {
  return <span className="badge badge-grey">{sourceName ?? '—'}</span>
}

export default function EnquiryListPage() {
  const router = useRouter()
  const permissions = usePagePermissions()
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [openModals, setOpenModals] = useState<Set<string>>(new Set())
  const [viewingGuid, setViewingGuid] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState('')
  const [intakeGuid, setIntakeGuid] = useState('')

  const { data, isLoading: loading } = useEnquiries(1, FETCH_SIZE)
  const updateEnquiry = useUpdateEnquiry()
  const rows = data?.items ?? []
  const hasActiveFilters = !!search.trim() || !!channel || !!intakeGuid

  // Stats-row summary — GET /api/v1/admissions/enquiries/counts, a separate
  // endpoint from the paginated list above (its own totalCount only ever
  // matches this one's totalCount by coincidence, not by being the same
  // field — both are wired independently). Confirmed to accept
  // intakeGuid/sourceGuid filters, so the cards track whatever's selected in
  // the Intake/Channel dropdowns below instead of always showing unfiltered
  // global totals.
  const { data: counts } = useEnquiryCounts({ intakeGuid: intakeGuid || undefined, sourceGuid: channel || undefined })

  // programName comes back null on every row from the real API — resolve it
  // client-side the same way faculty.ts's deanName fallback does.
  const { data: programs = [] } = useProgramMasters()
  function resolveProgramName(row: { programGuid: string | null; programName: string | null }) {
    if (row.programName) return row.programName
    if (!row.programGuid) return '—'
    return programs.find(p => p.programGuid === row.programGuid)?.programName ?? '—'
  }

  // intakeGuid is a real field directly on the enquiry row (unlike
  // programName/campusName), so this filters against the actual guid rather
  // than a resolved display string — full Intake master list, not just
  // what's on the current page, same "real master, not page-derived"
  // treatment as resolveProgramName's own source list.
  const { data: intakes = [] } = useIntakes()
  const intakeOptions = [
    { value: '', label: 'All Intakes' },
    ...intakes.map(i => ({ value: i.intakeGuid, label: `${i.intakeCode} — ${i.description}` })),
  ]

  const { data: enquiryStatuses = [] } = useEnquiryStatuses()
  function resolveStatusName(enquiryStatusGuid: string | null) {
    if (!enquiryStatusGuid) return undefined
    return enquiryStatuses.find(s => s.enquiryStatusGuid === enquiryStatusGuid)?.enquiryStatusName
  }

  // Searches across the full FETCH_SIZE batch (effectively the whole table
  // now — see the comment above), not just whatever page is on screen.
  function matchesSearch(r: typeof rows[number], term: string) {
    return `${r.enquiryCode} ${r.studentName} ${r.mobile} ${r.email} ${resolveProgramName(r)} ${r.sourceName ?? ''} ${resolveStatusName(r.enquiryStatusGuid) ?? ''}`
      .toLowerCase()
      .includes(term)
  }
  // `channel` stores the real enquirySourceGuid (not sourceName) so it can
  // double as the counts endpoint's `sourceGuid` filter above — options are
  // built dynamically from whatever (guid, name) pairs are actually present
  // on the currently-loaded rows, same "no fixed list, derive from real
  // data" pattern as vetting's own programme filter.
  const channelOptions = [
    { value: '', label: 'All Channels' },
    ...Array.from(new Map(rows.filter(r => r.enquirySourceGuid && r.sourceName).map(r => [r.enquirySourceGuid as string, r.sourceName as string])).entries())
      .map(([guid, name]) => ({ value: guid, label: name })),
  ]
  const searchTrimmed = search.trim()
  const filteredRows = rows.filter(r =>
    (searchTrimmed.length < MIN_SEARCH_CHARS || matchesSearch(r, searchTrimmed.toLowerCase())) &&
    (!channel || r.enquirySourceGuid === channel) &&
    (!intakeGuid || r.intakeGuid === intakeGuid)
  )
  // Client-side pagination over the already-fetched (up to FETCH_SIZE) batch
  // — 10 rows per page for display, same pattern as Vetting Desk.
  const { page, setPage, totalPages, totalCount, pageItems } = usePagination(filteredRows, DISPLAY_PAGE_SIZE)
  // Empty below MIN_SEARCH_CHARS, matching TableSearch's own minChars gate on
  // when the dropdown is even allowed to open.
  const searchMatches = searchTrimmed.length >= MIN_SEARCH_CHARS ? filteredRows.slice(0, 8) : []
  function clearFilters() { setSearch(''); setChannel(''); setIntakeGuid(''); setPage(1) }

  function showToast(msg: string, type = '') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  function openModal(id: string) { setOpenModals(prev => new Set(prev).add(id)) }
  function closeModal(id: string) { setOpenModals(prev => { const s = new Set(prev); s.delete(id); return s }) }

  function openViewModal(guid: string) {
    setViewingGuid(guid)
    openModal('enquiry-assign-modal')
    setSearch('')
  }

  return (
    <div id="page-enquiry-list">
      <div className="pg-hdr">
        <div>
          <h1 className="text-xl font-semibold text-g900">Enquiry List</h1>
          <p className="text-sm text-g500 mt-0.5">All enquiries across channels — walk-in, phone, online &amp; kiosk</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => router.push('/admission/dashboard')}><i className="lni lni-arrow-left" /> Back</button>
          {permissions.add && <button className="btn btn-primary" onClick={() => openModal('enquiry-form-modal')}><i className="lni lni-plus" /> New Enquiry</button>}
        </div>
      </div>

      {/* Backed by GET /api/v1/admissions/enquiries/counts — a dedicated
          summary endpoint, independent of the paginated list query, and
          scoped live to the Intake/Channel filters below via
          intakeGuid/sourceGuid. 5 cards now (Closed added) — overrides the
          shared .stats-row's fixed 4-column grid just for this page rather
          than touching the class every other stats-row page relies on
          staying at 4. */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-users text-b500" /><span className="text-sm text-g500">Total Enquiries</span></div>
          <p className="text-2xl font-semibold text-g900">{(counts?.totalCount ?? totalCount).toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-checkmark text-clr-green" /><span className="text-sm text-g500">Converted</span></div>
          <p className="text-2xl font-semibold text-g900">{counts ? counts.convertedCount.toLocaleString() : '—'}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-timer text-clr-amber" /><span className="text-sm text-g500">Pending Follow-up</span></div>
          <p className="text-2xl font-semibold text-g900">{counts ? counts.pendingFollowUpCount.toLocaleString() : '—'}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-world text-clr-purple" /><span className="text-sm text-g500">ODL Specific</span></div>
          <p className="text-2xl font-semibold text-g900">{counts ? counts.odelSourceCount.toLocaleString() : '—'}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1"><i className="lni lni-close text-clr-red" /><span className="text-sm text-g500">Closed</span></div>
          <p className="text-2xl font-semibold text-g900">{counts ? counts.closedCount.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-g800">Enquiry Register</h2>
            <p className="text-xs text-g400 mt-0.5">{totalCount.toLocaleString()} total</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <TableSearch
              className="w-56"
              placeholder="Search enquiries…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              results={searchMatches.map(r => ({ id: r.enquiryGuid, primary: r.enquiryCode, secondary: r.studentName }))}
              minChars={MIN_SEARCH_CHARS}
              // View is edit-gated below (same as the row action) — a picker
              // without edit rights just fills the search box instead, same
              // as TableSearch's own default behavior.
              onSelect={permissions.edit ? (r) => openViewModal(r.id) : undefined}
            />
            <SearchSelect className="w-36" options={channelOptions} value={channel} onChange={v => { setChannel(v); setPage(1) }} />
            <SearchSelect className="w-40" options={intakeOptions} value={intakeGuid} onChange={v => { setIntakeGuid(v); setPage(1) }} />
          </div>
        </div>
        <ScrollTable>
          <table>
            <thead><tr><th style={{ width: 48 }}></th><th>Enq. Ref</th><th>Name</th><th>Phone</th><th>Email</th><th>Programme Interest</th><th>Channel</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {loading
                ? <TableLoadingState colSpan={999} />
                : pageItems.length === 0
                  ? <EmptyState colSpan={999} hasFilters={hasActiveFilters} onClearFilters={clearFilters} />
                  : null}
              {pageItems.map(r => (
                <tr key={r.enquiryGuid}>
                  <td>
                    <ActionMenu>
                      <button className="btn btn-neu btn-sm" onClick={() => router.push(`/admission/payment?enquiryGuid=${r.enquiryGuid}`)}><i className="lni lni-arrow-right" /> Convert</button>
                      {permissions.edit && <button className="btn btn-neu btn-sm" onClick={() => openViewModal(r.enquiryGuid)}><i className="lni lni-eye" /> View</button>}
                    </ActionMenu>
                  </td>
                  <td className="font-mono text-sm">{r.enquiryCode}</td>
                  <td>{r.studentName}</td>
                  <td className="text-sm text-g600">{r.mobile}</td>
                  <td className="text-sm text-g600">{r.email}</td>
                  <td>{resolveProgramName(r)}</td>
                  <td>{sourceBadge(r.sourceName)}</td>
                  <td className="text-sm text-g600">{r.enquiryDate.slice(0, 10)}</td>
                  <td>{statusBadge(resolveStatusName(r.enquiryStatusGuid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>

        {totalCount > 0 && (
          <div className="flex items-center justify-between mt-3" style={{ fontSize: 12.5, color: 'var(--g500)' }}>
            <span>
              Page {page} of {totalPages} · {totalCount.toLocaleString()} {hasActiveFilters ? 'matching' : ''} enquiries
            </span>
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

      <EnquiryFormModal isOpen={openModals.has('enquiry-form-modal')} onClose={() => closeModal('enquiry-form-modal')} showToast={showToast} />
      <EnquiryAssignModal
        isOpen={openModals.has('enquiry-assign-modal')}
        onClose={() => closeModal('enquiry-assign-modal')}
        showToast={showToast}
        enquiryGuid={viewingGuid}
        updateEnquiry={updateEnquiry}
      />
      <Toast toast={toast} />
    </div>
  )
}
